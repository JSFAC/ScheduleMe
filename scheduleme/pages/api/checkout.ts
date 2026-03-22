// pages/api/checkout.ts — Create Stripe Checkout session for booking payment
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' });
const PLATFORM_FEE_PERCENT = 12;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).end();
  if (!rateLimit(req, res, { max: 10, windowMs: 60_000, keyPrefix: 'checkout' })) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { booking_id } = req.body;
  if (!booking_id || !isValidUuid(booking_id))
    return res.status(400).json({ error: 'Valid booking_id required' });

  const supabase = getSupabase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';

  // Load booking with business details — join users table (not profiles)
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, businesses(id, name, stripe_account_id, stripe_onboarded), users(id, name, email)')
    .eq('id', booking_id)
    .maybeSingle();

  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.user_id !== user.id) return res.status(403).json({ error: 'Access denied' });
  if (!['confirmed', 'payment_pending'].includes(booking.status))
    return res.status(400).json({ error: 'Booking must be confirmed before payment' });
  if (booking.paid_at) return res.status(400).json({ error: 'Booking already paid' });

  const biz = booking.businesses as any;
  if (!biz?.stripe_onboarded || !biz?.stripe_account_id)
    return res.status(400).json({ error: 'Business has not connected their bank account yet' });

  const amountCents = booking.amount_cents;
  if (!amountCents || amountCents < 100)
    return res.status(400).json({ error: 'Payment amount not set for this booking. Contact the business.' });

  const platformFeeCents = Math.round(amountCents * PLATFORM_FEE_PERCENT / 100);
  const customerEmail = (booking.users as any)?.email || user.email;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: booking.service || 'Service Booking',
          description: `Booked with ${biz.name}`,
        },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    mode: 'payment',
    // Point to dedicated success page
    success_url: `${siteUrl}/payment-success?booking=${booking_id}`,
    cancel_url: `${siteUrl}/bookings?payment=cancelled`,
    metadata: { booking_id },
    payment_intent_data: {
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: biz.stripe_account_id },
      metadata: { booking_id },
    },
    customer_email: customerEmail,
  });

  return res.status(200).json({ url: session.url });
}
