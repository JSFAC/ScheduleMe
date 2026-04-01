// @ts-nocheck
// pages/api/stripe-webhook.ts
// Handles Stripe events — updates booking status, triggers n8n
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import stripe from '../../lib/stripe';
import { setSecurityHeaders } from '../../lib/apiSecurity';
import { createClient } from '@supabase/supabase-js';

// Must disable body parsing for Stripe webhooks
export const config = { api: { bodyParser: false } };

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
async function notifyNewBooking(bookingId: string, supabase: ReturnType<typeof getSupabase>) {
  try {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, service, status, created_at, businesses(name, owner_email, phone), profiles(name, email, phone)')
      .eq('id', bookingId)
      .single();
    if (!booking) return;

    const biz = (booking.businesses as any);
    const user = (booking.profiles as any);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';
    const secret = process.env.NOTIFY_SECRET || '';

    if (user?.email) {
      await fetch(`${siteUrl}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
        body: JSON.stringify({
          type: 'booking_confirmation',
          to: user.email,
          name: user?.name || 'there',
          service: booking.service,
          location: biz?.name || '',
        }),
      }).catch(() => {});
    }

    if (biz?.owner_email) {
      await fetch(`${siteUrl}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
        body: JSON.stringify({
          type: 'new_booking_business',
          to: biz.owner_email,
          name: biz.name,
          service: booking.service,
          customerName: user?.name || 'A customer',
          customerPhone: user?.phone || '',
          bookingId,
        }),
      }).catch(() => {});
    }
  } catch {}
}

}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
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

      // Checkout setup completed — save customer + payment method
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'setup') {
          const bookingId = session.metadata?.booking_id || session.client_reference_id;
          const setupIntentId = session.setup_intent as string | null;
          if (bookingId && setupIntentId) {
            const si = await stripe.setupIntents.retrieve(setupIntentId);
            const paymentMethodId = typeof si.payment_method === 'string' ? si.payment_method : (si.payment_method as any)?.id;
            await supabase
              .from('bookings')
              .update({
                stripe_setup_intent_id: setupIntentId,
                stripe_payment_method_id: paymentMethodId || null,
                stripe_customer_id: session.customer as string | null,
              })
              .eq('id', bookingId);
          }
        }
        break;
      }

      // Payment authorized (manual capture) — mark booking as payment_pending
      case 'payment_intent.amount_capturable_updated': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const { bookingId, businessId } = pi.metadata;

        if (bookingId) {
          await supabase
            .from('bookings')
            .update({ status: 'payment_pending', stripe_payment_intent_id: pi.id })
            .eq('id', bookingId);

          console.log(`[webhook] Booking ${bookingId} payment authorized`);

          await triggerN8n('payment_authorized', {
            bookingId,
            businessId,
            amountCents: pi.amount,
          });
        }
        break;
      }

      // Payment succeeded — mark booking as paid (or keep completed)
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const { bookingId, businessId } = pi.metadata;

        if (bookingId) {
          const { data: existing } = await supabase
            .from('bookings')
            .select('status')
            .eq('id', bookingId)
            .maybeSingle();

          const nextStatus = existing?.status === 'completed' ? 'completed' : 'paid';
          await supabase
            .from('bookings')
            .update({ status: nextStatus, paid_at: new Date().toISOString() })
            .eq('id', bookingId);

          console.log(`[webhook] Booking ${bookingId} marked as paid`);

          await notifyNewBooking(bookingId, supabase);

          // Notify n8n to trigger post-payment automation
          await triggerN8n('payment_succeeded', {
            bookingId,
            businessId,
            amountCents: pi.amount,
            platformFeeCents: pi.application_fee_amount,
          });
        }
        break;
      }

      // Payment failed — mark booking accordingly
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const { bookingId } = pi.metadata;

        if (bookingId) {
          await supabase
            .from('bookings')
            .update({ status: 'payment_failed' })
            .eq('id', bookingId);

          console.log(`[webhook] Booking ${bookingId} payment failed`);
        }
        break;
      }

      // Payment canceled — mark booking as cancelled
      case 'payment_intent.canceled': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const { bookingId } = pi.metadata;
        if (bookingId) {
          await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
          console.log(`[webhook] Booking ${bookingId} payment canceled`);
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

// Trigger n8n webhook (we'll set up the actual URL when n8n is running)
async function triggerN8n(event: string, data: Record<string, unknown>) {
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!n8nWebhookUrl) {
    console.log(`[n8n] No webhook URL set, skipping trigger for: ${event}`);
    return;
  }

  try {
    await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data, timestamp: new Date().toISOString() }),
    });
    console.log(`[n8n] Triggered: ${event}`);
  } catch (err) {
    console.error(`[n8n] Failed to trigger ${event}:`, err);
  }
}
