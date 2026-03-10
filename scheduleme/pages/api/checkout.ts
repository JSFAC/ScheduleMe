// pages/api/checkout.ts
// Creates a Stripe Payment Intent with 12% commission split
import type { NextApiRequest, NextApiResponse } from 'next';
import stripe from '../../lib/stripe';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

const COMMISSION_RATE = 0.12; // 12%

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { bookingId, amountCents, businessId } = req.body;

  if (!bookingId || !amountCents || !businessId) {
    return res.status(400).json({ error: 'bookingId, amountCents, and businessId are required' });
  }

  if (amountCents < 100) {
    return res.status(400).json({ error: 'Minimum amount is $1.00' });
  }

  const supabase = getSupabase();

  try {
    // Get the business's Stripe account ID
    const { data: business } = await supabase
      .from('businesses')
      .select('stripe_account_id, name')
      .eq('id', businessId)
      .single();

    if (!business?.stripe_account_id) {
      return res.status(400).json({ error: 'Business has not connected their Stripe account yet' });
    }

    // Calculate the platform fee (12%)
    const platformFeeCents = Math.round(amountCents * COMMISSION_RATE);

    // Create a Payment Intent — money goes to business, we keep 12%
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      application_fee_amount: platformFeeCents,
      transfer_data: {
        destination: business.stripe_account_id,
      },
      metadata: {
        bookingId,
        businessId,
        platformFeeCents: String(platformFeeCents),
      },
    });

    // Update booking with payment intent ID
    await supabase
      .from('bookings')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        amount_cents: amountCents,
        platform_fee_cents: platformFeeCents,
        status: 'payment_pending',
      })
      .eq('id', bookingId);

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      platformFeeCents,
      businessReceivesCents: amountCents - platformFeeCents,
    });
  } catch (err) {
    console.error('[checkout] Error:', err);
    return res.status(500).json({ error: 'Failed to create payment intent' });
  }
}
