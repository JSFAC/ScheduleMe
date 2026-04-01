// pages/api/nearby-businesses.ts
// Service-role nearby business lookup (bypasses RLS)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders } from '../../lib/apiSecurity';
import { computePriceTier, averagePriceCents } from '../../lib/priceTier';

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
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { lat, lng, radius, limit, category, edu_only, campus_only, school_domain } = req.query;
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

  let query = sb
    .from('businesses')
    .select('id, name, slug, description, address, lat, lng, service_tags, cover_url, media_urls, phone, website, calendly_url, rating, review_count, price_tier, availability_status, is_onboarded, edu_verified, campus_provider, school_domain')
    .eq('is_onboarded', true)
    .not('lat', 'is', null)
    .not('lng', 'is', null);

  const eduOnly = String(edu_only ?? '').toLowerCase() === 'true';
  const campusOnly = String(campus_only ?? '').toLowerCase() === 'true';
  const schoolDomain = typeof school_domain === 'string' && school_domain.trim() ? school_domain.trim() : null;

  if (eduOnly) query = query.eq('edu_verified', true);
  if (campusOnly) {
    // Keep legacy campus listings where campus_provider may be null
    query = query.or('campus_provider.eq.true,campus_provider.is.null');
  }
  if (schoolDomain) query = query.eq('school_domain', schoolDomain);

  const { data: rows, error } = await query.limit(limitNum);

  if (error || !rows) return res.status(200).json({ businesses: [] });

  const cat = typeof category === 'string' && category.trim() ? category.toLowerCase() : null;

  const businessIds = (rows as any[]).map((b) => b.id).filter(Boolean);
  const serviceMap: Record<string, number[]> = {};
  if (businessIds.length > 0) {
    const { data: svcRows } = await sb
      .from('services')
      .select('business_id, price_cents')
      .in('business_id', businessIds)
      .eq('active', true);
    (svcRows || []).forEach((s: any) => {
      if (!serviceMap[s.business_id]) serviceMap[s.business_id] = [];
      serviceMap[s.business_id].push(Number(s.price_cents));
    });
  }

  const filtered = (rows as any[]).map((b) => {
    const d = haversineMiles(latNum, lngNum, b.lat, b.lng);
    const tags = (b.service_tags || []).map((t: string) => t.toLowerCase());
    const primaryTag = tags[0] || null;
    const avgCents = averagePriceCents(serviceMap[b.id] || []);
    const priceTier = computePriceTier(avgCents, primaryTag);
    const reviewCount = b.review_count ?? 0;
    const rating = reviewCount > 0 ? b.rating : null;
    return { ...b, distance_miles: d, price_tier: priceTier, rating };
  }).filter((b) => {
    if (b.distance_miles > radiusNum) return false;
    if (!cat) return true;
    const tags = (b.service_tags || []).map((t: string) => t.toLowerCase());
    return tags.includes(cat);
  }).sort((a, b) => a.distance_miles - b.distance_miles).slice(0, limitNum);

  return res.status(200).json({ businesses: filtered });
}
