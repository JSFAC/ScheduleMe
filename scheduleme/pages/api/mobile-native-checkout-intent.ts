// @ts-nocheck
// pages/api/mobile-native-checkout-intent.ts
// Creates a native Stripe PaymentIntent for iOS PaymentSheet + Apple Pay.
// Important: this endpoint does NOT create a booking row.
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import stripe from '../../lib/stripe';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';
import { loadProviderPayoutStage } from '../../lib/providerPayoutStage';

const PROTECTION_FEE_CENTS = 99;
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );
}

function cleanText(value: unknown, max = 300): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function toSafeInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 20, windowMs: 60_000, keyPrefix: 'mobile-native-pi' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const {
    business_id,
    service,
    user_name,
    user_phone,
    user_email,
    note,
    scheduled_start,
    scheduled_end,
    timezone,
    service_price_cents,
    protection_fee_cents,
    source,
  } = req.body || {};

  if (!business_id || !isValidUuid(business_id)) {
    return res.status(400).json({ error: 'Valid business_id is required.' });
  }

  const safeService = cleanText(service, 180) || 'Service Booking';
  const safeUserName = cleanText(user_name, 120) || 'Customer';
  const safeUserPhone = cleanText(user_phone, 40) || '';
  const safeUserEmail = cleanText(user_email, 180) || user.email || '';
  const safeNote = cleanText(note, 2000);
  const safeTimezone = cleanText(timezone, 80) || 'UTC';
  const safeSource = cleanText(source, 60) || 'ios-native';

  const serviceAmountCents = toSafeInt(service_price_cents, 0);
  if (serviceAmountCents < 100) {
    return res.status(400).json({ error: 'Invalid service amount.' });
  }
  const protectionFee = Math.max(0, toSafeInt(protection_fee_cents, PROTECTION_FEE_CENTS));
  const totalAmount = serviceAmountCents + protectionFee;
  const supabase = getSupabase();
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, stripe_account_id, stripe_onboarded, zelle_payout_details, availability_status')
    .eq('id', business_id)
    .maybeSingle();

  if (!business) {
    return res.status(404).json({ error: 'Provider not found.' });
  }
  const availabilityStatus = String((business as any).availability_status || '').trim().toLowerCase();
  if (availabilityStatus && availabilityStatus !== 'open') {
    return res.status(409).json({ error: `Provider is currently ${availabilityStatus} and not accepting bookings.` });
  }
  const payoutStage = await loadProviderPayoutStage(supabase, business as any);
  if (payoutStage?.stage === 'payout_setup_required') {
    return res.status(409).json({
      error: 'This provider needs to set up Stripe or Zelle before accepting bookings.',
      code: 'provider_payout_setup_required',
      provider_payout_stage: payoutStage,
    });
  }
  if (payoutStage?.requiresStripeForNewBookings) {
    return res.status(409).json({
      error: 'This provider must connect Stripe before accepting additional instant bookings.',
      code: 'provider_stripe_required',
      provider_payout_stage: payoutStage,
    });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      receipt_email: safeUserEmail || undefined,
      description: `${safeService} • ${business.name || 'ScheduleMe provider'}`,
      metadata: {
        source: safeSource,
        booking_pending_create: '1',
        business_id: String(business.id),
        business_name: String(business.name || ''),
        user_id: String(user.id),
        user_email: safeUserEmail,
        user_name: safeUserName,
        user_phone: safeUserPhone,
        service: safeService,
        note: safeNote || '',
        scheduled_start: cleanText(scheduled_start, 80) || '',
        scheduled_end: cleanText(scheduled_end, 80) || '',
        timezone: safeTimezone,
        service_amount_cents: String(serviceAmountCents),
        protection_fee_cents: String(protectionFee),
        total_amount_cents: String(totalAmount),
        hold_in_platform: 'true',
      },
    });

    return res.status(200).json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
    });
  } catch (error: any) {
    console.error('[mobile-native-checkout-intent]', error);
    return res.status(500).json({ error: error?.message || 'Secure checkout is temporarily unavailable.' });
  }
}
