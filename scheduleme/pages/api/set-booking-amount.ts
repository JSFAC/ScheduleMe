// @ts-nocheck
// pages/api/set-booking-amount.ts
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
  if (!booking_id || !isValidUuid(booking_id)) return res.status(400).json({ error: 'Valid booking_id required' });
  const cents = Number(amount_cents);
  if (!Number.isFinite(cents) || cents < 100 || cents > 500000) return res.status(400).json({ error: 'Invalid amount' });

  const sb = getSupabase();

  // Get booking (two-step to avoid FK join issues)
  const { data: booking, error: bErr } = await sb
    .from('bookings')
    .select('id, status, user_id, business_id, businesses(owner_email, stripe_onboarded, stripe_account_id, name)')
    .eq('id', booking_id)
    .in('status', ['pending', 'confirmed', 'payment_pending', 'price_disputed'])
    .maybeSingle();

  if (bErr || !booking) return res.status(404).json({ error: 'Booking not found' });

  const biz = booking.businesses;
  if (!biz || biz.owner_email !== user.email) return res.status(403).json({ error: 'Access denied' });

  // Ensure business has Stripe connected
  if (!biz?.stripe_onboarded || !biz?.stripe_account_id) {
    return res.status(400).json({ error: 'Business has not connected their bank account yet' });
  }

  // Update the amount
  const { error: uErr } = await sb
    .from('bookings')
    .update({
      amount_cents: cents,
      status: 'payment_pending',
      dispute_amount_cents: null,
      dispute_note: null,
      dispute_at: null,
    })
    .eq('id', booking_id);

  if (uErr) {
    const msg = uErr.message || '';
    if (msg.includes('dispute_amount_cents') || msg.includes('dispute_note') || msg.includes('dispute_at')) {
      const { error: fbErr } = await sb
        .from('bookings')
        .update({ amount_cents: cents, status: 'payment_pending' })
        .eq('id', booking_id);
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
    }
  } catch (e) {
    // Non-fatal
  }

  return res.status(200).json({ ok: true, status: 'payment_pending', amount_cents: cents });
}
