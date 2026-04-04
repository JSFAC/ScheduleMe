// pages/api/stripe-balance.ts — SECURED
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import stripe from '../../lib/stripe';
import { setSecurityHeaders, rateLimit, requireAuth } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 10, windowMs: 10 * 60_000, keyPrefix: 'stripe-balance' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const supabase = getSupabase();
  const { data: biz } = await supabase
    .from('businesses')
    .select('stripe_account_id, owner_email')
    .eq('owner_email', user.email)
    .maybeSingle();

  if (!biz?.stripe_account_id) {
    return res.status(400).json({ error: 'Business has not connected Stripe yet' });
  }

  try {
    const bal = await stripe.balance.retrieve({ stripeAccount: biz.stripe_account_id });
    const available = (bal.available || []).reduce((s, b) => s + (b.amount || 0), 0);
    const pending = (bal.pending || []).reduce((s, b) => s + (b.amount || 0), 0);
    return res.status(200).json({ available, pending, currency: 'usd' });
  } catch (err: any) {
    console.error('[stripe-balance]', err);
    return res.status(500).json({ error: err?.message || 'Failed to retrieve balance' });
  }
}

