// @ts-nocheck
// pages/api/admin-featured.ts — admin manage campus featured
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function normalizeCampusKey(name?: string | null): string | null {
  if (!name) return null;
  const cleaned = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return cleaned ? cleaned.replace(/\s+/g, '_') : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  const secret = req.headers['x-notify-secret'];
  if (!process.env.NOTIFY_SECRET || secret !== process.env.NOTIFY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!(await rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'admin-featured' }))) return;

  const supabase = getSupabase();

  if (req.method === 'GET') {
    const campusKey = typeof req.query.campus === 'string' ? req.query.campus : '';
    let query = supabase
      .from('campus_featured')
      .select('id, business_id, campus_key, slot, starts_at, ends_at, note, created_at, businesses(name)')
      .order('slot', { ascending: true });
    if (campusKey) query = query.eq('campus_key', campusKey);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message || 'Failed to load featured' });
    return res.status(200).json({ featured: data || [] });
  }

  if (req.method === 'POST') {
    const { business_id, campus_key, slot, starts_at, ends_at, note } = req.body || {};
    if (!business_id) return res.status(400).json({ error: 'business_id required' });
    const campusKey = normalizeCampusKey(campus_key);
    if (!campusKey) return res.status(400).json({ error: 'campus_key required' });
    const payload: any = {
      business_id,
      campus_key: campusKey,
      slot: slot ?? 1,
      starts_at: starts_at || new Date().toISOString(),
      ends_at: ends_at || null,
      note: note || null,
    };
    const { data, error } = await supabase.from('campus_featured').insert(payload).select('id').single();
    if (error) return res.status(500).json({ error: error.message || 'Failed to add featured' });
    return res.status(200).json({ success: true, id: data?.id });
  }

  if (req.method === 'DELETE') {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await supabase.from('campus_featured').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message || 'Failed to remove featured' });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
