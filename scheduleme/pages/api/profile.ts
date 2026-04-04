// pages/api/profile.ts — update profile with service role
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, rateLimit, setSecurityHeaders } from '../../lib/apiSecurity';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (!rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'profile' })) return;

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireAuth(req, res);
  if (!user) return;

  const { name, phone } = req.body || {};
  const safeName = typeof name === 'string' ? name.slice(0, 100) : null;
  const safePhone = typeof phone === 'string' ? phone.slice(0, 30) : null;

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email || null,
      name: safeName,
      phone: safePhone,
    }, { onConflict: 'id' });
    if (error) return res.status(500).json({ error: error.message || 'Failed to update profile' });
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
