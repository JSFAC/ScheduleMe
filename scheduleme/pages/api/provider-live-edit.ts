import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getUnknownFields, rateLimit, requireAuth, setSecurityHeaders } from '../../lib/apiSecurity';
import { validateAndFilter } from '../../lib/profanity';
import { moderateText } from '../../lib/moderation';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );
}

async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const trimmed = location.trim();
    if (!trimmed) return null;
    const isZip = /^[0-9]{5}$/.test(trimmed);
    const query = isZip ? `${trimmed}, USA` : trimmed;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`;
    const res = await fetch(url, { headers: { 'User-Agent': 'ScheduleMe/1.0' } });
    const data = await res.json();
    if (data?.[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {}
  return null;
}

const ALLOWED_FIELDS = new Set([
  'name',
  'owner_name',
  'phone',
  'website',
  'description',
  'cover_url',
  'media_urls',
  'video_url',
  'address',
  'city',
  'zip',
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (!(await rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'provider-live-edit' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const supabase = getSupabase();

  async function loadOwnedBusiness() {
    const byOwner = await supabase
      .from('businesses')
      .select('id, owner_id, owner_email, name, owner_name, phone, website, description, cover_url, media_urls, video_url, address, city, zip')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (byOwner.data) return byOwner.data;

    const ownerEmail = String(user.email || '').toLowerCase().trim();
    if (!ownerEmail) return null;

    const byLegacyEmail = await supabase
      .from('businesses')
      .select('id, owner_id, owner_email, name, owner_name, phone, website, description, cover_url, media_urls, video_url, address, city, zip')
      .ilike('owner_email', ownerEmail)
      .maybeSingle();

    if (byLegacyEmail.data && !byLegacyEmail.data.owner_id) {
      await supabase.from('businesses').update({ owner_id: user.id }).eq('id', byLegacyEmail.data.id);
      return { ...byLegacyEmail.data, owner_id: user.id };
    }

    return byLegacyEmail.data || null;
  }

  if (req.method === 'GET') {
    const business = await loadOwnedBusiness();
    return res.status(200).json({ business: business || null });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

  if (typeof updates.name === 'string') {
    const moderation = await moderateText(updates.name);
    if (!moderation.ok) return res.status(400).json({ error: moderation.reason || 'Business name violates content policy' });
    const check = validateAndFilter(updates.name, { maxLength: 60, fieldName: 'Business name' });
    if (!check.ok) return res.status(400).json({ error: 'error' in check ? check.error : 'Invalid business name' });
    updates.name = check.value;
  }
  if (typeof updates.owner_name === 'string') {
    const moderation = await moderateText(updates.owner_name);
    if (!moderation.ok) return res.status(400).json({ error: moderation.reason || 'Provider name violates content policy' });
    const check = validateAndFilter(updates.owner_name, { maxLength: 60, fieldName: 'Provider name' });
    if (!check.ok) return res.status(400).json({ error: 'error' in check ? check.error : 'Invalid provider name' });
    updates.owner_name = check.value;
  }
  if (typeof updates.phone === 'string') {
    updates.phone = updates.phone.trim().slice(0, 40);
  }
  if (typeof updates.website === 'string') {
    updates.website = updates.website.trim().slice(0, 255);
  }
  if (typeof updates.description === 'string') {
    const trimmedDescription = updates.description.trim();
    if (trimmedDescription) {
      const moderation = await moderateText(trimmedDescription);
      if (!moderation.ok) return res.status(400).json({ error: moderation.reason || 'Description violates content policy' });
      const check = validateAndFilter(trimmedDescription, { maxLength: 1000, fieldName: 'Description' });
      if (!check.ok) return res.status(400).json({ error: 'error' in check ? check.error : 'Invalid description' });
      updates.description = check.value;
    } else {
      updates.description = '';
    }
  }
  if (typeof updates.name === 'string') {
    updates.name = updates.name.trim().slice(0, 60);
  }
  if (typeof updates.address === 'string') {
    updates.address = updates.address.trim().slice(0, 160);
  }
  if (typeof updates.city === 'string') {
    updates.city = updates.city.trim().slice(0, 80);
  }
  if (typeof updates.zip === 'string') {
    updates.zip = updates.zip.replace(/[^0-9A-Za-z -]/g, '').trim().slice(0, 10);
  }
  if (Array.isArray(updates.media_urls)) {
    updates.media_urls = updates.media_urls.filter(Boolean).slice(0, 8);
  }
  if ('name' in updates && !updates.name) {
    return res.status(400).json({ error: 'Business name is required' });
  }

  if ('address' in updates || 'city' in updates || 'zip' in updates) {
    const geoQuery = [updates.address, [updates.city, updates.zip].filter(Boolean).join(' ')].find((value) => typeof value === 'string' && value.trim());
    if (geoQuery) {
      const geo = await geocodeLocation(String(geoQuery));
      if (geo) {
        updates.lat = geo.lat;
        updates.lng = geo.lng;
      }
    }
  }

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
    .select('id, name, owner_name, phone, website, description, cover_url, media_urls, video_url, address, city, zip')
    .single();

  if (error) return res.status(500).json({ error: error.message || 'Failed to update listing' });
  return res.status(200).json({ business: data });
}
