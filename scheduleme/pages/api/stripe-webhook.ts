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

async function alertAdmin(subject: string, body: string) {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';
    const secret = process.env.NOTIFY_SECRET || '';
    if (!secret) return;
    const admin = process.env.ADMIN_ALERT_EMAIL || 'usescheduleme@gmail.com';
    await fetch(`${siteUrl}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
      body: JSON.stringify({ type: 'stripe_alert', to: admin, subject, body }),
    });
  } catch {}
}

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function getWebhookSecrets(): string[] {
  const list = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_LIVE,
    process.env.STRIPE_WEBHOOK_SECRET_TEST,
    ...(process.env.STRIPE_WEBHOOK_SECRETS || '').split(','),
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  return Array.from(new Set(list));
}

async function notifyNewBooking(bookingId: string, supabase: ReturnType<typeof getSupabase>) {
  try {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, service, status, created_at, scheduled_start, scheduled_end, note, amount_cents, protection_fee_cents, businesses(name, owner_email, phone), profiles(name, email, phone)')
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
      const scheduledRaw = booking.scheduled_start || booking.scheduled_end || null;
      const scheduledAt = scheduledRaw
        ? new Date(scheduledRaw).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        : '';
      const protectionFee = typeof booking.protection_fee_cents === 'number' ? booking.protection_fee_cents : 99;
      const totalCents = typeof booking.amount_cents === 'number' ? (booking.amount_cents + protectionFee) : null;
      await fetch(`${siteUrl}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
        body: JSON.stringify({
          type: 'new_booking_business',
          to: biz.owner_email,
          name: biz.name,
          service: booking.service,
          customerName: user?.name || 'A customer',
          scheduledAt,
          note: booking.note || '',
          amountDollars: totalCents != null ? (totalCents / 100).toFixed(2) : '',
          bookingId,
        }),
      }).catch(() => {});
    }
  } catch {}
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sig = req.headers['stripe-signature'];
  const webhookSecrets = getWebhookSecrets();

  if (!sig) {
    // Avoid repeated disablement noise from non-Stripe traffic.
    return res.status(200).json({ received: true, ignored: 'missing_signature' });
  }

  if (webhookSecrets.length === 0) {
    console.error('[webhook] No webhook secret configured');
    await alertAdmin('Stripe webhook secret missing', 'No STRIPE_WEBHOOK_SECRET configured in environment.');
    // Return 2xx so Stripe does not disable the endpoint while config is being fixed.
    return res.status(200).json({ received: true, ignored: 'missing_webhook_secret' });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await getRawBody(req);
    let constructed: Stripe.Event | null = null;
    for (const secret of webhookSecrets) {
      try {
        constructed = stripe.webhooks.constructEvent(rawBody, sig, secret);
        break;
      } catch {
        // Try next secret (supports rotated endpoint secrets).
      }
    }
    if (!constructed) throw new Error('No configured webhook secret matched signature.');
    event = constructed;
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err);
    await alertAdmin('Stripe webhook signature verification failed', String((err as any)?.message || err));
    // Return 2xx to avoid endpoint auto-disable while secrets are corrected.
    return res.status(200).json({ received: true, ignored: 'invalid_signature' });
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

      // Setup intent succeeded — save payment method for user + booking
      case 'setup_intent.succeeded': {
        const si = event.data.object as Stripe.SetupIntent;
        const bookingId = (si.metadata as any)?.bookingId || (si.metadata as any)?.booking_id;
        const userId = (si.metadata as any)?.userId || null;
        const paymentMethodId = typeof si.payment_method === 'string' ? si.payment_method : (si.payment_method as any)?.id;
        if (userId) {
          await supabase
            .from('profiles')
            .update({
              stripe_setup_intent_id: si.id,
              stripe_payment_method_id: paymentMethodId || null,
              stripe_customer_id: si.customer as string | null,
            })
            .eq('id', userId);
        }
        if (bookingId) {
          await supabase
            .from('bookings')
            .update({
              stripe_setup_intent_id: si.id,
              stripe_payment_method_id: paymentMethodId || null,
              stripe_customer_id: si.customer as string | null,
            })
            .eq('id', bookingId);
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

      // Payment succeeded — keep booking workflow status and only mark funds as paid
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const { bookingId, businessId } = pi.metadata;

        if (bookingId) {
          const { data: existing } = await supabase
            .from('bookings')
            .select('status')
            .eq('id', bookingId)
            .maybeSingle();

          const updates: any = {
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: pi.id,
          };
          // Keep legacy compatibility only for old payment_pending rows.
          if (existing?.status === 'payment_pending') {
            updates.status = 'pending';
          }
          await supabase
            .from('bookings')
            .update(updates)
            .eq('id', bookingId);

          console.log(`[webhook] Booking ${bookingId} payment succeeded`);

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
          await alertAdmin('Stripe payment failed', `bookingId: ${bookingId}\npi: ${pi.id}\nreason: ${pi.last_payment_error?.message || 'unknown'}`);
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
          await alertAdmin('Stripe payment canceled', `bookingId: ${bookingId}\npi: ${pi.id}`);
        }
        break;
      }

      case 'payout.failed': {
        const payout = event.data.object as Stripe.Payout;
        await alertAdmin('Stripe payout failed', `payoutId: ${payout.id}\namount: ${payout.amount}\nstatus: ${payout.status}\nreason: ${payout.failure_message || 'unknown'}`);
        break;
      }

      case 'transfer.failed': {
        const transfer = event.data.object as Stripe.Transfer;
        await alertAdmin('Stripe transfer failed', `transferId: ${transfer.id}\namount: ${transfer.amount}\nstatus: ${transfer.status}`);
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
    await alertAdmin('Stripe webhook handler error', String((err as any)?.message || err));
    // Acknowledge to Stripe to prevent endpoint disablement loops.
    return res.status(200).json({ received: true, handler_error: true });
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
