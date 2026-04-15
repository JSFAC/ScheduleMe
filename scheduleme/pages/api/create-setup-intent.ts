// @ts-nocheck
// pages/api/create-setup-intent.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import stripe from '../../lib/stripe';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';
import { getPlatformFeePercent, assertPlatformFeePercent } from '../../lib/platformFees';

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
  if (!(await rateLimit(req, res, { max: 15, windowMs: 60_000, keyPrefix: 'setup-intent' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { booking_id, force_new } = req.body || {};
  if (!booking_id || !isValidUuid(booking_id)) return res.status(400).json({ error: 'Valid booking_id required' });

  const supabase = getSupabase();
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id, status, user_id, business_id, amount_cents')
    .eq('id', booking_id)
    .maybeSingle();

  if (bookingErr) return res.status(500).json({ error: 'Failed to load booking' });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const allowedStatuses = new Set(['pending', 'confirmed', 'payment_pending']);
  if (!allowedStatuses.has(String(booking.status || '')))
    return res.status(400).json({ error: 'Booking must be pending, payment_pending, or confirmed before saving a card' });

  // Ensure caller is the booking owner (by auth id or email)
  let canAccess = booking.user_id === user.id;
  if (!canAccess && user.email) {
    const normalizedEmail = user.email.trim().toLowerCase();
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', normalizedEmail)
      .limit(20);
    if ((profile || []).some((p: any) => p?.id && p.id === booking.user_id)) canAccess = true;
    if (!canAccess) {
      try {
        const { data: legacyUsers } = await supabase
          .from('users')
          .select('id')
          .ilike('email', normalizedEmail)
          .limit(20);
        if ((legacyUsers || []).some((u: any) => u?.id && u.id === booking.user_id)) canAccess = true;
      } catch {}
    }
  }
  if (!canAccess) return res.status(403).json({ error: 'Access denied (not booking owner)' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, stripe_payment_method_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!force_new && profile?.stripe_payment_method_id) {
    await supabase
      .from('bookings')
      .update({
        stripe_payment_method_id: profile.stripe_payment_method_id,
        stripe_customer_id: profile.stripe_customer_id || null,
      })
      .eq('id', booking_id);
    return res.status(200).json({ already_saved: true });
  }

  let biz: any = null;
  if (booking.business_id) {
    const { data: fallbackBiz } = await supabase
      .from('businesses')
      .select('id, stripe_account_id, stripe_onboarded, name, founder50, founder50_status, last_completed_booking_at, away_start, away_end, availability_status, break_until')
      .eq('id', booking.business_id)
      .maybeSingle();
    if (fallbackBiz) biz = fallbackBiz;
  }

  const amountCents = booking.amount_cents;
  if (!amountCents || amountCents < 100)
    return res.status(400).json({ error: 'Payment amount not set for this booking.' });

  // Ensure customer exists
  let customerId = profile?.stripe_customer_id as string | null;
  if (!customerId) {
    const email = user.email || undefined;
    const customer = await stripe.customers.create({
      email,
      metadata: { bookingId: booking_id, businessId: String(biz?.id || booking.business_id || ''), userId: user.id },
    });
    customerId = customer.id;
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const feeBusiness = biz || {};
  const platformFeePercent = getPlatformFeePercent(feeBusiness);
  if (!assertPlatformFeePercent(feeBusiness, platformFeePercent)) {
    return res.status(400).json({ error: 'Platform fee mismatch. Please contact support.' });
  }
  const platformFeeCents = Math.round(amountCents * platformFeePercent / 100);

  try {
    const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    usage: 'off_session',
    metadata: { bookingId: booking_id, businessId: String(biz?.id || booking.business_id || ''), userId: user.id, amount_cents: String(amountCents), platform_fee_cents: String(platformFeeCents), platform_fee_percent: String(platformFeePercent) },
  });

  await supabase.from('profiles').update({ stripe_setup_intent_id: setupIntent.id }).eq('id', user.id);

    return res.status(200).json({ client_secret: setupIntent.client_secret });
  } catch (e: any) {
    console.error('[create-setup-intent] stripe error', e);
    return res.status(500).json({ error: e?.message || 'Stripe setup failed' });
  }
}
