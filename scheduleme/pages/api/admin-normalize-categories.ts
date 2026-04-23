// @ts-nocheck
// pages/api/admin-normalize-categories.ts — normalize provider categories (service_tags)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAdmin } from '../../lib/apiSecurity';
import { normalizeKnownServiceTag, normalizeServiceTags, serviceTagToTopicKeywords, serviceTagsToTopicKeywords } from '../../lib/categoryNormalization';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
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
    .select('id, service_tags, keywords');
  if (error) return res.status(500).json({ error: error.message });

  let updated = 0;
  for (const row of data || []) {
    const raw = Array.isArray(row.service_tags)
      ? row.service_tags
      : (row.service_tags ? [String(row.service_tags)] : []);
    if (raw.length === 0) continue;
    const normalized = normalizeServiceTags(raw);
    if (normalized.length === 0) continue;

    const rawKeywords = Array.isArray(row.keywords)
      ? row.keywords.map((k: unknown) => String(k || '').trim()).filter(Boolean)
      : [];
    const normalizedKeywords: string[] = [];
    const pushUnique = (value: string) => {
      if (!value) return;
      if (!normalizedKeywords.includes(value)) normalizedKeywords.push(value);
    };

    // Keep category topics in keywords aligned with normalized service tags.
    for (const topic of serviceTagsToTopicKeywords(normalized)) pushUnique(topic);

    // Preserve non-category free text (e.g., owner names), but normalize known categories.
    for (const kw of rawKeywords) {
      const known = normalizeKnownServiceTag(kw);
      if (known) {
        for (const topic of serviceTagToTopicKeywords(known)) pushUnique(topic);
      } else if (kw.toLowerCase() === 'and') {
        continue;
      } else if (kw.toLowerCase() === '3d') {
        pushUnique('3D');
      } else {
        pushUnique(kw.toLowerCase());
      }
    }

    const sameTags = normalized.length === raw.length && normalized.every((t, i) => t === String(raw[i]));
    const sameKeywords = normalizedKeywords.length === rawKeywords.length
      && normalizedKeywords.every((k, i) => k === rawKeywords[i]);
    if (sameTags && sameKeywords) continue;

    const { error: upErr } = await supabase
      .from('businesses')
      .update({ service_tags: normalized, keywords: normalizedKeywords })
      .eq('id', row.id);
    if (!upErr) updated += 1;
  }

  return res.status(200).json({ success: true, updated });
}
