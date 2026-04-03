// pages/api/campus-businesses.ts
// Service-role campus business lookup (bypasses RLS)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';
import { computePriceTier, averagePriceCents } from '../../lib/priceTier';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'campus' })) return;

  const { limit, school_domain, campus_school_name } = req.query;
  const limitNum = Math.min(Number(limit ?? 40), 200);
  const schoolDomain = typeof school_domain === 'string' && school_domain.trim() ? school_domain.trim() : null;
  const campusSchoolName = typeof campus_school_name === 'string' && campus_school_name.trim() ? campus_school_name.trim() : null;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } });

  let query = sb
    .from('businesses')
    .select('id, name, slug, description, address, lat, lng, service_tags, cover_url, media_urls, phone, website, calendly_url, rating, review_count, price_tier, availability_status, break_until, is_onboarded, edu_verified, campus_provider, school_domain, founder50')
    .eq('is_onboarded', true)
    .eq('campus_provider', true)
    .order('rating', { ascending: false });

  if (campusSchoolName && schoolDomain) {
    const pattern = `%${campusSchoolName.replace('%','')}%`;
    query = query.or(`campus_school_name.ilike.${pattern},school_domain.eq.${schoolDomain}`);
  } else if (campusSchoolName) {
    const pattern = `%${campusSchoolName.replace('%','')}%`;
    query = query.ilike('campus_school_name', pattern);
  } else if (schoolDomain) {
    query = query.eq('school_domain', schoolDomain);
  }

  const { data: rows, error } = await query.limit(limitNum);
  if (error || !rows) return res.status(200).json({ businesses: [] });

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

  const enriched = (rows as any[]).map((b) => {
    const tags = (b.service_tags || []).map((t: string) => t.toLowerCase());
    const primaryTag = tags[0] || null;
    const avgCents = averagePriceCents(serviceMap[b.id] || []);
    const priceTier = computePriceTier(avgCents, primaryTag);
    const reviewCount = b.review_count ?? 0;
    const rating = reviewCount > 0 ? b.rating : null;
    return { ...b, price_tier: priceTier, rating };
  });

  return res.status(200).json({ businesses: enriched });
}
