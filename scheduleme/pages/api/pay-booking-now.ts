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
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );
}

async function sendNotifyEmail(payload: Record<string, any>) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.NOTIFY_SECRET || '';
  if (!siteUrl || !secret) return;
  await fetch(`${siteUrl}/api/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
    body: JSON.stringify(payload),
  }).catch(() => {});
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
  let { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id, service, status, paid_at, amount_cents, protection_fee_cents, user_id, business_id, scheduled_start, stripe_payment_intent_id, stripe_customer_id, stripe_payment_method_id')
    .eq('id', booking_id)
    .maybeSingle();

  if (bookingErr) {
    const fallback = await supabase
      .from('bookings')
      .select('id, service, status, paid_at, amount_cents, protection_fee_cents, user_id, business_id, scheduled_start, stripe_payment_intent_id, stripe_customer_id, stripe_payment_method_id')
      .eq('id', booking_id)
      .maybeSingle();
    booking = fallback.data as any;
    bookingErr = fallback.error as any;
  }

  if (bookingErr) {
    const fallbackMinimal = await supabase
      .from('bookings')
      .select('id, service, status, paid_at, amount_cents, protection_fee_cents, user_id, business_id, scheduled_start, stripe_payment_intent_id, stripe_customer_id, stripe_payment_method_id')
      .eq('id', booking_id)
      .maybeSingle();
    booking = fallbackMinimal.data as any;
    bookingErr = fallbackMinimal.error as any;
  }

  if (bookingErr) return res.status(500).json({ error: 'Failed to load booking for payment' });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

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
    if (!canAccess && booking.stripe_customer_id) {
      try {
        const customer = await stripe.customers.retrieve(booking.stripe_customer_id);
        const customerEmail = String((customer as any)?.email || '').trim().toLowerCase();
        if (!(customer as any)?.deleted && customerEmail && customerEmail === normalizedEmail) canAccess = true;
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

  let biz: any = null;
  if (booking.business_id) {
    const primaryBiz = await supabase
      .from('businesses')
      .select('id, name, email, owner_email, stripe_account_id, stripe_onboarded, zelle_payout_details, founder50, founder50_status, last_completed_booking_at, away_start, away_end, availability_status, break_until')
      .eq('id', booking.business_id)
      .maybeSingle();
    if (!primaryBiz.error && primaryBiz.data) {
      biz = primaryBiz.data;
    } else {
      const fallbackBiz = await supabase
        .from('businesses')
        .select('id, name, owner_email, stripe_account_id, stripe_onboarded, zelle_payout_details, founder50, founder50_status')
        .eq('id', booking.business_id)
        .maybeSingle();
      if (!fallbackBiz.error && fallbackBiz.data) {
        biz = fallbackBiz.data;
      } else {
        const minimalBiz = await supabase
          .from('businesses')
          .select('id, name, owner_email, stripe_account_id, stripe_onboarded, zelle_payout_details')
          .eq('id', booking.business_id)
          .maybeSingle();
        if (!minimalBiz.error && minimalBiz.data) biz = minimalBiz.data;
      }
    }
  }

  // Web pay flow can still proceed when legacy rows are missing business relation data.
  const feeBusiness: any = biz || {};
  const bizName = String(biz?.name || 'provider');
  const bizId = String(biz?.id || booking.business_id || '');
  const bizEmail =
    typeof biz?.owner_email === 'string' && biz.owner_email.trim()
      ? biz.owner_email
      : (typeof biz?.email === 'string' ? biz.email : null);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, stripe_customer_id, stripe_payment_method_id, stripe_setup_intent_id')
    .eq('id', user.id)
    .maybeSingle();

  // booking.user_id can be legacy/misaligned; always trust authenticated user profile first.
  let customerId = booking.stripe_customer_id || profile?.stripe_customer_id || null;
  let paymentMethodId = booking.stripe_payment_method_id || profile?.stripe_payment_method_id || null;

  if (!customerId && user.email) {
    try {
      const customers = await stripe.customers.list({ email: user.email, limit: 5 });
      if (customers.data?.length) {
        const best = customers.data.sort((a, b) => (b.created || 0) - (a.created || 0))[0];
        if (best?.id) {
          customerId = best.id;
          await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
          await supabase.from('bookings').update({ stripe_customer_id: customerId }).eq('id', booking.id);
        }
      }
    } catch {}
  }

  if (customerId && !paymentMethodId) {
    // Try recently created SetupIntent path first (card just added on pay page).
    try {
      const setupIntentId = profile?.stripe_setup_intent_id;
      if (setupIntentId) {
        const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
        const pm = (setupIntent as any)?.payment_method;
        if (typeof pm === 'string' && pm) paymentMethodId = pm;
      }
    } catch {}
  }

  if (customerId && !paymentMethodId) {
    // Fallback to Stripe customer default / first available card.
    try {
      const customer = await stripe.customers.retrieve(customerId);
      const defaultPm = (customer as any)?.invoice_settings?.default_payment_method;
      if (typeof defaultPm === 'string' && defaultPm) paymentMethodId = defaultPm;
    } catch {}
  }

  if (customerId && !paymentMethodId) {
    try {
      const methods = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 10 });
      if (methods.data?.length) {
        paymentMethodId = methods.data[0].id;
      }
    } catch {}
  }

  if (paymentMethodId) {
    // Persist resolved PM for future payments.
    await supabase
      .from('profiles')
      .update({ stripe_payment_method_id: paymentMethodId })
      .eq('id', user.id);
    await supabase
      .from('bookings')
      .update({ stripe_payment_method_id: paymentMethodId })
      .eq('id', booking.id);
  }

  if (!customerId || !paymentMethodId) {
    return res.status(400).json({ error: 'Save a payment method before paying.' });
  }

  const platformFeePercent = getPlatformFeePercent(feeBusiness);
  if (!assertPlatformFeePercent(feeBusiness, platformFeePercent)) {
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
      description: `ScheduleMe booking: ${booking.service || 'Service'} with ${bizName}`,
      metadata: {
        bookingId: booking.id,
        businessId: bizId,
        service: booking.service || '',
        business_name: bizName,
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
        status: 'paid',
        protection_fee_cents: protectionFeeCents,
        stripe_payment_intent_id: pi.id,
        stripe_customer_id: customerId,
        stripe_payment_method_id: paymentMethodId,
      })
      .eq('id', booking.id);

  const amountDollars = (totalChargeCents / 100).toFixed(2);
  const userMeta = (user as any)?.user_metadata || {};
  const customerDisplayName =
    userMeta?.full_name || userMeta?.name || user.email?.split('@')[0] || 'there';
  if (user.email) {
      await sendNotifyEmail({
        type: 'payment_receipt_customer',
        to: user.email,
        name: customerDisplayName,
        service: booking.service || 'Service',
        businessName: bizName || 'Your provider',
        amountDollars,
        scheduledAt: booking.scheduled_start || undefined,
        bookingId: booking.id,
      });
    }
    if (bizEmail) {
      await sendNotifyEmail({
        type: 'payment_notification_business',
        to: bizEmail,
        businessName: bizName || 'Your business',
        customerName: customerDisplayName || user.email || 'A customer',
        service: booking.service || 'Service',
        amountDollars,
        platformFeePercent,
        payoutDollars: (Math.max(0, booking.amount_cents - platformFeeCents - protectionFeeCents) / 100).toFixed(2),
        bookingId: booking.id,
        stripeOnboarded: !!biz?.stripe_onboarded,
        zellePayoutDetails: biz?.zelle_payout_details || '',
      });

      const isCustomService = String(booking.service || '').toLowerCase().includes('custom');
      if (!isCustomService) {
        await sendNotifyEmail({
          type: 'new_booking_business',
          to: bizEmail,
          name: bizName || 'Your business',
          service: booking.service || 'Service',
          customerName: customerDisplayName || user.email || 'A customer',
          bookingId: booking.id,
        });
      }
    }

    return res.status(200).json({ ok: true, booking_id: booking.id, payment_intent_id: pi.id });
  } catch (e: any) {
    const raw = e?.raw || {};
    const msg = raw?.message || e?.message || 'Payment failed';
    return res.status(400).json({ error: msg });
  }
}
