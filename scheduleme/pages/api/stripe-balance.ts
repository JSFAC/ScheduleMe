// pages/api/stripe-balance.ts — SECURED
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import stripe from '../../lib/stripe';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 10, windowMs: 10 * 60_000, keyPrefix: 'stripe-balance' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { businessId } = req.body || {};
  const supabase = getSupabase();
  let biz: any = null;

  if (businessId) {
    if (!isValidUuid(businessId)) return res.status(400).json({ error: 'Invalid businessId' });
    const { data } = await supabase
      .from('businesses')
      .select('id, stripe_account_id, owner_id, owner_email')
      .eq('id', businessId)
      .maybeSingle();
    biz = data;
  } else {
    const { data } = await supabase
      .from('businesses')
      .select('id, stripe_account_id, owner_id, owner_email')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    biz = data;
  }

  if (!biz) return res.status(404).json({ error: 'Business not found' });

  const normalizedUserEmail = (user.email || '').toLowerCase().trim();
  const normalizedOwnerEmail = (biz.owner_email || '').toLowerCase().trim();
  if (!biz.owner_id && normalizedOwnerEmail && normalizedOwnerEmail === normalizedUserEmail) {
    await supabase.from('businesses').update({ owner_id: user.id }).eq('id', biz.id);
    biz.owner_id = user.id;
  }
  if (biz.owner_id !== user.id) return res.status(403).json({ error: 'Access denied' });

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
