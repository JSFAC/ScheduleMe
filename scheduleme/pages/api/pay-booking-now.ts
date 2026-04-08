// @ts-nocheck
// pages/api/pay-booking-now.ts — Charge a booking immediately (consumer-initiated)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import stripe from '../../lib/stripe';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';
import { getPlatformFeePercent, assertPlatformFeePercent } from '../../lib/platformFees';
import { PROTECTION_FEE_CENTS } from '../../lib/fees';

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
  if (!(await rateLimit(req, res, { max: 20, windowMs: 60_000, keyPrefix: 'pay-booking-now' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { booking_id } = req.body || {};
  if (!booking_id || !isValidUuid(booking_id)) return res.status(400).json({ error: 'Valid booking_id required' });

  const supabase = getSupabase();
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, service, status, paid_at, amount_cents, protection_fee_cents, user_id, business_id, stripe_payment_intent_id, stripe_customer_id, stripe_payment_method_id, businesses(id, name, stripe_account_id, stripe_onboarded, founder50, founder50_status, last_completed_booking_at, away_start, away_end, availability_status, break_until)')
    .eq('id', booking_id)
    .maybeSingle();

  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  let canAccess = booking.user_id === user.id;
  if (!canAccess && user.email) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();
    if (profile?.id && booking.user_id === profile.id) canAccess = true;
    if (!canAccess) {
      try {
        const { data: legacyUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        if (legacyUser?.id && booking.user_id === legacyUser.id) canAccess = true;
      } catch {}
    }
  }
  if (!canAccess) return res.status(403).json({ error: 'Access denied' });

  if (booking.paid_at || booking.status === 'paid') {
    return res.status(200).json({ ok: true, already_paid: true, booking_id: booking.id });
  }

  if (!booking.amount_cents || booking.amount_cents < 100) {
    return res.status(400).json({ error: 'Payment amount is not set for this booking.' });
  }

  const biz = booking.businesses as any;
  if (!biz?.stripe_onboarded || !biz?.stripe_account_id) {
    return res.status(400).json({ error: 'Business is not ready to accept online payments yet.' });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, stripe_payment_method_id')
    .eq('id', booking.user_id || user.id)
    .maybeSingle();

  const customerId = booking.stripe_customer_id || profile?.stripe_customer_id || null;
  const paymentMethodId = booking.stripe_payment_method_id || profile?.stripe_payment_method_id || null;
  if (!customerId || !paymentMethodId) {
    return res.status(400).json({ error: 'Save a payment method before paying.' });
  }

  const platformFeePercent = getPlatformFeePercent(biz);
  if (!assertPlatformFeePercent(biz, platformFeePercent)) {
    return res.status(400).json({ error: 'Platform fee mismatch. Please contact support.' });
  }
  const platformFeeCents = Math.round(booking.amount_cents * platformFeePercent / 100);
  const protectionFeeCents = typeof booking.protection_fee_cents === 'number' ? booking.protection_fee_cents : PROTECTION_FEE_CENTS;
  const totalChargeCents = booking.amount_cents + protectionFeeCents;

  try {
    const pi = await stripe.paymentIntents.create({
      amount: totalChargeCents,
      currency: 'usd',
      customer: customerId,
      receipt_email: user.email || undefined,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,
      description: `ScheduleMe booking: ${booking.service || 'Service'} with ${biz.name || 'provider'}`,
      metadata: {
        bookingId: booking.id,
        businessId: biz.id,
        service: booking.service || '',
        business_name: biz.name || '',
        flow: 'upfront_pay_page',
        hold_in_platform: 'true',
        platform_fee_percent: String(platformFeePercent),
        platform_fee_cents: String(platformFeeCents),
        protection_fee_cents: String(protectionFeeCents),
      },
    }, {
      idempotencyKey: `booking_${booking.id}_upfront_charge_v1`,
    });

    if (pi.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment was not completed. Please try another card.' });
    }

    await supabase
      .from('bookings')
      .update({
        paid_at: new Date().toISOString(),
        protection_fee_cents: protectionFeeCents,
        stripe_payment_intent_id: pi.id,
        stripe_customer_id: customerId,
        stripe_payment_method_id: paymentMethodId,
      })
      .eq('id', booking.id);

    return res.status(200).json({ ok: true, booking_id: booking.id, payment_intent_id: pi.id });
  } catch (e: any) {
    const raw = e?.raw || {};
    const msg = raw?.message || e?.message || 'Payment failed';
    return res.status(400).json({ error: msg });
  }
}
