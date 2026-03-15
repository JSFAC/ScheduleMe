// pages/api/checkout.ts — SECURED
import type { NextApiRequest, NextApiResponse } from 'next';
import stripe from '../../lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

const COMMISSION_RATE = 0.12;
const MIN_AMOUNT = 100;      // $1.00
const MAX_AMOUNT = 1000000;  // $10,000

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit: 10 checkout attempts per IP per 10 min
  if (!rateLimit(req, res, { max: 10, windowMs: 10 * 60_000, keyPrefix: 'checkout' })) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { bookingId, amountCents, businessId } = req.body;

  if (!bookingId || !amountCents || !businessId)
    return res.status(400).json({ error: 'bookingId, amountCents, and businessId are required' });
  if (!isValidUuid(bookingId)) return res.status(400).json({ error: 'Invalid bookingId' });
  if (!isValidUuid(businessId)) return res.status(400).json({ error: 'Invalid businessId' });
  if (typeof amountCents !== 'number' || !Number.isInteger(amountCents))
    return res.status(400).json({ error: 'amountCents must be an integer' });
  if (amountCents < MIN_AMOUNT) return res.status(400).json({ error: 'Minimum amount is $1.00' });
  if (amountCents > MAX_AMOUNT) return res.status(400).json({ error: 'Maximum amount is $10,000' });

  const supabase = getSupabase();

  // Verify the booking belongs to this user
  const { data: booking } = await supabase.from('bookings')
    .select('user_id').eq('id', bookingId).maybeSingle();
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.user_id !== user.id) return res.status(403).json({ error: 'Access denied' });

  try {
    const { data: business } = await supabase.from('businesses')
      .select('stripe_account_id, name').eq('id', businessId).single();
    if (!business?.stripe_account_id)
      return res.status(400).json({ error: 'Business has not connected Stripe yet' });

    const platformFeeCents = Math.round(amountCents * COMMISSION_RATE);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: business.stripe_account_id },
      metadata: { bookingId, businessId, platformFeeCents: String(platformFeeCents) },
    });

    await supabase.from('bookings').update({
      stripe_payment_intent_id: paymentIntent.id,
      amount_cents: amountCents,
      platform_fee_cents: platformFeeCents,
      status: 'payment_pending',
    }).eq('id', bookingId);

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      platformFeeCents,
      businessReceivesCents: amountCents - platformFeeCents,
    });
  } catch (err) {
    console.error('[checkout]', err);
    return res.status(500).json({ error: 'Failed to create payment intent' });
  }
}
