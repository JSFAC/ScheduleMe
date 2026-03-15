// pages/api/stripe-connect.ts — SECURED
import type { NextApiRequest, NextApiResponse } from 'next';
import stripe from '../../lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!rateLimit(req, res, { max: 5, windowMs: 60 * 60_000, keyPrefix: 'stripe-connect' })) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { businessId } = req.body;
  if (!businessId) return res.status(400).json({ error: 'businessId required' });
  if (!isValidUuid(businessId)) return res.status(400).json({ error: 'Invalid businessId' });

  const supabase = getSupabase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';

  const { data: business } = await supabase.from('businesses')
    .select('stripe_account_id, name, owner_email').eq('id', businessId).single();

  if (!business) return res.status(404).json({ error: 'Business not found' });
  // Must own this business
  if (business.owner_email !== user.email) return res.status(403).json({ error: 'Access denied' });

  try {
    let stripeAccountId = business.stripe_account_id;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: business.owner_email,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        business_profile: { name: business.name },
      });
      stripeAccountId = account.id;
      await supabase.from('businesses').update({ stripe_account_id: stripeAccountId }).eq('id', businessId);
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${siteUrl}/business/dashboard?stripe=refresh&id=${businessId}`,
      return_url: `${siteUrl}/business/dashboard?stripe=success&id=${businessId}`,
      type: 'account_onboarding',
    });

    return res.status(200).json({ url: accountLink.url });
  } catch (err) {
    console.error('[stripe-connect]', err);
    return res.status(500).json({ error: 'Failed to create Stripe onboarding link' });
  }
}
