// pages/api/attach-payment-method.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import stripe from '../../lib/stripe';
import { setSecurityHeaders, rateLimit, requireAuth } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 20, windowMs: 60_000, keyPrefix: 'attach-payment' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const paymentMethodId = req.body?.payment_method_id as string | undefined;
  if (!paymentMethodId) return res.status(400).json({ error: 'Missing payment_method_id' });

  const supabase = getSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id as string | null;
  if (!customerId) {
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
    const customer = await stripe.customers.create({
      email: resolvedEmail || undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  try {
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    await supabase.from('profiles').update({ stripe_payment_method_id: paymentMethodId }).eq('id', user.id);
    return res.status(200).json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to attach payment method' });
  }
}
