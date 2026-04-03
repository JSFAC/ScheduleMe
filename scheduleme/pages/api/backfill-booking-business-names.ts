// pages/api/backfill-booking-business-names.ts — SECURED
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth } from '../../lib/apiSecurity';

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
  if (!rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'backfill-biz' })) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const supabase = getSupabase();
    const idSet = new Set<string>();
    idSet.add(user.id);
    if (user.email) {
      const { data: profile } = await supabase.from('profiles').select('id').eq('email', user.email).maybeSingle();
      if (profile?.id) idSet.add(profile.id);
      try {
        const { data: legacyUser } = await supabase.from('users').select('id').eq('email', user.email).maybeSingle();
        if (legacyUser?.id) idSet.add(legacyUser.id);
      } catch {}
    }
    const idList = Array.from(idSet).filter(Boolean);

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, business_id, business_name')
      .in('user_id', idList);
    if (error) return res.status(500).json({ error: 'Failed to load bookings' });

    const missing = (bookings || []).filter((b: any) => b.business_id && (!b.business_name || String(b.business_name).trim() === ''));
    if (missing.length === 0) return res.status(200).json({ updated: 0 });

    const bizIds = Array.from(new Set(missing.map((b: any) => b.business_id).filter(Boolean)));
    const { data: bizData } = await supabase
      .from('businesses')
      .select('id, name')
      .in('id', bizIds);
    const map = new Map((bizData || []).map((b: any) => [b.id, b.name]));

    let updated = 0;
    for (const b of missing) {
      const name = map.get(b.business_id);
      if (!name) continue;
      const { error: updErr } = await supabase.from('bookings').update({ business_name: name }).eq('id', b.id);
      if (!updErr) updated++;
    }

    return res.status(200).json({ updated });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
