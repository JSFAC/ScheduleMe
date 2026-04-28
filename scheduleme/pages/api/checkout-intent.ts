// pages/api/checkout-intent.ts
// iOS Apple Pay flow: payment-first checkout session (no booking row created here)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import stripe from '../../lib/stripe';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid, isValidEmail } from '../../lib/apiSecurity';
import { PROTECTION_FEE_CENTS } from '../../lib/fees';
import { loadProviderPayoutStage } from '../../lib/providerPayoutStage';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );
}

function toIso(input: unknown): string | null {
  if (typeof input !== 'string' || !input.trim()) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 20, windowMs: 60_000, keyPrefix: 'checkout-intent' }))) return;

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

  if (!business_id || !isValidUuid(business_id)) return res.status(400).json({ error: 'Valid business_id required' });
  if (typeof service !== 'string' || !service.trim()) return res.status(400).json({ error: 'service required' });
  if (!isValidEmail(user_email)) return res.status(400).json({ error: 'Valid user_email required' });
  if (typeof service_price_cents !== 'number' || !Number.isFinite(service_price_cents) || service_price_cents < 500) {
    return res.status(400).json({ error: 'service_price_cents must be at least 500' });
  }
  if (source !== 'ios-apple-pay') return res.status(400).json({ error: 'Invalid source' });

  const normalizedUserEmail = String(user.email || '').trim().toLowerCase();
  const normalizedPayloadEmail = String(user_email || '').trim().toLowerCase();
  if (normalizedUserEmail && normalizedPayloadEmail && normalizedUserEmail !== normalizedPayloadEmail) {
    return res.status(403).json({ error: 'Authenticated user does not match user_email' });
  }

  const startIso = toIso(scheduled_start);
  if (!startIso) return res.status(400).json({ error: 'Valid scheduled_start required' });
  const endIso = toIso(scheduled_end);
  const safeProtectionFee = typeof protection_fee_cents === 'number' && Number.isFinite(protection_fee_cents)
    ? Math.max(0, Math.round(protection_fee_cents))
    : PROTECTION_FEE_CENTS;
  const serviceAmount = Math.round(service_price_cents);
  const totalAmount = serviceAmount + safeProtectionFee;
  if (totalAmount < 500) return res.status(400).json({ error: 'Total amount must be at least 500 cents' });

  const supabase = getSupabase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';
  const safeService = String(service || '').trim().slice(0, 120) || 'Service Booking';
  const safeUserName = String(user_name || '').trim().slice(0, 100) || 'Customer';
  const safeUserPhone = String(user_phone || '').trim().slice(0, 40);
  const safeNote = String(note || '').trim().slice(0, 1000);
  const safeTimezone = String(timezone || 'America/Los_Angeles').trim().slice(0, 60) || 'America/Los_Angeles';

  const { data: biz } = await supabase
    .from('businesses')
    .select('id, name, stripe_account_id, stripe_onboarded, owner_id')
    .eq('id', business_id)
    .maybeSingle();
  if (!biz) return res.status(404).json({ error: 'Business not found' });
  const payoutStage = await loadProviderPayoutStage(supabase, biz as any);
  if (payoutStage?.requiresStripeForNewBookings) {
    return res.status(409).json({
      error: 'This provider must connect Stripe before accepting additional instant bookings.',
      code: 'provider_stripe_required',
      provider_payout_stage: payoutStage,
    });
  }
  if (biz.owner_id && biz.owner_id === user.id) {
    return res.status(403).json({ error: 'You cannot book your own business.' });
  }

  // Prevent obvious duplicate slot collisions before payment starts.
  const startMs = new Date(startIso).getTime();
  const windowStart = new Date(startMs - 59 * 60 * 1000).toISOString();
  const windowEnd = new Date(startMs + 59 * 60 * 1000).toISOString();
  const { data: conflicts } = await supabase
    .from('bookings')
    .select('id')
    .eq('business_id', business_id)
    .not('status', 'in', '(cancelled,completed,payment_failed)')
    .gte('scheduled_start', windowStart)
    .lte('scheduled_start', windowEnd)
    .limit(1);
  if ((conflicts || []).length > 0) {
    return res.status(409).json({ error: 'That time slot is no longer available. Please pick another time.' });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_creation: 'always',
    success_url: `${siteUrl}/bookings?applepay=success`,
    cancel_url: `${siteUrl}/bookings?applepay=cancelled`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          product_data: { name: safeService },
          unit_amount: serviceAmount,
        },
      },
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          product_data: { name: 'ScheduleMe Protection Fee' },
          unit_amount: safeProtectionFee,
        },
      },
    ],
    customer_email: normalizedPayloadEmail,
    metadata: {
      source: 'ios-apple-pay',
      business_id: String(business_id),
      user_id: String(user.id),
      booking_pending_create: '1',
      business_name: String(biz.name || ''),
      user_name: safeUserName,
      user_phone: safeUserPhone,
      user_email: normalizedPayloadEmail,
      service: safeService,
      note: safeNote,
      scheduled_start: startIso,
      scheduled_end: endIso || '',
      timezone: safeTimezone,
      service_price_cents: String(serviceAmount),
      service_amount_cents: String(serviceAmount),
      protection_fee_cents: String(safeProtectionFee),
      total_amount_cents: String(totalAmount),
    },
    payment_intent_data: {
      metadata: {
        source: 'ios-apple-pay',
        business_id: String(business_id),
        business_name: String(biz.name || ''),
        user_id: String(user.id),
        booking_pending_create: '1',
        user_name: safeUserName,
        user_phone: safeUserPhone,
        user_email: normalizedPayloadEmail,
        service: safeService,
        note: safeNote,
        scheduled_start: startIso,
        scheduled_end: endIso || '',
        timezone: safeTimezone,
        service_amount_cents: String(serviceAmount),
        protection_fee_cents: String(safeProtectionFee),
        total_amount_cents: String(totalAmount),
      },
    },
  });

  if (!session.url) return res.status(500).json({ error: 'Failed to create checkout session' });
  return res.status(200).json({ url: session.url });
}
