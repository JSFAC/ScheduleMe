// pages/api/stripe-webhook.ts
// Handles Stripe events — updates booking status, sends emails, triggers n8n
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import stripe from '../../lib/stripe';
import { createClient } from '@supabase/supabase-js';

// Must disable body parsing for Stripe webhooks
export const config = { api: { bodyParser: false } };

const PLATFORM_FEE_PERCENT = 12;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function sendPaymentEmails(bookingId: string, amountCents: number) {
  const supabase = getSupabase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';
  const secret = process.env.NOTIFY_SECRET || '';

  try {
    // Fetch full booking with user and business info
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, businesses(name, owner_email), users(name, email)')
      .eq('id', bookingId)
      .maybeSingle();

    if (!booking) return;

    const biz = booking.businesses as any;
    const user = booking.users as any;
    const amountDollars = (amountCents / 100).toFixed(2);
    const platformFeeCents = Math.round(amountCents * PLATFORM_FEE_PERCENT / 100);
    const payoutCents = amountCents - platformFeeCents;
    const payoutDollars = (payoutCents / 100).toFixed(2);

    const scheduledAt = booking.scheduled_at
      ? new Date(booking.scheduled_at).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric',
          year: 'numeric', hour: 'numeric', minute: '2-digit',
        })
      : undefined;

    // Email customer receipt
    if (user?.email) {
      await fetch(`${siteUrl}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
        body: JSON.stringify({
          type: 'payment_receipt_customer',
          to: user.email,
          name: user.name || 'there',
          service: booking.service,
          businessName: biz?.name || 'your service provider',
          amountDollars,
          scheduledAt,
          bookingId,
        }),
      }).catch(console.error);
    }

    // Email business payment notification
    if (biz?.owner_email) {
      await fetch(`${siteUrl}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
        body: JSON.stringify({
          type: 'payment_notification_business',
          to: biz.owner_email,
          businessName: biz.name,
          customerName: user?.name || 'A customer',
          service: booking.service,
          amountDollars,
          platformFeePercent: PLATFORM_FEE_PERCENT,
          payoutDollars,
          bookingId,
        }),
      }).catch(console.error);
    }
  } catch (err) {
    console.error('[webhook] Failed to send payment emails:', err);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return res.status(400).json({ error: 'Missing stripe signature or webhook secret' });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const supabase = getSupabase();

  try {
    switch (event.type) {

      // Payment succeeded — mark booking as paid, send emails
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.booking_id;

        if (bookingId) {
          await supabase
            .from('bookings')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', bookingId);

          console.log(`[webhook] Booking ${bookingId} marked as paid`);

          const amountCents = session.amount_total ?? 0;
          await sendPaymentEmails(bookingId, amountCents);

          await triggerN8n('payment_succeeded', {
            bookingId,
            amountCents,
          });
        }
        break;
      }

      // Also handle payment_intent.succeeded for direct charges
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingId = pi.metadata?.booking_id || pi.metadata?.bookingId;

        if (bookingId) {
          // Only update if not already paid via checkout.session.completed
          const { data: existing } = await supabase
            .from('bookings').select('status').eq('id', bookingId).maybeSingle();

          if (existing && existing.status !== 'paid') {
            await supabase
              .from('bookings')
              .update({ status: 'paid', paid_at: new Date().toISOString() })
              .eq('id', bookingId);

            await sendPaymentEmails(bookingId, pi.amount);

            await triggerN8n('payment_succeeded', {
              bookingId,
              amountCents: pi.amount,
              platformFeeCents: pi.application_fee_amount,
            });
          }
        }
        break;
      }

      // Payment failed
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingId = pi.metadata?.booking_id || pi.metadata?.bookingId;

        if (bookingId) {
          await supabase
            .from('bookings')
            .update({ status: 'payment_failed' })
            .eq('id', bookingId);

          console.log(`[webhook] Booking ${bookingId} payment failed`);
        }
        break;
      }

      // Business completed Stripe Connect onboarding
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        const isReady = account.charges_enabled && account.payouts_enabled;

        if (isReady) {
          await supabase
            .from('businesses')
            .update({ stripe_onboarded: true })
            .eq('stripe_account_id', account.id);

          console.log(`[webhook] Business ${account.id} Stripe onboarding complete`);

          await triggerN8n('business_stripe_ready', {
            stripeAccountId: account.id,
          });
        }
        break;
      }

      default:
        console.log(`[webhook] Unhandled event: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[webhook] Handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}

async function triggerN8n(event: string, data: Record<string, unknown>) {
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!n8nWebhookUrl) return;
  try {
    await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data, timestamp: new Date().toISOString() }),
    });
  } catch (err) {
    console.error(`[n8n] Failed to trigger ${event}:`, err);
  }
}
