// @ts-nocheck
// pages/api/create-setup-intent-account.ts
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
  if (!rateLimit(req, res, { max: 15, windowMs: 60_000, keyPrefix: 'setup-intent-account' })) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const supabase = getSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      usage: 'off_session',
      metadata: { userId: user.id },
    });
    await supabase.from('profiles').update({ stripe_setup_intent_id: setupIntent.id }).eq('id', user.id);
    return res.status(200).json({ client_secret: setupIntent.client_secret });
  } catch (e: any) {
    console.error('[create-setup-intent-account] stripe error', e);
    return res.status(500).json({ error: e?.message || 'Stripe setup failed' });
  }
}
