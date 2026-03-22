// pages/api/stripe-webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import stripe from '../../lib/stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const PLATFORM_FEE_PERCENT = 12;

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
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
    const payoutDollars = ((amountCents - platformFeeCents) / 100).toFixed(2);
    const scheduledAt = booking.scheduled_at
      ? new Date(booking.scheduled_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      : undefined;
    if (user?.email) {
      await fetch(siteUrl + '/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
        body: JSON.stringify({ type: 'payment_receipt_customer', to: user.email, name: user.name || 'there', service: booking.service, businessName: biz?.name || 'your provider', amountDollars, scheduledAt, bookingId }),
      }).catch(console.error);
    }
    if (biz?.owner_email) {
      await fetch(siteUrl + '/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
        body: JSON.stringify({ type: 'payment_notification_business', to: biz.owner_email, businessName: biz.name, customerName: user?.name || 'A customer', service: booking.service, amountDollars, platformFeePercent: PLATFORM_FEE_PERCENT, payoutDollars, bookingId }),
      }).catch(console.error);
    }
  } catch (err) { console.error('[webhook] email error:', err); }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !webhookSecret) return res.status(400).json({ error: 'Missing signature' });
  let event: Stripe.Event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[webhook] Signature failed:', err);
    return res.status(400).json({ error: 'Invalid signature' });
  }
  const supabase = getSupabase();
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.booking_id;
        if (bookingId) {
          await supabase.from('bookings').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', bookingId);
          await sendPaymentEmails(bookingId, session.amount_total ?? 0);
          if (process.env.N8N_WEBHOOK_URL) await fetch(process.env.N8N_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'payment_succeeded', data: { bookingId, amountCents: session.amount_total }, timestamp: new Date().toISOString() }) }).catch(() => {});
        }
        break;
      }
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingId = pi.metadata?.booking_id || pi.metadata?.bookingId;
        if (bookingId) {
          const { data: existing } = await supabase.from('bookings').select('status').eq('id', bookingId).maybeSingle();
          if (existing && existing.status !== 'paid') {
            await supabase.from('bookings').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', bookingId);
            await sendPaymentEmails(bookingId, pi.amount);
          }
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const bookingId = pi.metadata?.booking_id || pi.metadata?.bookingId;
        if (bookingId) await supabase.from('bookings').update({ status: 'payment_failed' }).eq('id', bookingId);
        break;
      }
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        if (account.charges_enabled && account.payouts_enabled) {
          await supabase.from('businesses').update({ stripe_onboarded: true }).eq('stripe_account_id', account.id);
        }
        break;
      }
      default: console.log('[webhook] Unhandled:', event.type);
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[webhook] Error:', err);
    return res.status(500).json({ error: 'Handler failed' });
  }
}
