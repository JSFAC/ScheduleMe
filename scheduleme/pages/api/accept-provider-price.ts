// @ts-nocheck
// pages/api/accept-provider-price.ts
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
  if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'accept-provider-price' }))) return;
  const user = await requireAuth(req, res);
  if (!user) return;

  const { booking_id } = req.body || {};
  if (!booking_id || !isValidUuid(booking_id)) return res.status(400).json({ error: 'Valid booking_id required' });

  const sb = getSupabase();
  const { data: booking, error: bErr } = await sb
    .from('bookings')
    .select('id, status, user_id, amount_cents, provider_proposed_price_cents, businesses(owner_email, name)')
    .eq('id', booking_id)
    .maybeSingle();

  if (bErr || !booking) return res.status(404).json({ error: 'Booking not found' });
  if (!booking.amount_cents) return res.status(400).json({ error: 'Price has not been set yet' });

  let canAccess = booking.user_id === user.id;
  if (!canAccess && user.email) {
    const { data: profile } = await sb.from('profiles').select('id').eq('email', user.email).maybeSingle();
    if (profile?.id && booking.user_id === profile.id) canAccess = true;
    if (!canAccess) {
      try {
        const { data: legacyUser } = await sb.from('users').select('id').eq('email', user.email).maybeSingle();
        if (legacyUser?.id && booking.user_id === legacyUser.id) canAccess = true;
      } catch {}
    }
  }
  if (!canAccess) return res.status(403).json({ error: 'Access denied' });

  const acceptedAt = new Date().toISOString();
  const { error: uErr } = await sb
    .from('bookings')
    .update({ price_accepted_by_customer: true, price_accepted_at: acceptedAt })
    .eq('id', booking_id);
  if (uErr) return res.status(500).json({ error: uErr.message || 'Failed to accept price' });

  // Notify business owner
  try {
    const biz = booking.businesses;
    if (biz?.owner_email) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';
      const secret = process.env.NOTIFY_SECRET || '';
      await fetch(siteUrl + '/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
        body: JSON.stringify({
          type: 'customer_accepted_provider_price',
          to: biz.owner_email,
          businessName: biz.name || 'Your business',
          amountDollars: (booking.amount_cents / 100).toFixed(2),
          bookingId: booking.id,
        }),
      }).catch(() => {});
    }
  } catch {}

  return res.status(200).json({ ok: true, price_accepted_at: acceptedAt });
}
