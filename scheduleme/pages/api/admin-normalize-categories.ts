// @ts-nocheck
// pages/api/admin-normalize-categories.ts — normalize provider categories (service_tags)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAdmin } from '../../lib/apiSecurity';
import { normalizeServiceTags } from '../../lib/categoryNormalization';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (!(await rateLimit(req, res, { max: 10, windowMs: 60_000, keyPrefix: 'admin-normalize-categories' }))) return;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('businesses')
    .select('id, service_tags');
  if (error) return res.status(500).json({ error: error.message });

  let updated = 0;
  for (const row of data || []) {
    const raw = Array.isArray(row.service_tags)
      ? row.service_tags
      : (row.service_tags ? [String(row.service_tags)] : []);
    if (raw.length === 0) continue;
    const normalized = normalizeServiceTags(raw);
    if (normalized.length === 0) continue;
    const same = normalized.length === raw.length && normalized.every((t, i) => t === String(raw[i]));
    if (same) continue;
    const { error: upErr } = await supabase
      .from('businesses')
      .update({ service_tags: normalized })
      .eq('id', row.id);
    if (!upErr) updated += 1;
  }

  return res.status(200).json({ success: true, updated });
}
