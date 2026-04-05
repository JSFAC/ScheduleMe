// pages/api/campus-businesses.ts
// Service-role campus business lookup (bypasses RLS)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';
import { computePriceTier, averagePriceCents } from '../../lib/priceTier';
import { computeFounder50Status } from '../../lib/founder50';

const FEATURED_LIMIT = 3;

function normalizeCampusKey(name?: string | null): string | null {
  if (!name) return null;
  const trimmed = name.toLowerCase().trim();
  if (trimmed.includes('.')) {
    return trimmed.replace(/[^a-z0-9.]+/g, '');
  }
  const cleaned = trimmed.replace(/[^a-z0-9]+/g, ' ').trim();
  const key = cleaned ? cleaned.replace(/\s+/g, '_') : null;
  if (!key) return null;
  if (key === 'uc_santa_cruz' || key === 'ucsc' || key === 'ucsc_edu') return 'ucsc.edu';
  if (key === 'arizona_state_university' || key === 'asu' || key === 'asu_edu' || key === 'a') return 'asu.edu';
  return key;
}

function campusKeyFromDomain(domain?: string | null): string | null {
  if (!domain) return null;
  return normalizeCampusKey(domain);
}

function campusAcronym(name?: string | null): string | null {
  if (!name) return null;
  const words = name.replace(/[^a-z0-9\s]+/gi, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return words.map(w => w[0]).join('').toLowerCase();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    setSecurityHeaders(res);
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    if (!(await rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'campus' }))) return;

    const { limit, school_domain, campus_school_name, campus_key } = req.query;
    const limitNum = Math.min(Number(limit ?? 40), 200);
    const schoolDomain = typeof school_domain === 'string' && school_domain.trim() ? school_domain.trim() : null;
    const campusSchoolName = typeof campus_school_name === 'string' && campus_school_name.trim() ? campus_school_name.trim() : null;
    const explicitCampusKey = typeof campus_key === 'string' && campus_key.trim() ? campus_key.trim() : null;
    const campusKey = explicitCampusKey || normalizeCampusKey(campusSchoolName) || campusKeyFromDomain(schoolDomain);

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return res.status(200).json({ featured: [], businesses: [], error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } });

    const nowIso = new Date().toISOString();

    const baseSelect = 'id, name, slug, description, address, lat, lng, service_tags, cover_url, media_urls, phone, website, calendly_url, rating, review_count, price_tier, availability_status, break_until, is_onboarded, edu_verified, campus_provider, school_domain, founder50, founder50_status, last_completed_booking_at, away_start, away_end, campus_key, featured_until, featured_on_notified_at, featured_off_notified_at, campus_show_name';
    const legacySelect = 'id, name, slug, description, address, lat, lng, service_tags, cover_url, media_urls, phone, website, calendly_url, rating, review_count, price_tier, availability_status, break_until, is_onboarded, edu_verified, campus_provider, school_domain, founder50';

    let query = sb
      .from('businesses')
      .select(baseSelect)
      .eq('is_onboarded', true)
      .eq('edu_verified', true)
      .eq('campus_provider', true)
      .order('rating', { ascending: false });

  if (campusKey) {
    const orParts: string[] = [`campus_key.eq.${campusKey}`];
    if (campusSchoolName) {
      const pattern = `%${campusSchoolName.replace('%','')}%`;
      orParts.push(`campus_school_name.ilike.${pattern}`);
    }
    if (schoolDomain) {
      orParts.push(`school_domain.eq.${schoolDomain}`);
    }
    query = query.or(orParts.join(','));
  } else if (campusSchoolName && schoolDomain) {
    const pattern = `%${campusSchoolName.replace('%','')}%`;
    query = query.or(`campus_school_name.ilike.${pattern},school_domain.eq.${schoolDomain}`);
  } else if (campusSchoolName) {
    const pattern = `%${campusSchoolName.replace('%','')}%`;
    query = query.ilike('campus_school_name', pattern);
  } else if (schoolDomain) {
    query = query.eq('school_domain', schoolDomain);
  }

  let rows: any[] | null = null;
  let error: any = null;
  let legacyMode = false;
  try {
    const resq = await query.limit(limitNum);
    rows = resq.data; error = resq.error;
  } catch (err) {
    error = err;
  }

  if (error) {
    legacyMode = true;
    // Fallback for older schemas missing newer columns
    let legacyQuery = sb
      .from('businesses')
      .select(legacySelect)
      .eq('is_onboarded', true)
      .eq('edu_verified', true)
      .eq('campus_provider', true)
      .order('rating', { ascending: false });
    if (campusSchoolName && schoolDomain) {
      const pattern = `%${campusSchoolName.replace('%','')}%`;
      legacyQuery = legacyQuery.or(`campus_school_name.ilike.${pattern},school_domain.eq.${schoolDomain}`);
    } else if (campusSchoolName) {
      const pattern = `%${campusSchoolName.replace('%','')}%`;
      legacyQuery = legacyQuery.ilike('campus_school_name', pattern);
    } else if (schoolDomain) {
      legacyQuery = legacyQuery.eq('school_domain', schoolDomain);
    }
    const legacyRes = await legacyQuery.limit(limitNum);
    rows = legacyRes.data; error = legacyRes.error;
  }

    if (error || !rows) return res.status(200).json({ featured: [], businesses: [], error: error?.message || String(error || '') });

  // If campusKey is short (e.g., UCSC) and no matches, fallback to acronym match
  if (campusKey && rows.length === 0) {
    const fallbackRes = await sb
      .from('businesses')
      .select(legacyMode ? legacySelect : baseSelect)
      .eq('is_onboarded', true)
      .eq('edu_verified', true)
      .eq('campus_provider', true)
      .order('rating', { ascending: false })
      .limit(limitNum);
    const allRows = fallbackRes.data || [];
    const keyPlain = campusKey.replace(/[^a-z0-9]+/g, '');
    rows = allRows.filter((b: any) => {
      if (b.school_domain && b.school_domain === schoolDomain) return true;
      const acronym = campusAcronym(b.campus_school_name || b.campus_key || '');
      if (acronym && acronym === keyPlain) return true;
      const normalizedName = normalizeCampusKey(b.campus_school_name || '') || '';
      return normalizedName.replace(/_/g, '') === keyPlain;
    });
  }

  const featuredManual: any[] = [];
  const featuredAuto: any[] = [];

  if (campusKey && !legacyMode) {
    const campusKeys = [campusKey];
    if (campusKey.includes('.')) {
      const legacyKey = campusKey.split('.')[0];
      if (legacyKey && legacyKey !== campusKey) campusKeys.push(legacyKey);
    }
    if (campusKey === 'asu.edu' && !campusKeys.includes('a')) campusKeys.push('a');
    let manualRows: any[] = [];
    try {
      const { data } = await sb
        .from('campus_featured')
        .select('id, business_id, slot, starts_at, ends_at, notified_on_at, notified_off_at')
        .in('campus_key', campusKeys)
        .order('slot', { ascending: true });
      manualRows = data || [];
    } catch {
      manualRows = [];
    }

    const manualActive = (manualRows || []).filter((row: any) => {
      const start = row.starts_at ? new Date(row.starts_at) : null;
      const end = row.ends_at ? new Date(row.ends_at) : null;
      const now = new Date();
      if (start && end) return now >= start && now <= end;
      if (start && !end) return now >= start;
      if (!start && end) return now <= end;
      return true;
    });

    const manualActiveIds = manualActive.map((r: any) => r.business_id).filter(Boolean);
    if (manualActiveIds.length > 0) {
      const { data: manualBiz } = await sb
        .from('businesses')
        .select('id, name, slug, description, address, lat, lng, service_tags, cover_url, media_urls, phone, website, calendly_url, rating, review_count, price_tier, availability_status, break_until, is_onboarded, edu_verified, campus_provider, school_domain, founder50, founder50_status, last_completed_booking_at, away_start, away_end, campus_key, featured_until, featured_on_notified_at, featured_off_notified_at, campus_show_name')
        .in('id', manualActiveIds)
        .eq('edu_verified', true);
      const manualMap = new Map((manualBiz || []).map((b: any) => [b.id, b]));
      manualActive.forEach((row: any) => {
        const biz = manualMap.get(row.business_id);
        if (biz) featuredManual.push(biz);
      });
    }

    // Featured email notifications are handled by a secured admin job.
  }

  if (!legacyMode) {
  const autoFeaturedQuery = sb
    .from('businesses')
    .select('id, name, slug, description, address, lat, lng, service_tags, cover_url, media_urls, phone, website, calendly_url, rating, review_count, price_tier, availability_status, break_until, is_onboarded, edu_verified, campus_provider, school_domain, founder50, founder50_status, last_completed_booking_at, away_start, away_end, campus_key, featured_until, featured_on_notified_at, featured_off_notified_at, campus_show_name')
    .eq('is_onboarded', true)
    .eq('edu_verified', true)
    .eq('campus_provider', true)
    .gt('featured_until', nowIso);
  if (campusKey) {
    const orParts: string[] = [`campus_key.eq.${campusKey}`];
    if (campusKey.includes('.')) {
      const legacyKey = campusKey.split('.')[0];
      if (legacyKey && legacyKey !== campusKey) {
        orParts.push(`campus_key.eq.${legacyKey}`);
      }
    }
    if (campusKey === 'asu.edu') {
      orParts.push('campus_key.eq.a');
    }
    if (campusSchoolName) {
      const pattern = `%${campusSchoolName.replace('%','')}%`;
      orParts.push(`campus_school_name.ilike.${pattern}`);
    }
    if (schoolDomain) {
      orParts.push(`school_domain.eq.${schoolDomain}`);
    }
    autoFeaturedQuery.or(orParts.join(','));
  } else if (campusSchoolName && schoolDomain) {
    const pattern = `%${campusSchoolName.replace('%','')}%`;
    autoFeaturedQuery.or(`campus_school_name.ilike.${pattern},school_domain.eq.${schoolDomain}`);
  } else if (campusSchoolName) {
    const pattern = `%${campusSchoolName.replace('%','')}%`;
    autoFeaturedQuery.ilike('campus_school_name', pattern);
  } else if (schoolDomain) {
    autoFeaturedQuery.eq('school_domain', schoolDomain);
  }
  const { data: autoFeaturedRows } = await autoFeaturedQuery;
  (autoFeaturedRows || []).forEach((b: any) => featuredAuto.push(b));

  // Featured email notifications are handled by a secured admin job.
  }

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
    const status = computeFounder50Status(b);
    return { ...b, price_tier: priceTier, rating, founder50_status: b.founder50_status ?? status };
  });

  const featuredIds = new Set<string>();
  const mergedFeatured = [...featuredManual, ...featuredAuto].filter((b: any) => {
    if (!b?.id) return false;
    if (!b.edu_verified) return false;
    if (featuredIds.has(b.id)) return false;
    featuredIds.add(b.id);
    return true;
  }).slice(0, FEATURED_LIMIT);

  const filteredBusinesses = enriched.filter((b: any) => b.edu_verified && !featuredIds.has(b.id));

  const sanitize = (b: any) => {
    const { owner_email, ...rest } = b || {};
    return rest;
  };

    return res.status(200).json({
      featured: mergedFeatured.map(sanitize),
      businesses: filteredBusinesses.map(sanitize),
    });
  } catch (err: any) {
    console.error('[campus-businesses] error', err);
    return res.status(200).json({ featured: [], businesses: [], error: err?.message || 'Internal error' });
  }
}
