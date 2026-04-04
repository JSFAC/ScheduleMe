// pages/api/campus-businesses.ts
// Service-role campus business lookup (bypasses RLS)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';
import { computePriceTier, averagePriceCents } from '../../lib/priceTier';
import { computeFounder50Status } from '../../lib/founder50';
import { sendFeaturedOnEmail, sendFeaturedOffEmail } from '../../lib/email';

const FEATURED_LIMIT = 3;

function normalizeCampusKey(name?: string | null): string | null {
  if (!name) return null;
  const cleaned = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return cleaned ? cleaned.replace(/\s+/g, '_') : null;
}

function campusKeyFromDomain(domain?: string | null): string | null {
  if (!domain) return null;
  const base = domain.split('.')[0]?.trim();
  if (!base) return null;
  return normalizeCampusKey(base);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'campus' })) return;

  const { limit, school_domain, campus_school_name, campus_key } = req.query;
  const limitNum = Math.min(Number(limit ?? 40), 200);
  const schoolDomain = typeof school_domain === 'string' && school_domain.trim() ? school_domain.trim() : null;
  const campusSchoolName = typeof campus_school_name === 'string' && campus_school_name.trim() ? campus_school_name.trim() : null;
  const explicitCampusKey = typeof campus_key === 'string' && campus_key.trim() ? campus_key.trim() : null;
  const campusKey = explicitCampusKey || normalizeCampusKey(campusSchoolName) || campusKeyFromDomain(schoolDomain);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } });

  const nowIso = new Date().toISOString();

  let query = sb
    .from('businesses')
    .select('id, name, slug, description, address, lat, lng, service_tags, cover_url, media_urls, phone, website, calendly_url, rating, review_count, price_tier, availability_status, break_until, is_onboarded, edu_verified, campus_provider, school_domain, founder50, founder50_status, last_completed_booking_at, away_start, away_end, campus_key, featured_until, featured_on_notified_at, featured_off_notified_at, owner_email')
    .eq('is_onboarded', true)
    .eq('campus_provider', true)
    .order('rating', { ascending: false });

  if (campusKey) {
    query = query.eq('campus_key', campusKey);
  } else if (campusSchoolName && schoolDomain) {
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

  const featuredManual: any[] = [];
  const featuredAuto: any[] = [];

  if (campusKey) {
    let manualRows: any[] = [];
    try {
      const { data } = await sb
        .from('campus_featured')
        .select('id, business_id, slot, starts_at, ends_at, notified_on_at, notified_off_at')
        .eq('campus_key', campusKey)
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
        .select('id, name, slug, description, address, lat, lng, service_tags, cover_url, media_urls, phone, website, calendly_url, rating, review_count, price_tier, availability_status, break_until, is_onboarded, edu_verified, campus_provider, school_domain, founder50, founder50_status, last_completed_booking_at, away_start, away_end, campus_key, featured_until, featured_on_notified_at, featured_off_notified_at, owner_email')
        .in('id', manualActiveIds);
      const manualMap = new Map((manualBiz || []).map((b: any) => [b.id, b]));
      manualActive.forEach((row: any) => {
        const biz = manualMap.get(row.business_id);
        if (biz) featuredManual.push(biz);
      });
    }

    if (process.env.RESEND_API_KEY) {
      const notifyOn = (manualRows || []).filter((row: any) => !row.notified_on_at).filter((row: any) => {
        const start = row.starts_at ? new Date(row.starts_at) : null;
        const end = row.ends_at ? new Date(row.ends_at) : null;
        const now = new Date();
        if (start && now < start) return false;
        if (end && now > end) return false;
        return true;
      });
      const notifyOff = (manualRows || []).filter((row: any) => !row.notified_off_at).filter((row: any) => {
        const end = row.ends_at ? new Date(row.ends_at) : null;
        return end && new Date() > end;
      });

      const notifyIds = Array.from(new Set([...notifyOn, ...notifyOff].map((r: any) => r.business_id).filter(Boolean)));
      if (notifyIds.length > 0) {
        const { data: notifyBiz } = await sb
          .from('businesses')
          .select('id, name, owner_email')
          .in('id', notifyIds);
        const notifyMap = new Map((notifyBiz || []).map((b: any) => [b.id, b]));

        for (const row of notifyOn) {
          const biz = notifyMap.get(row.business_id);
          if (biz?.owner_email) {
            await sendFeaturedOnEmail({ to: biz.owner_email, businessName: biz.name || 'Your business', durationDays: 7 }).catch(() => {});
            await sb.from('campus_featured').update({ notified_on_at: new Date().toISOString() }).eq('id', row.id);
          }
        }

        for (const row of notifyOff) {
          const biz = notifyMap.get(row.business_id);
          if (biz?.owner_email) {
            await sendFeaturedOffEmail({ to: biz.owner_email, businessName: biz.name || 'Your business' }).catch(() => {});
            await sb.from('campus_featured').update({ notified_off_at: new Date().toISOString() }).eq('id', row.id);
          }
        }
      }
    }
  }

  const autoFeaturedQuery = sb
    .from('businesses')
    .select('id, name, slug, description, address, lat, lng, service_tags, cover_url, media_urls, phone, website, calendly_url, rating, review_count, price_tier, availability_status, break_until, is_onboarded, edu_verified, campus_provider, school_domain, founder50, founder50_status, last_completed_booking_at, away_start, away_end, campus_key, featured_until, featured_on_notified_at, featured_off_notified_at, owner_email')
    .eq('is_onboarded', true)
    .eq('campus_provider', true)
    .gt('featured_until', nowIso);
  if (campusKey) {
    autoFeaturedQuery.eq('campus_key', campusKey);
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

  if (process.env.RESEND_API_KEY) {
    const autoNotifyOn = (autoFeaturedRows || []).filter((b: any) => !b.featured_on_notified_at);
    for (const biz of autoNotifyOn) {
      if (biz.owner_email) {
        await sendFeaturedOnEmail({ to: biz.owner_email, businessName: biz.name || 'Your business', durationDays: 7 }).catch(() => {});
        await sb.from('businesses').update({ featured_on_notified_at: new Date().toISOString() }).eq('id', biz.id);
      }
    }

    const autoExpiredQuery = sb
      .from('businesses')
      .select('id, name, owner_email, featured_until, featured_off_notified_at')
      .eq('campus_provider', true)
      .lt('featured_until', nowIso)
      .is('featured_off_notified_at', null);
    if (campusKey) {
      autoExpiredQuery.eq('campus_key', campusKey);
    }
    const { data: autoExpiredRows } = await autoExpiredQuery;
    for (const biz of autoExpiredRows || []) {
      if (biz.owner_email) {
        await sendFeaturedOffEmail({ to: biz.owner_email, businessName: biz.name || 'Your business' }).catch(() => {});
        await sb.from('businesses').update({ featured_off_notified_at: new Date().toISOString() }).eq('id', biz.id);
      }
    }
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
    if (b.founder50 && status && b.founder50_status !== status && b.founder50_status !== 'revoked') {
      sb.from('businesses').update({ founder50_status: status }).eq('id', b.id).catch(() => {});
      b.founder50_status = status;
    }
    return { ...b, price_tier: priceTier, rating, founder50_status: b.founder50_status ?? status };
  });

  const featuredIds = new Set<string>();
  const mergedFeatured = [...featuredManual, ...featuredAuto].filter((b: any) => {
    if (!b?.id) return false;
    if (featuredIds.has(b.id)) return false;
    featuredIds.add(b.id);
    return true;
  }).slice(0, FEATURED_LIMIT);

  const filteredBusinesses = enriched.filter((b: any) => !featuredIds.has(b.id));

  const sanitize = (b: any) => {
    const { owner_email, ...rest } = b || {};
    return rest;
  };

  return res.status(200).json({
    featured: mergedFeatured.map(sanitize),
    businesses: filteredBusinesses.map(sanitize),
  });
}
