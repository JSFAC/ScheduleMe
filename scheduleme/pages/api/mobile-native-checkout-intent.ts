// @ts-nocheck
// pages/api/mobile-native-checkout-intent.ts
// Creates a native Stripe PaymentIntent for iOS PaymentSheet + Apple Pay.
// Important: this endpoint does NOT create a booking row.
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import stripe from '../../lib/stripe';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';

const PROTECTION_FEE_CENTS = 99;
const PLATFORM_FEE_PERCENT = 12;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
  const applicationFee = Math.round(serviceAmountCents * PLATFORM_FEE_PERCENT / 100) + protectionFee;

  const supabase = getSupabase();
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, stripe_account_id, stripe_onboarded')
    .eq('id', business_id)
    .maybeSingle();

  if (!business) {
    return res.status(404).json({ error: 'Provider not found.' });
  }
  if (!business.stripe_onboarded || !business.stripe_account_id) {
    return res.status(400).json({ error: "This provider can't accept payments yet." });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      application_fee_amount: applicationFee,
      transfer_data: { destination: business.stripe_account_id },
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
