// @ts-nocheck
// pages/api/payment-methods.ts
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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'payment-methods' })) return;
  const user = await requireAuth(req, res);
  if (!user) return;

  const supabase = getSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, stripe_payment_method_id')
    .eq('id', user.id)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id;
  if (!customerId) return res.status(200).json({ methods: [], defaultId: null });

  let methodsData;
  try {
    const methods = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
    methodsData = methods.data;
  } catch (err) {
    // If stored customer id is invalid, try to re-sync by email.
    if (user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 3 });
      const latest = customers.data.sort((a, b) => (b.created || 0) - (a.created || 0))[0];
      if (latest?.id) {
        customerId = latest.id;
        await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
        const methods = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
        methodsData = methods.data;
      }
    }
  }

  if (!methodsData) {
    return res.status(200).json({ methods: [], defaultId: null });
  }

  return res.status(200).json({
    methods: methodsData.map((m) => ({
      id: m.id,
      brand: m.card?.brand,
      last4: m.card?.last4,
      exp_month: m.card?.exp_month,
      exp_year: m.card?.exp_year,
    })),
    defaultId: profile?.stripe_payment_method_id || null,
  });
}
