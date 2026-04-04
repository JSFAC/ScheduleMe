// @ts-nocheck
// pages/api/set-default-payment-method.ts
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
  if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'set-default-pm' }))) return;
  const user = await requireAuth(req, res);
  if (!user) return;

  const { payment_method_id } = req.body || {};
  if (!payment_method_id || typeof payment_method_id !== 'string') return res.status(400).json({ error: 'payment_method_id required' });

  const supabase = getSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.stripe_customer_id) return res.status(400).json({ error: 'No Stripe customer found' });

  // Verify PM belongs to customer
  const pm = await stripe.paymentMethods.retrieve(payment_method_id);
  if (pm.customer !== profile.stripe_customer_id) return res.status(403).json({ error: 'Access denied' });

  await supabase
    .from('profiles')
    .update({ stripe_payment_method_id: payment_method_id })
    .eq('id', user.id);

  return res.status(200).json({ success: true });
}
