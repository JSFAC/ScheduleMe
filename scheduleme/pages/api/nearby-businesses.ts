// pages/api/nearby-businesses.ts
// Service-role nearby business lookup (bypasses RLS)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';
import { computePriceTier, averagePriceCents } from '../../lib/priceTier';
import { computeFounder50Status } from '../../lib/founder50';

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
  try {
    setSecurityHeaders(res);
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    if (!(await rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'nearby' }))) return;

    const { lat, lng, radius, limit, category, edu_only, campus_only, school_domain } = req.query;
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const radiusNum = Number(radius ?? 25);
    const limitNum = Math.min(Number(limit ?? 40), 200);

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return res.status(400).json({ error: 'lat/lng required' });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return res.status(200).json({ businesses: [], error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } });

    const baseSelect = 'id, name, slug, description, address, zip, lat, lng, service_tags, cover_url, media_urls, phone, website, calendly_url, rating, review_count, price_tier, availability_status, break_until, is_onboarded, edu_verified, campus_provider, school_domain, founder50, founder50_status, last_completed_booking_at, away_start, away_end, public_visibility, public_show_name, public_show_photos';
    const legacySelect = 'id, name, slug, description, address, zip, lat, lng, service_tags, cover_url, media_urls, phone, website, calendly_url, rating, review_count, price_tier, availability_status, break_until, is_onboarded, edu_verified, campus_provider, school_domain, founder50';

    let query = sb
      .from('businesses')
      .select(baseSelect)
      .eq('is_onboarded', true)
      .eq('public_visibility', true)
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

    let rows: any[] | null = null;
    let error: any = null;
    try {
      const resq = await query.limit(limitNum);
      rows = resq.data; error = resq.error;
    } catch (err) {
      error = err;
    }

    if (error) {
      // Fallback for older schemas missing founder50_* columns
      let legacyQuery = sb
        .from('businesses')
        .select(legacySelect)
        .eq('is_onboarded', true)
        .not('lat', 'is', null)
        .not('lng', 'is', null);
      if (eduOnly) legacyQuery = legacyQuery.eq('edu_verified', true);
      if (campusOnly) legacyQuery = legacyQuery.or('campus_provider.eq.true,campus_provider.is.null');
      if (schoolDomain) legacyQuery = legacyQuery.eq('school_domain', schoolDomain);
      const legacyRes = await legacyQuery.limit(limitNum);
      rows = legacyRes.data; error = legacyRes.error;
    }

    if (error || !rows) return res.status(200).json({ businesses: [], error: error?.message || String(error || '') });

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
      const status = computeFounder50Status(b);
      const showName = b.public_show_name === true;
      const showPhotos = b.public_show_photos === true;
      return {
        ...b,
        name: showName ? b.name : 'Student Provider',
        phone: showName ? b.phone : null,
        website: showName ? b.website : null,
        address: showName ? b.address : (b.zip || b.address || null),
        cover_url: showPhotos ? b.cover_url : null,
        media_urls: showPhotos ? b.media_urls : [],
        distance_miles: d,
        price_tier: priceTier,
        rating,
        founder50_status: b.founder50_status ?? status,
      };
    }).filter((b) => {
      if (b.distance_miles > radiusNum) return false;
      if (!cat) return true;
      const tags = (b.service_tags || []).map((t: string) => t.toLowerCase());
      return tags.includes(cat);
    }).sort((a, b) => a.distance_miles - b.distance_miles).slice(0, limitNum);

    return res.status(200).json({ businesses: filtered });
  } catch (err: any) {
    console.error('[nearby-businesses] error', err);
    return res.status(200).json({ businesses: [], error: err?.message || 'Internal error' });
  }
}
