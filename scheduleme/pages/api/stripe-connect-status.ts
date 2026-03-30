// pages/api/stripe-connect-status.ts — SECURED
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

  if (!rateLimit(req, res, { max: 10, windowMs: 10 * 60_000, keyPrefix: 'stripe-connect-status' })) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { businessId } = req.body || {};
  if (!businessId) return res.status(400).json({ error: 'businessId required' });
  if (!isValidUuid(businessId)) return res.status(400).json({ error: 'Invalid businessId' });

  const supabase = getSupabase();
  const { data: business } = await supabase
    .from('businesses')
    .select('stripe_account_id, owner_email, stripe_onboarded')
    .eq('id', businessId)
    .single();

  if (!business) return res.status(404).json({ error: 'Business not found' });
  if (business.owner_email !== user.email) return res.status(403).json({ error: 'Access denied' });

  if (!business.stripe_account_id) {
    return res.status(200).json({ onboarded: false, account_missing: true });
  }

  try {
    const account = await stripe.accounts.retrieve(business.stripe_account_id);
    const onboarded = !!(account.details_submitted && account.charges_enabled && account.payouts_enabled);

    if (onboarded && !business.stripe_onboarded) {
      await supabase.from('businesses').update({ stripe_onboarded: true }).eq('id', businessId);
    }

    return res.status(200).json({
      onboarded,
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
    });
  } catch (err) {
    console.error('[stripe-connect-status]', err);
    return res.status(500).json({ error: (err as any)?.raw?.message || (err as any)?.message || 'Failed to check Stripe status' });
  }
}
