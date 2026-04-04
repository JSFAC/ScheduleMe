// pages/api/stripe-customer-sync.ts
// Sync Stripe customer by email if missing on profile
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import stripe from '../../lib/stripe';
import { setSecurityHeaders, rateLimit, requireAuth } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'stripe-sync' })) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const supabase = getSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.stripe_customer_id) {
    return res.status(200).json({ customerId: profile.stripe_customer_id, updated: false });
  }

  if (!user.email) return res.status(200).json({ customerId: null, updated: false });

  try {
    const customers = await stripe.customers.list({ email: user.email, limit: 3 });
    const latest = customers.data.sort((a, b) => (b.created || 0) - (a.created || 0))[0];
    if (!latest?.id) return res.status(200).json({ customerId: null, updated: false });

    await supabase.from('profiles').update({ stripe_customer_id: latest.id }).eq('id', user.id);
    return res.status(200).json({ customerId: latest.id, updated: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Stripe sync failed' });
  }
}
