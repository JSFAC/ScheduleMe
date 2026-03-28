// pages/api/nearby-businesses.ts
// Service-role nearby business lookup (bypasses RLS)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders } from '../../lib/apiSecurity';

function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { lat, lng, radius, limit, category } = req.query;
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const radiusNum = Number(radius ?? 25);
  const limitNum = Math.min(Number(limit ?? 40), 200);

  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return res.status(400).json({ error: 'lat/lng required' });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } });

  const { data: rows, error } = await sb
    .from('businesses')
    .select('id, name, slug, description, address, lat, lng, service_tags, cover_url, media_urls, phone, website, calendly_url, rating, review_count, price_tier, is_onboarded, edu_verified')
    .eq('is_onboarded', true)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .limit(limitNum);

  if (error || !rows) return res.status(200).json({ businesses: [] });

  const cat = typeof category === 'string' && category.trim() ? category.toLowerCase() : null;

  const filtered = (rows as any[]).map((b) => {
    const d = haversineMiles(latNum, lngNum, b.lat, b.lng);
    return { ...b, distance_miles: d };
  }).filter((b) => {
    if (b.distance_miles > radiusNum) return false;
    if (!cat) return true;
    const tags = (b.service_tags || []).map((t: string) => t.toLowerCase());
    return tags.includes(cat);
  }).sort((a, b) => a.distance_miles - b.distance_miles).slice(0, limitNum);

  return res.status(200).json({ businesses: filtered });
}
