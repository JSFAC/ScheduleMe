// @ts-nocheck
// pages/api/set-booking-amount.ts
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';
import { PROTECTION_FEE_CENTS } from '../../lib/fees';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req, res) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'set-booking-amount' }))) return;
  const user = await requireAuth(req, res);
  if (!user) return;

  const { booking_id, amount_cents } = req.body;
  const bookingId = typeof booking_id === 'string' ? booking_id.trim() : booking_id;
  if (!bookingId || !isValidUuid(bookingId)) return res.status(400).json({ error: 'Valid booking_id required' });
  const cents = Number(amount_cents);
  if (!Number.isFinite(cents) || cents < 500 || cents > 500000) return res.status(400).json({ error: 'Invalid amount' });

  const sb = getSupabase();

  const missingCol = (err: any) => {
    const msg = err?.message || '';
    return (
      msg.includes('customer_proposed_price_cents') ||
      msg.includes('provider_proposed_price_cents') ||
      msg.includes('price_accepted_by_provider') ||
      msg.includes('price_accepted_by_customer') ||
      msg.includes('price_accepted_at')
    );
  };

  // Get booking (two-step to avoid FK join issues)
  let { data: booking, error: bErr } = await sb
    .from('bookings')
    .select('id, status, user_id, business_id, customer_proposed_price_cents, businesses(owner_id, owner_email, stripe_onboarded, stripe_account_id, name)')
    .eq('id', bookingId)
    .maybeSingle();

  if ((bErr && missingCol(bErr)) || !booking) {
    // Retry without the new columns (older schema)
    const { data: retry, error: rErr } = await sb
      .from('bookings')
      .select('id, status, user_id, business_id')
      .eq('id', bookingId)
      .maybeSingle();
    if (!rErr && retry) {
      booking = retry;
      bErr = null;
    }
  }

  if (bErr || !booking) {
    const { data: fallback, error: fbErr } = await sb
      .from('bookings')
      .select('id, status, user_id, business_id, customer_proposed_price_cents')
      .eq('id', bookingId)
      .maybeSingle();
    if ((fbErr && missingCol(fbErr)) || !fallback) {
      const { data: fbRetry, error: fbRetryErr } = await sb
        .from('bookings')
        .select('id, status, user_id, business_id')
        .eq('id', bookingId)
        .maybeSingle();
      if (fbRetryErr || !fbRetry) return res.status(404).json({ error: 'Booking not found' });
      booking = fbRetry;
    } else {
      booking = fallback;
    }
    if (!['pending', 'confirmed', 'payment_pending', 'price_disputed', 'disputed'].includes(booking.status)) {
      return res.status(400).json({ error: 'Booking status not eligible for pricing' });
    }
    const { data: bizRow, error: bizErr } = await sb
      .from('businesses')
      .select('owner_id, owner_email, stripe_onboarded, stripe_account_id, name')
      .eq('id', booking.business_id)
      .maybeSingle();
    if (bizErr || !bizRow) return res.status(404).json({ error: 'Business not found' });
    booking = { ...booking, businesses: bizRow };
  }

  if (!['pending', 'confirmed', 'payment_pending', 'price_disputed', 'disputed'].includes(booking.status)) {
    return res.status(400).json({ error: 'Booking status not eligible for pricing' });
  }

  const biz = booking.businesses;
  const normalizedUserEmail = String(user.email || '').toLowerCase().trim();
  const normalizedOwnerEmail = String((biz as any)?.owner_email || '').toLowerCase().trim();
  const isOwner =
    !!biz
    && (
      biz.owner_id === user.id
      || (!!normalizedUserEmail && normalizedOwnerEmail === normalizedUserEmail)
    );
  if (!isOwner) return res.status(403).json({ error: 'Access denied' });

  // Ensure business has Stripe connected
  if (!biz?.stripe_onboarded || !biz?.stripe_account_id) {
    return res.status(400).json({ error: 'Business has not connected their bank account yet' });
  }

  // Update the amount
  const acceptsCustomerPrice = Number.isFinite(booking.customer_proposed_price_cents)
    && booking.customer_proposed_price_cents > 0
    && cents === booking.customer_proposed_price_cents;
  const nextStatus = acceptsCustomerPrice ? 'payment_pending' : 'price_disputed';
  const acceptedAt = acceptsCustomerPrice ? new Date().toISOString() : null;
  const { error: uErr } = await sb
    .from('bookings')
    .update({
      amount_cents: cents,
      protection_fee_cents: PROTECTION_FEE_CENTS,
      status: nextStatus,
      dispute_amount_cents: acceptsCustomerPrice ? null : cents,
      dispute_note: null,
      dispute_at: null,
      provider_proposed_price_cents: acceptsCustomerPrice ? null : cents,
      price_accepted_by_provider: !!acceptsCustomerPrice,
      price_accepted_by_customer: false,
      price_accepted_at: acceptedAt,
    })
    .eq('id', bookingId);

  if (uErr) {
    const msg = uErr.message || '';
    if (msg.includes('dispute_amount_cents') || msg.includes('dispute_note') || msg.includes('dispute_at') || msg.includes('provider_proposed_price_cents') || msg.includes('price_accepted_by_provider') || msg.includes('price_accepted_by_customer') || msg.includes('price_accepted_at') || msg.includes('protection_fee_cents')) {
      const fallbackPayload: any = { amount_cents: cents, status: nextStatus };
      if (!msg.includes('protection_fee_cents')) fallbackPayload.protection_fee_cents = PROTECTION_FEE_CENTS;
      const { error: fbErr } = await sb
        .from('bookings')
        .update(fallbackPayload)
        .eq('id', bookingId);
      if (fbErr) return res.status(500).json({ error: fbErr.message || 'Failed to update booking' });
    } else {
      return res.status(500).json({ error: msg });
    }
  }

  // Try to send notification email (optional — don't fail if it errors)
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';
    const secret = process.env.NOTIFY_SECRET || '';
    const { data: profile } = await sb.from('profiles').select('email, name').eq('id', booking.user_id).maybeSingle();
    if (profile?.email) {
      if (acceptsCustomerPrice) {
        await fetch(siteUrl + '/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
          body: JSON.stringify({
            type: 'provider_accepted_customer_price',
            to: profile.email,
            name: profile.name || 'there',
            service: 'Custom Request',
            businessName: biz?.name || 'Your provider',
            amountDollars: (cents / 100).toFixed(2),
            bookingId: booking.id,
          }),
        }).catch(() => {});
        await fetch(siteUrl + '/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
          body: JSON.stringify({
            type: 'payment_request_customer',
            to: profile.email,
            name: profile.name || 'there',
            service: 'Custom Request',
            businessName: biz?.name || 'Your provider',
            amountDollars: (cents / 100).toFixed(2),
            bookingId: booking.id,
          }),
        });
      } else {
        await fetch(siteUrl + '/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
          body: JSON.stringify({
            type: 'status_update',
            to: profile.email,
            name: profile.name || 'there',
            service: 'Custom Request',
            status: 'price_disputed',
            businessName: biz?.name || 'Your provider',
          }),
        }).catch(() => {});
      }
    }
  } catch (e) {
    // Non-fatal
  }

  return res.status(200).json({
    ok: true,
    status: nextStatus,
    amount_cents: cents,
    price_accepted_by_provider: !!acceptsCustomerPrice,
    provider_proposed_price_cents: acceptsCustomerPrice ? null : cents,
    price_accepted_at: acceptedAt,
  });
}
