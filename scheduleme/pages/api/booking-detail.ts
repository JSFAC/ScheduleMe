// pages/api/booking-detail.ts
// Returns one booking for the authenticated customer (secure, minimal payload for pay page)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'booking-detail' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const bookingId = typeof req.query.booking_id === 'string' ? req.query.booking_id : '';
  if (!isValidUuid(bookingId)) return res.status(400).json({ error: 'Invalid booking_id' });

  try {
    const supabase = getSupabase();
    let { data, error } = await supabase
      .from('bookings')
      .select('id, user_id, business_id, service, status, created_at, note, notes, scheduled_start, scheduled_end, amount_cents, protection_fee_cents, paid_at, stripe_payment_method_id, businesses(name)')
      .eq('id', bookingId)
      .maybeSingle();

    // Backward-compat fallback for DBs missing newer columns.
    if (error) {
      const fallback = await supabase
        .from('bookings')
        .select('id, user_id, business_id, service, status, created_at, notes, scheduled_start, scheduled_end, amount_cents, paid_at, stripe_payment_method_id, businesses(name)')
        .eq('id', bookingId)
        .maybeSingle();
      data = fallback.data as any;
      error = fallback.error as any;
    }

    if (error || !data) return res.status(404).json({ error: 'Booking not found' });

    let canAccess = data.user_id === user.id;
    if (!canAccess && user.email) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();
      if (profile?.id && data.user_id === profile.id) canAccess = true;
      if (!canAccess) {
        try {
          const { data: legacyUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();
          if (legacyUser?.id && data.user_id === legacyUser.id) canAccess = true;
        } catch {}
      }
    }
    if (!canAccess) return res.status(403).json({ error: 'Access denied' });

    const booking = {
      ...data,
      business_name: (data as any)?.businesses?.name || null,
      businesses: undefined,
      note: data.note ?? data.notes ?? null,
    };

    return res.status(200).json({ booking });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
