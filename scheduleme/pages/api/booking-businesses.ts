// pages/api/booking-businesses.ts — SECURED
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
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, { max: 120, windowMs: 60_000, keyPrefix: 'booking-biz' })) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const booking_ids = Array.isArray(req.body?.booking_ids) ? req.body.booking_ids : [];
  const ids = booking_ids.filter((id: any) => isValidUuid(id));
  if (ids.length === 0) return res.status(400).json({ error: 'booking_ids required' });

  try {
    const supabase = getSupabase();
    const userIds = new Set<string>();
    userIds.add(user.id);

    if (user.email) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();
      if (profile?.id) userIds.add(profile.id);
      try {
        const { data: legacyUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        if (legacyUser?.id) userIds.add(legacyUser.id);
      } catch {}
    }

    const idList = Array.from(userIds).filter(Boolean);
    const { data, error } = await supabase
      .from('bookings')
      .select('id, business_id, businesses(name, phone, email)')
      .in('id', ids)
      .in('user_id', idList);
    if (error) return res.status(500).json({ error: 'Failed to load booking businesses' });

    const map: Record<string, { business_id?: string | null; name?: string | null; phone?: string | null; email?: string | null }> = {};
    (data || []).forEach((b: any) => {
      map[b.id] = {
        business_id: b.business_id || null,
        name: b.businesses?.name ?? null,
        phone: b.businesses?.phone ?? null,
        email: b.businesses?.email ?? null,
      };
    });
    return res.status(200).json({ businesses: map });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
