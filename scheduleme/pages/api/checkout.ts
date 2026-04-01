// @ts-nocheck
// pages/api/checkout.ts — Create Stripe Checkout session for booking payment
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' });
const PLATFORM_FEE_PERCENT = 12; // 12% platform fee

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

  // Load booking with business details
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, businesses(id, name, stripe_account_id, stripe_onboarded), profiles(name, email)')
    .eq('id', booking_id)
    .maybeSingle();

  if (!booking) return res.status(404).json({ error: 'Booking not found' });
    let canAccess = booking.user_id === user.id;
  if (!canAccess && user.email) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();
    if (profile?.id && booking.user_id === profile.id) canAccess = true;
    if (!canAccess) {
      try {
        const { data: legacyUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        if (legacyUser?.id && booking.user_id === legacyUser.id) canAccess = true;
      } catch {}
    }
  }
  if (!canAccess) return res.status(403).json({ error: 'Access denied' });
  if (booking.status !== 'confirmed' && booking.status !== 'pending') return res.status(400).json({ error: 'Booking must be pending or confirmed before payment' });
  if (booking.paid_at) return res.status(400).json({ error: 'Booking already paid' });

  const biz = booking.businesses as any;
  if (!biz?.stripe_onboarded || !biz?.stripe_account_id)
    return res.status(400).json({ error: 'Business has not connected their bank account yet' });

  // Amount: use booking amount_cents if set, otherwise require it to be set
  const amountCents = booking.amount_cents;
  if (!amountCents || amountCents < 100)
    return res.status(400).json({ error: 'Payment amount not set for this booking. Contact the business.' });

  if (booking.stripe_payment_method_id)
    return res.status(400).json({ error: 'Card already saved for this booking.' });

  const platformFeeCents = Math.round(amountCents * PLATFORM_FEE_PERCENT / 100);

  // DEPRECATED: Checkout is no longer used for card setup; use /api/create-setup-intent with Stripe Elements.
  // Keeping this endpoint for backward compatibility.

  // Create Stripe Checkout Session to collect & save a card (no charge yet)
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'setup',
    customer_creation: 'always',
    success_url: `${siteUrl}/bookings?setup=success&booking=${booking_id}`,
    cancel_url: `${siteUrl}/bookings?setup=cancelled&booking=${booking_id}`,
    client_reference_id: booking_id,
    metadata: { booking_id, business_id: biz.id, amount_cents: String(amountCents), platform_fee_cents: String(platformFeeCents) },
    setup_intent_data: {
      metadata: { bookingId: booking_id, businessId: biz.id },
      usage: 'off_session',
    },
    customer_email: (booking.profiles as any)?.email || user.email,
  });

  return res.status(200).json({ url: session.url });
}
