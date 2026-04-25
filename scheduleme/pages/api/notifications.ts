// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, rateLimit, setSecurityHeaders } from '../../lib/apiSecurity';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

function statusLabel(status: string): string {
  const cleaned = (status || '').replace(/_/g, ' ').trim();
  if (!cleaned) return 'updated';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 120, windowMs: 60_000, keyPrefix: 'notifications' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const sb = getSupabase();

  try {
    const { data, error } = await sb
      .from('notifications')
      .select('id,title,subtitle,created_at,booking_id,business_id,user_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error) {
      const notifications = (data || []).map((row: any) => ({
        id: String(row.id),
        title: row.title || 'ScheduleMe update',
        subtitle: row.subtitle || null,
        created_at: row.created_at || new Date().toISOString(),
        booking_id: row.booking_id || null,
        business_id: row.business_id || null,
      }));
      return res.status(200).json({ notifications });
    }
  } catch {
    // Fall through to booking-derived fallback.
  }

  try {
    const { data: bookings, error: bookingError } = await sb
      .from('bookings')
      .select('id,status,created_at,business_id,service,businesses(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (bookingError) return res.status(200).json({ notifications: [] });

    const notifications = (bookings || []).map((row: any) => ({
      id: String(row.id),
      title: `Booking ${statusLabel(row.status)}`,
      subtitle: row?.businesses?.name || row?.service || 'ScheduleMe',
      created_at: row.created_at || new Date().toISOString(),
      booking_id: row.id,
      business_id: row.business_id || null,
    }));

    return res.status(200).json({ notifications });
  } catch {
    return res.status(200).json({ notifications: [] });
  }
}
