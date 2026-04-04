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
    .select('stripe_customer_id, stripe_payment_method_id, email')
    .eq('id', user.id)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id;
  let resolvedEmail = user.email || profile?.email || null;
  if (!resolvedEmail) {
    try {
      const { data: authData } = await supabase.auth.admin.getUserById(user.id);
      resolvedEmail = authData?.user?.email || null;
      if (resolvedEmail && !profile?.email) {
        await supabase.from('profiles').update({ email: resolvedEmail }).eq('id', user.id);
      }
    } catch {}
  }
  if (!customerId && resolvedEmail) {
    const { data: sibling } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('email', resolvedEmail)
      .not('stripe_customer_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sibling?.stripe_customer_id) {
      customerId = sibling.stripe_customer_id;
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }
  }
  if (!customerId && resolvedEmail) {
    const customers = await stripe.customers.list({ email: resolvedEmail, limit: 5 });
    const best = customers.data.sort((a, b) => (b.created || 0) - (a.created || 0))[0];
    if (best?.id) {
      customerId = best.id;
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }
  }
  if (!customerId) return res.status(200).json({ methods: [], defaultId: null });

  let methodsData;
  try {
    const methods = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
    methodsData = methods.data;
  } catch (err) {
    // If stored customer id is invalid, try to re-sync by email.
    if (user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 5 });
      let best = customers.data.sort((a, b) => (b.created || 0) - (a.created || 0))[0];
      for (const candidate of customers.data) {
        try {
          const methods = await stripe.paymentMethods.list({ customer: candidate.id, type: 'card' });
          if (methods.data.length > 0) {
            best = candidate;
            methodsData = methods.data;
            break;
          }
        } catch {
          continue;
        }
      }
      if (best?.id && !methodsData) {
        customerId = best.id;
        await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
        const methods = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
        methodsData = methods.data;
      }
      if (best?.id && methodsData) {
        customerId = best.id;
        await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
      }
    }
  }

  if ((!methodsData || methodsData.length == 0) && resolvedEmail) {
    const customers = await stripe.customers.list({ email: resolvedEmail, limit: 5 });
    let best = customers.data.sort((a, b) => (b.created || 0) - (a.created || 0))[0];
    for (const candidate of customers.data) {
      try {
        const methods = await stripe.paymentMethods.list({ customer: candidate.id, type: 'card' });
        if (methods.data.length > 0) {
          best = candidate;
          methodsData = methods.data;
          break;
        }
      } catch {
        continue;
      }
    }
    if (best?.id && methodsData) {
      customerId = best.id;
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
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
