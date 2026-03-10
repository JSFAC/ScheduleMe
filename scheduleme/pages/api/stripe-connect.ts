// pages/api/stripe-connect.ts
// Creates a Stripe Connect onboarding link for a business
import type { NextApiRequest, NextApiResponse } from 'next';
import stripe from '../../lib/stripe';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { businessId } = req.body;
  if (!businessId) return res.status(400).json({ error: 'businessId required' });

  const supabase = getSupabase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';

  try {
    // Check if business already has a Stripe account
    const { data: business } = await supabase
      .from('businesses')
      .select('stripe_account_id, name, owner_email')
      .eq('id', businessId)
      .single();

    if (!business) return res.status(404).json({ error: 'Business not found' });

    let stripeAccountId = business.stripe_account_id;

    // Create a new Stripe Connect account if they don't have one
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: business.owner_email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: business.name,
        },
      });

      stripeAccountId = account.id;

      // Save the Stripe account ID to our database
      await supabase
        .from('businesses')
        .update({ stripe_account_id: stripeAccountId })
        .eq('id', businessId);
    }

    // Create an onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${siteUrl}/business/dashboard?stripe=refresh&id=${businessId}`,
      return_url: `${siteUrl}/business/dashboard?stripe=success&id=${businessId}`,
      type: 'account_onboarding',
    });

    return res.status(200).json({ url: accountLink.url });
  } catch (err) {
    console.error('[stripe-connect] Error:', err);
    return res.status(500).json({ error: 'Failed to create Stripe onboarding link' });
  }
}
