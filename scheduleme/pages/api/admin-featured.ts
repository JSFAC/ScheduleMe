// @ts-nocheck
// pages/api/admin-featured.ts — admin manage campus featured
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, logAuditEvent, requireAdmin } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function normalizeCampusKey(name?: string | null): string | null {
  if (!name) return null;
  const trimmed = name.toLowerCase().trim();
  if (trimmed.includes('.')) {
    const normalizedDomain = trimmed.replace(/[^a-z0-9.]+/g, '');
    if (normalizedDomain === 'sfsu.edu') return 'sfsu.edu';
    return normalizedDomain;
  }
  const cleaned = trimmed.replace(/[^a-z0-9]+/g, ' ').trim();
  const key = cleaned ? cleaned.replace(/\s+/g, '_') : null;
  if (!key) return null;
  if (key === 'uc_santa_cruz' || key === 'ucsc' || key === 'ucsc_edu') return 'ucsc.edu';
  if (key === 'san_francisco_state_university' || key === 'sf_state' || key === 'sfsu' || key === 'sfsu_edu' || key === 'csu_sf') return 'sfsu.edu';
  if (key === 'arizona_state_university' || key === 'asu' || key === 'asu_edu' || key === 'a') return 'asu.edu';
  return key;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (!(await rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'admin-featured' }))) return;

  const supabase = getSupabase();

  if (req.method === 'GET') {
    // Keep admin panel clean by pruning featured rows whose window has ended.
    await supabase
      .from('campus_featured')
      .delete()
      .not('ends_at', 'is', null)
      .lt('ends_at', new Date().toISOString());

    const campusKeyRaw = typeof req.query.campus === 'string' ? req.query.campus : '';
    const campusKey = campusKeyRaw ? normalizeCampusKey(campusKeyRaw) || campusKeyRaw : '';
    let query = supabase
      .from('campus_featured')
      .select('id, business_id, campus_key, slot, starts_at, ends_at, note, created_at, businesses(name)')
      .order('slot', { ascending: true });
    if (campusKey) {
      if (campusKey.includes('.')) {
        const legacyKey = campusKey.split('.')[0];
        const keys = legacyKey && legacyKey !== campusKey ? [campusKey, legacyKey] : [campusKey];
        if (campusKey === 'asu.edu' && !keys.includes('a')) keys.push('a');
        if (campusKey === 'sfsu.edu') {
          if (!keys.includes('sf_state')) keys.push('sf_state');
          if (!keys.includes('san_francisco_state_university')) keys.push('san_francisco_state_university');
          if (!keys.includes('csu_sf')) keys.push('csu_sf');
        }
        query = query.in('campus_key', keys);
      } else {
        query = query.eq('campus_key', campusKey);
      }
    }
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
    await logAuditEvent(req, 'admin_featured_add', {
      entity_type: 'campus_featured',
      entity_id: data?.id || null,
      actor_role: 'admin',
      meta: { business_id, campus_key: campusKey, slot: payload.slot, ends_at: payload.ends_at },
    });
    return res.status(200).json({ success: true, id: data?.id });
  }

  if (req.method === 'DELETE') {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await supabase.from('campus_featured').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message || 'Failed to remove featured' });
    await logAuditEvent(req, 'admin_featured_remove', {
      entity_type: 'campus_featured',
      entity_id: id,
      actor_role: 'admin',
    });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
