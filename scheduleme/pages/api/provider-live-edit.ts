import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getUnknownFields, rateLimit, requireAuth, setSecurityHeaders } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );
}

const ALLOWED_FIELDS = new Set(['name', 'description', 'cover_url', 'media_urls', 'video_url']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'provider-live-edit' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const unknown = getUnknownFields(req.body, ['business_id', 'changes']);
  if (unknown.length > 0) return res.status(400).json({ error: `Unexpected fields: ${unknown.join(', ')}` });

  const { business_id, changes } = req.body || {};
  if (!business_id || !changes || typeof changes !== 'object') {
    return res.status(400).json({ error: 'business_id and changes are required' });
  }

  const updates = Object.fromEntries(
    Object.entries(changes).filter(([key]) => ALLOWED_FIELDS.has(key))
  );
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  if (typeof updates.description === 'string') {
    updates.description = updates.description.slice(0, 1000);
  }
  if (typeof updates.name === 'string') {
    updates.name = updates.name.trim().slice(0, 60);
  }
  if (Array.isArray(updates.media_urls)) {
    updates.media_urls = updates.media_urls.filter(Boolean).slice(0, 8);
  }
  if ('name' in updates && !updates.name) {
    return res.status(400).json({ error: 'Business name is required' });
  }

  const supabase = getSupabase();
  const { data: biz, error: bizError } = await supabase
    .from('businesses')
    .select('id, owner_id, owner_email')
    .eq('id', business_id)
    .maybeSingle();

  if (bizError || !biz) return res.status(404).json({ error: 'Business not found' });

  const ownerEmail = String(biz.owner_email || '').toLowerCase().trim();
  const userEmail = String(user.email || '').toLowerCase().trim();
  if (!biz.owner_id && ownerEmail && ownerEmail === userEmail) {
    await supabase.from('businesses').update({ owner_id: user.id }).eq('id', business_id);
    biz.owner_id = user.id;
  }
  if (biz.owner_id !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { data, error } = await supabase
    .from('businesses')
    .update(updates)
    .eq('id', business_id)
    .select('id, name, description, cover_url, media_urls, video_url')
    .single();

  if (error) return res.status(500).json({ error: error.message || 'Failed to update listing' });
  return res.status(200).json({ business: data });
}
