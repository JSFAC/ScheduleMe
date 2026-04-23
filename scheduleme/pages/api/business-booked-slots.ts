// pages/api/business-booked-slots.ts
// Service-role slot occupancy lookup for booking calendar (bypasses RLS)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, isValidUuid } from '../../lib/apiSecurity';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    setSecurityHeaders(res);
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    if (!(await rateLimit(req, res, { max: 120, windowMs: 60_000, keyPrefix: 'booked-slots' }))) return;

    const businessId = typeof req.query.business_id === 'string' ? req.query.business_id : '';
    const fromIso = typeof req.query.from === 'string' ? req.query.from : '';
    const toIso = typeof req.query.to === 'string' ? req.query.to : '';
    if (!isValidUuid(businessId)) return res.status(400).json({ error: 'Invalid business_id' });
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ error: 'Invalid from/to range' });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('bookings')
      .select('id, status, service, paid_at, scheduled_start, scheduled_end')
      .eq('business_id', businessId)
      .in('status', ['pending', 'confirmed', 'active', 'payment_pending', 'paid', 'awaiting_consumer_confirmation', 'completed', 'disputed'])
      .limit(500);

    if (error) return res.status(500).json({ error: 'Failed to fetch booked slots' });

    const shouldReserveSlot = (row: any): boolean => {
      const status = String(row?.status || '').toLowerCase();
      const service = String(row?.service || '').toLowerCase();
      const isCustomFlow = service.includes('custom');
      const isPaidOrConfirmed =
        Boolean(row?.paid_at) ||
        ['paid', 'confirmed', 'active', 'awaiting_consumer_confirmation', 'completed', 'disputed'].includes(status);
      // Standard bookings only reserve after payment/confirmation.
      // Custom bookings can reserve earlier to preserve negotiation flow.
      return isCustomFlow ? ['pending', 'payment_pending', 'confirmed', 'active', 'paid', 'awaiting_consumer_confirmation', 'completed', 'disputed'].includes(status) : isPaidOrConfirmed;
    };

    const rows = (data || []).filter((row: any) => {
      if (!shouldReserveSlot(row)) return false;
      const when = row?.scheduled_start || row?.scheduled_end;
      if (!when) return false;
      const t = new Date(when).getTime();
      return Number.isFinite(t) && t >= from.getTime() && t <= to.getTime();
    });
    return res.status(200).json({ rows });
  } catch (err: any) {
    console.error('[business-booked-slots] error', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
