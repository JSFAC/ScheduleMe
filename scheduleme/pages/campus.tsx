// @ts-nocheck
// pages/campus.tsx — Campus marketplace
// View feed, verify .edu to message/book
import type { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { getSupabaseClient } from '../lib/supabaseClient';
import Link from 'next/link';
import Nav from '../components/Nav';
import { useDm } from '../lib/DarkModeContext';
import { SkeletonCard } from '../components/SkeletonCard';
import type { Business } from '../lib/mockBusinesses';
import { serviceTagToLabel } from '../lib/categoryNormalization';
import { shouldShowNewBadge } from '../lib/newBadge';
import { formatPriceTierLabel } from '../lib/priceTierLabel';

const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

function getCover(cover_url?: string | null, media_urls?: string[] | null): string {
  if (cover_url) return cover_url;
  if (media_urls && media_urls.length > 0) return media_urls[0];
  return TRANSPARENT_PIXEL;
}

function normalizeHours(hours: any): { day: string; time: string }[] {
  if (!hours) return [];
  if (Array.isArray(hours)) return hours as any;
  if (typeof hours === 'string') {
    try {
      const parsed = JSON.parse(hours);
      return normalizeHours(parsed);
    } catch {
      return [];
    }
  }
  if (typeof hours === 'object') {
    return Object.entries(hours).map(([day, time]) => ({ day, time: String(time) }));
  }
  return [];
}

function initials(name: string): string {
  if (!name) return '';
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function RatingStars({ rating, size = 12 }: { rating: number; size?: number }) {
  const safe = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <div className="flex items-center gap-0.5" aria-label={`${safe.toFixed(1)} stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, safe - i));
        return (
          <div key={i} className="relative" style={{ width: size, height: size }}>
            <svg className="absolute inset-0" width={size} height={size} viewBox="0 0 20 20" fill="#d1d5db">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <svg width={size} height={size} viewBox="0 0 20 20" fill="#facc15">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function mapCampusBusiness(b: any): Business {
  const rawTags = Array.isArray(b.service_tags)
    ? b.service_tags
    : (b.service_tags ? [String(b.service_tags)] : []);
  const tags = rawTags.filter(Boolean).map((t: any) => String(t));
  const category = tags.length > 0 ? serviceTagToLabel(tags[0]) : 'General';
  const dist = b.address || 'Local';
  const cover = getCover(b.cover_url, b.media_urls);
  const availability = b.availability_status ?? 'open';
  const breakUntil = b.break_until ? new Date(b.break_until) : null;
  const breakActive = availability === 'break' && breakUntil && !Number.isNaN(breakUntil.getTime()) && breakUntil.getTime() > Date.now();
  const effectiveAvailability = breakActive ? 'break' : (availability === 'break' ? 'open' : availability);
  return {
    id: b.id,
    realId: b.id,
    name: b.name || '',
    slug: b.slug || b.id,
    description: b.description || '',
    tagline: b.description ? b.description.split('.')[0] : '',
    address: b.address || '',
    lat: b.lat,
    lng: b.lng,
    category,
    independent: true,
    available: effectiveAvailability !== 'closed' && effectiveAvailability !== 'break',
    distance: dist,
    reviews: b.review_count ?? 0,
    rating: (b.review_count ?? 0) > 0 ? (typeof b.rating === 'number' ? b.rating : parseFloat(b.rating)) : null,
    price_tier: b.price_tier ?? null,
    availability_status: effectiveAvailability,
    break_until: breakUntil ? breakUntil.toISOString() : null,
    coverUrl: cover,
    allImages: b.media_urls || (cover ? [cover] : []),
    phone: b.phone || '',
    website: b.website || '',
    instagram: b.instagram || '',
    calendly_url: b.calendly_url || '',
    hours: normalizeHours(b.hours),
    services: [],
    about: b.description || '',
    badges: [],
    founder50: b.founder50 ?? null,
    founder50_status: b.founder50_status ?? null,
  } as Business;
}

function getOpenStatus(hours: { day: string; time: string }[], availability?: string | null, breakUntil?: string | null): { open: boolean; label: string } {
  if (availability === 'break') {
    if (breakUntil) {
      const dt = new Date(breakUntil);
      if (!Number.isNaN(dt.getTime())) {
        if (dt.getTime() > Date.now()) {
          const start = new Date();
          const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const endLabel = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return { open: false, label: `On break ${startLabel}–${endLabel}` };
        }
      }
    }
    return { open: false, label: 'On break' };
  }
  if (availability === 'closed') return { open: false, label: 'Closed' };
  if (availability === 'busy') return { open: true, label: 'Busy' };

  if (!hours || hours.length === 0) return { open: true, label: 'Open' };
  const now = new Date();
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayIdx = now.getDay();
  const todayName = dayNames[todayIdx];
  const tomorrowName = dayNames[(todayIdx + 1) % 7];
  function parseTime(t: string): number | null {
    const m = t.trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!m) return null;
    let h = parseInt(m[1]); const min = parseInt(m[2]); const ampm = m[3].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }
  function dayMatches(pattern: string, dayName: string): boolean {
    if (pattern.includes('–') || pattern.includes('-')) {
      const allDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      const abbrevMap: Record<string, string> = { Mon:'Monday',Tue:'Tuesday',Wed:'Wednesday',Thu:'Thursday',Fri:'Friday',Sat:'Saturday',Sun:'Sunday' };
      const sep = pattern.includes('–') ? '–' : '-';
      const parts = pattern.split(sep).map(p => p.trim());
      const start = abbrevMap[parts[0]] || parts[0];
      const end = abbrevMap[parts[1]] || parts[1];
      const si = allDays.indexOf(start), ei = allDays.indexOf(end), di = allDays.indexOf(dayName);
      if (si < 0 || ei < 0 || di < 0) return false;
      return si <= ei ? (di >= si && di <= ei) : (di >= si || di <= ei);
    }
    return pattern.includes(dayName) || pattern.includes(dayName.slice(0, 3));
  }
  const nowMins = now.getHours() * 60 + now.getMinutes();
  for (const h of hours) {
    if (h.time.toLowerCase() === 'by appointment') { if (dayMatches(h.day, todayName)) return { open: true, label: 'By appt' }; continue; }
    if (h.time.toLowerCase().includes('closed')) { if (dayMatches(h.day, todayName)) return { open: false, label: 'Closed today' }; continue; }
    const rangeParts = h.time.split('–').map(p => p.trim());
    if (rangeParts.length < 2) continue;
    const openM = parseTime(rangeParts[0]); const closeM = parseTime(rangeParts[1]);
    if (openM == null || closeM == null) continue;
    if (dayMatches(h.day, todayName)) {
      if (closeM < openM) {
        if (nowMins >= openM || nowMins <= closeM) return { open: true, label: 'Open now' };
      } else if (nowMins >= openM && nowMins <= closeM) return { open: true, label: 'Open now' };
      return { open: false, label: `Opens ${rangeParts[0]}` };
    }
    if (dayMatches(h.day, tomorrowName)) {
      return { open: false, label: `Opens ${rangeParts[0]} tomorrow` };
    }
  }
  return { open: true, label: 'Open' };
}

function getSupabase() {
  return getSupabaseClient();
}

function deriveCampusTag(domain?: string | null): string | null {
  if (!domain) return null;
  const base = domain.split('.')[0]?.trim();
  if (!base) return null;
  return base.toUpperCase();
}

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

function normalizeSchoolDomain(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.includes('.edu')) return trimmed;
  return null;
}

const CampusPage: NextPage = () => {
  const router = useRouter();
  const { dm } = useDm();
  const [loading, setLoading] = useState(true);
  const [eduVerified, setEduVerified] = useState<boolean | null>(null);
  const eduCache = typeof window !== 'undefined' ? localStorage.getItem('sm_edu_verified') : null;
  const [schoolDomain, setSchoolDomain] = useState<string | null>(null);
  const [campusTag, setCampusTag] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [featuredBusinesses, setFeaturedBusinesses] = useState<Business[]>([]);
  const [lastCampusFetch, setLastCampusFetch] = useState<{ url: string; status: number | null; error?: string } | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [eduDebug, setEduDebug] = useState<any>(null);
  const [campusLoaded, setCampusLoaded] = useState(false);

  useEffect(() => {
    if (router.query.debug === '1' || router.asPath.includes('debug=1')) setDebugEnabled(true);
  }, [router.query.debug, router.asPath]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState('recommended');
  const [featuredMobileIndex, setFeaturedMobileIndex] = useState(0);
  
  const loadCampusBusinesses = useCallback(async (tag: string | null, domain?: string | null) => {
    if (!tag && !domain) { setBusinesses([]); setFeaturedBusinesses([]); return; }
    setCampusLoaded(false);
    try {
      const fetchCampus = async (params: URLSearchParams) => {
        const url = `/api/campus-businesses?${params.toString()}`;
        const res = await fetch(`/api/campus-businesses?${params.toString()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-store' },
        });
        setLastCampusFetch({ url, status: res.status });
        if (!res.ok) return { businesses: [], featured: [] };
        return res.json().catch(() => ({ businesses: [], featured: [] }));
      };

      const buildParams = (opts: { tag?: string | null; domain?: string | null; includeKey?: boolean }) => {
        const params = new URLSearchParams({ limit: '40' });
        if (opts.tag) params.set('campus_school_name', opts.tag);
        if (opts.domain) params.set('school_domain', opts.domain);
        if (opts.includeKey) {
          const campusKey = normalizeCampusKey(opts.tag || null) || (opts.domain ? normalizeCampusKey(opts.domain) : null);
          if (campusKey) params.set('campus_key', campusKey);
        }
        return params;
      };

      const primary = await fetchCampus(buildParams({ tag, domain, includeKey: true }));
      let rows = primary?.businesses || [];
      let featured = primary?.featured || [];

      if (rows.length === 0 && featured.length === 0 && domain) {
        const retryDomain = await fetchCampus(buildParams({ domain, includeKey: false }));
        rows = retryDomain?.businesses || rows;
        featured = retryDomain?.featured || featured;
      }
      if (rows.length === 0 && featured.length === 0 && tag) {
        const retryTag = await fetchCampus(buildParams({ tag, includeKey: false }));
        rows = retryTag?.businesses || rows;
        featured = retryTag?.featured || featured;
      }

      const verifiedFeatured = (featured || []).filter((b: any) => b?.edu_verified);
      const verifiedRows = (rows || []).filter((b: any) => b?.edu_verified);
      setFeaturedBusinesses(verifiedFeatured.map((b: any) => mapCampusBusiness(b)));
      setBusinesses(verifiedRows.map((b: any) => mapCampusBusiness(b)));
    } catch (err: any) {
      setLastCampusFetch((prev) => prev ? { ...prev, error: err?.message || 'Fetch failed' } : { url: '', status: null, error: err?.message || 'Fetch failed' });
      setBusinesses([]);
      setFeaturedBusinesses([]);
    } finally {
      setCampusLoaded(true);
    }
  }, []);

  async function loadPinned(userId: string) {
    try {
      const supabase = getSupabase();
      const { data } = await supabase
        .from('favorites')
        .select('business_id')
        .eq('user_id', userId);
      const ids = new Set((data || []).map((r: any) => r.business_id));
      setPinnedIds(ids);
    } catch {}
  }

  async function togglePinned(bizId: string) {
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/signin'); return; }
      await loadPinned(session.user.id);
      const { data: existing } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('business_id', bizId)
        .maybeSingle();
      if (existing?.id) {
        await supabase.from('favorites').delete().eq('id', existing.id);
        setPinnedIds(prev => { const next = new Set(prev); next.delete(bizId); return next; });
      } else {
        await supabase.from('favorites').insert({ user_id: session.user.id, business_id: bizId });
        setPinnedIds(prev => new Set(prev).add(bizId));
      }
    } catch {}
  }

  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/signin'); return; }
      await loadPinned(session.user.id);

      const cacheKey = `sm_edu_verified_${session.user.id}`;
      const cacheTagKey = `sm_campus_tag_${session.user.id}`;
      const cachedVerified = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
      if (cachedVerified === 'true') setEduVerified(true);

      // Check EDU verification via API (service role to avoid RLS)
      let verified = false;
      let schoolName: string | null = null;
      let schoolEmail: string | null = null;
      let campusTagFromApi: string | null = null;
      try {
        const res = await fetch(`/api/edu-status?t=${Date.now()}${debugEnabled ? '&debug=1' : ''}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          verified = json?.verified === true;
          schoolName = json?.schoolDomain || null;
          schoolEmail = json?.schoolEmail || null;
          if (!schoolName && json?.schoolName) schoolName = json.schoolName;
          campusTagFromApi = json?.campusTag || null;
          if (debugEnabled) setEduDebug(json);
        }
      } catch {}

      // Fallback: read profile directly to resolve school domain/email
      let profileDomain: string | null = null;
      let profileTag: string | null = null;
      let profileVerified: boolean | null = null;
      try {
        const { data: profileById } = await supabase
          .from('profiles')
          .select('edu_verified, school_name, school_email')
          .eq('id', session.user.id)
          .maybeSingle();
        const profile = profileById?.edu_verified !== undefined
          ? profileById
          : (await supabase
            .from('profiles')
            .select('edu_verified, school_name, school_email')
            .eq('email', session.user.email || '')
            .maybeSingle()).data;
        if (profile) {
          profileVerified = profile.edu_verified === true;
          const emailDomain = profile.school_email?.split('@')[1] || null;
          profileDomain = normalizeSchoolDomain(emailDomain)
            || normalizeSchoolDomain(profile.school_name);
          profileTag = profile.school_name ? profile.school_name.toUpperCase() : null;
        }
      } catch {}

      if (cancelled) return;

      const debugFlag = router.asPath.includes('debug=1') || router.query.debug === '1';
      if (!verified && !profileVerified && cachedVerified !== 'true' && !debugFlag) {
        setEduVerified(false);
        if (typeof window !== 'undefined') localStorage.setItem(cacheKey, 'false');
        router.replace('/home');
        return;
      }

      if (debugFlag && !verified && !profileVerified && cachedVerified !== 'true') {
        setEduVerified(false);
      } else {
        setEduVerified(true);
      }
      if (typeof window !== 'undefined') localStorage.setItem(cacheKey, 'true');

      const emailDomain = session.user.email?.split('@')[1] || null;
      const schoolEmailDomain = schoolEmail?.split('@')[1] || null;
      const resolvedSchool = schoolName
        || profileDomain
        || (schoolEmailDomain && schoolEmailDomain.endsWith('.edu') ? schoolEmailDomain : null)
        || (emailDomain && emailDomain.endsWith('.edu') ? emailDomain : null);
      const resolvedTag = campusTagFromApi
        || deriveCampusTag(resolvedSchool)
        || profileTag
        || (schoolName ? schoolName.toUpperCase() : null);
      setSchoolDomain(resolvedSchool);
      setCampusTag(resolvedTag);
      if (typeof window !== 'undefined' && resolvedTag) localStorage.setItem(cacheTagKey, resolvedTag);
      if (resolvedTag || resolvedSchool) {
        await loadCampusBusinesses(resolvedTag, resolvedSchool);
      } else {
        setCampusLoaded(true);
      }

      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [router, loadCampusBusinesses, eduCache]);

  useEffect(() => {
    if (router.query.debug === '1') setDebugEnabled(true);
  }, [router.query.debug]);


  const allBusinesses = (() => {
    const seen = new Set<string>();
    const merged: Business[] = [];
    [...featuredBusinesses, ...businesses].forEach((b) => {
      if (!b?.id || seen.has(b.id)) return;
      seen.add(b.id);
      merged.push(b);
    });
    return merged;
  })();
  const featuredIds = new Set(featuredBusinesses.map(b => b.id));
  const mobileFeaturedMax = Math.max(0, featuredBusinesses.length - 1);
  useEffect(() => {
    if (featuredMobileIndex > mobileFeaturedMax) setFeaturedMobileIndex(0);
  }, [featuredMobileIndex, mobileFeaturedMax]);
  const search = searchTerm.trim().toLowerCase();
  const filtered = allBusinesses.filter(b => {
    if (activeCategory === 'Pinned') return pinnedIds.has(b.id);
    if (activeCategory !== 'All' && b.category !== activeCategory) return false;
    if (!search) return true;
    const hay = [b.name, b.description, b.category, b.distance, ...(b.services || [])].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(search);
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (sortMode === 'reviews') return (b.reviews || 0) - (a.reviews || 0);
    if (sortMode === 'az') return (a.name || '').localeCompare(b.name || '');
    return 0;
  });

  const canView = eduVerified === true;
  const categorySource = [...businesses, ...featuredBusinesses];
  const campusCategories = categorySource.length > 0
    ? ['All', 'Pinned', ...Array.from(new Set(categorySource.map(b => b.category).filter(Boolean))).sort()]
    : ['All', 'Pinned'];

  useEffect(() => {
    if (!campusCategories.includes(activeCategory)) setActiveCategory('All');
  }, [campusCategories.join('|')]);

  const campusName = (eduVerified && (schoolDomain || campusTag))
    ? (schoolDomain ? schoolDomain.replace('.edu', '').toUpperCase() : campusTag!)
    : 'Campus';

  if (loading) return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <title>Campus — ScheduleMe</title>
      </Head>
      <Nav />
      <div className="min-h-screen pb-[calc(132px+env(safe-area-inset-bottom,0px))] md:pb-0" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))', background: dm ? '#0a0a0a' : '#F4EFE6' }}>
        <div className="h-[88px] border-b" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#e5e7eb' }} />
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </>
  );

  if (eduVerified === false && !debugEnabled) return null;

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <title>Campus — ScheduleMe</title></Head>
      <Nav />
      <div className="min-h-screen pb-[calc(132px+env(safe-area-inset-bottom,0px))] md:pb-0" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))', background: dm ? '#0a0a0a' : '#F4EFE6' }}>

        {/* Header */}
        <div className="border-b" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#e5e7eb' }}>
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xl font-black" style={{ letterSpacing: '-0.025em', color: dm ? '#f3f4f6' : '#171717' }}>
                  🎓 {campusName}
                </span>
                {eduVerified && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-accent text-white">
                    ✓ Verified
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5" style={{ color: dm ? '#6b7280' : '#9ca3af' }}>
                Showing campus providers for your school
              </p>
            </div>
          </div>
        </div>

        {/* Campus feed */}
        {canView && (
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-8 sm:pt-5">
            {/* .edu verify prompt */}

            {/* Inline verify form */}

            <div
              className="md:hidden mb-5 rounded-2xl border p-3 space-y-3"
              style={{
                background: dm ? '#121212' : 'white',
                borderColor: dm ? '#262626' : 'rgba(15,118,110,0.16)',
              }}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border" style={{ background: dm ? '#171717' : '#fdfdfd', borderColor: dm ? '#2e2e2e' : 'rgba(15,118,110,0.16)' }}>
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Search by name, service, or category"
                      className="flex-1 bg-transparent text-sm outline-none min-w-0"
                      style={{ color: dm ? '#f3f4f6' : '#111827' }}
                    />
                  </div>
                </div>
                <div className="relative shrink-0">
                  <select
                    value={sortMode}
                    onChange={e => setSortMode(e.target.value)}
                    className="appearance-none text-[13px] font-semibold pl-8 pr-7 py-2.5 rounded-xl border w-[108px]"
                    style={{ background: dm ? '#171717' : '#fdfdfd', borderColor: dm ? '#2e2e2e' : 'rgba(15,118,110,0.16)', color: dm ? '#f3f4f6' : '#111827' }}
                  >
                    <option value="recommended">Sort</option>
                    <option value="rating">Rating</option>
                    <option value="reviews">Reviews</option>
                    <option value="az">A-Z</option>
                  </select>
                  <svg className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h18M7.5 12h9m-12 7.5h15" /></svg>
                  <svg className="h-3.5 w-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.3}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                </div>
              </div>

              {campusCategories.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {campusCategories.map(cat => (
                    <button key={cat} onClick={() => setActiveCategory(cat)}
                      className="shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold border transition-all"
                      style={activeCategory === cat
                        ? { background: '#007e6d', borderColor: '#007e6d', color: 'white' }
                        : { background: dm ? 'rgba(0,126,109,0.18)' : 'rgba(0,126,109,0.10)', borderColor: dm ? 'rgba(0,126,109,0.35)' : 'rgba(0,126,109,0.22)', color: dm ? '#6ee7b7' : '#007e6d' }}>
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden md:flex md:items-center md:justify-between gap-3 mb-5">
              <div className="flex-1">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ background: dm ? '#121212' : 'rgba(255,255,255,0.95)', borderColor: dm ? '#262626' : 'rgba(15,118,110,0.16)' }}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search by name, service, or category"
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: dm ? '#f3f4f6' : '#111827' }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>Sort</label>
                <select
                  value={sortMode}
                  onChange={e => setSortMode(e.target.value)}
                  className="text-xs font-semibold px-3 py-2 rounded-xl border"
                  style={{ background: dm ? '#121212' : 'rgba(255,255,255,0.95)', borderColor: dm ? '#262626' : 'rgba(15,118,110,0.16)', color: dm ? '#f3f4f6' : '#111827' }}
                >
                  <option value="recommended">Recommended</option>
                  <option value="rating">Highest rated</option>
                  <option value="reviews">Most reviewed</option>
                  <option value="az">A to Z</option>
                </select>
              </div>
            </div>

            {campusCategories.length > 0 && (
              <div className="hidden md:flex gap-2 overflow-x-auto pb-2 mb-6" style={{ scrollbarWidth: 'none' }}>
                {campusCategories.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    className="shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold border transition-all"
                    style={activeCategory === cat
                      ? { background: '#007e6d', borderColor: '#007e6d', color: 'white' }
                      : { background: dm ? 'rgba(0,126,109,0.18)' : 'rgba(0,126,109,0.10)', borderColor: dm ? 'rgba(0,126,109,0.35)' : 'rgba(0,126,109,0.22)', color: dm ? '#6ee7b7' : '#007e6d' }}>
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {featuredBusinesses.length > 0 && activeCategory === 'All' && !search && (
              <section className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold" style={{ color: dm ? '#f3f4f6' : '#111827' }}>Featured</p>
                    <p className="text-xs" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>Top campus providers this week</p>
                  </div>
                </div>
                <div className="md:hidden mb-3 rounded-2xl border p-2.5" style={{ borderColor: dm ? '#262626' : 'rgba(0,126,109,0.16)', background: dm ? '#121212' : 'rgba(255,255,255,0.65)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => setFeaturedMobileIndex((v) => Math.max(0, v - 1))}
                      disabled={featuredMobileIndex === 0}
                      className="h-8 w-8 rounded-xl flex items-center justify-center disabled:opacity-30"
                      style={{ background: dm ? '#1f1f1f' : 'white', border: dm ? '1px solid #2a2a2a' : '1px solid rgba(0,126,109,0.16)' }}
                      aria-label="Previous featured"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    </button>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: dm ? 'rgba(255,255,255,0.45)' : '#6b7280' }}>
                      {Math.min(featuredMobileIndex + 1, featuredBusinesses.length)}/{featuredBusinesses.length}
                    </p>
                    <button
                      onClick={() => setFeaturedMobileIndex((v) => Math.min(featuredBusinesses.length - 1, v + 1))}
                      disabled={featuredMobileIndex >= featuredBusinesses.length - 1}
                      className="h-8 w-8 rounded-xl flex items-center justify-center disabled:opacity-30"
                      style={{ background: dm ? '#1f1f1f' : 'white', border: dm ? '1px solid #2a2a2a' : '1px solid rgba(0,126,109,0.16)' }}
                      aria-label="Next featured"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    </button>
                  </div>
                  {featuredBusinesses[featuredMobileIndex] && (
                    <div className="mt-2">
                      <FeaturedMobileCard
                        biz={featuredBusinesses[featuredMobileIndex]}
                        dm={dm}
                        pinned={pinnedIds.has(featuredBusinesses[featuredMobileIndex].id)}
                        onTogglePin={togglePinned}
                        onClick={() => {
                          const biz = featuredBusinesses[featuredMobileIndex];
                          if (biz.slug || biz.realId || biz.id) window.location.href = '/biz/' + (biz.slug || biz.realId || biz.id);
                        }}
                      />
                    </div>
                  )}
                </div>
                {featuredBusinesses.length >= 3 ? (
                  <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-4">
                    {featuredBusinesses.map((biz, i) => (
                      <BizCard key={`featured-${biz.id}`} biz={biz} onClick={() => { if (biz.slug||biz.realId||biz.id) window.location.href='/biz/'+(biz.slug||biz.realId||biz.id); }} dm={dm} index={i} pinned={pinnedIds.has(biz.id)} onTogglePin={togglePinned} />
                    ))}
                  </div>
                ) : (
                  <div className="hidden md:flex flex-col md:flex-row md:justify-center gap-4">
                    {featuredBusinesses.map((biz, i) => (
                      <div key={`featured-${biz.id}`} className="w-full md:w-[300px]">
                        <BizCard biz={biz} onClick={() => { if (biz.slug||biz.realId||biz.id) window.location.href='/biz/'+(biz.slug||biz.realId||biz.id); }} dm={dm} index={i} pinned={pinnedIds.has(biz.id)} onTogglePin={togglePinned} />
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-5 border-t" style={{ borderColor: dm ? '#262626' : 'rgba(0,126,109,0.16)' }} />
              </section>
            )}

            {sorted.length === 0 && campusLoaded ? (
              <div className="text-center py-20">
                <p className="text-4xl mb-4">🎓</p>
                <p className="font-semibold mb-2" style={{ color: dm ? '#f3f4f6' : '#171717' }}>
                  No campus providers yet
                </p>
                <p className="text-sm mb-6" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                  Be the first verified campus service provider here.
                </p>
                <Link href="/business/signup" className="btn-primary text-sm px-6 py-2.5">
                  Apply as a campus provider →
                </Link>
                {debugEnabled && (
                  <div className="mt-6 mx-auto max-w-xl text-left text-xs rounded-xl p-4 border" style={{ background: dm ? '#0f172a' : '#f8fafc', borderColor: dm ? '#1f2937' : '#e5e7eb', color: dm ? '#e5e7eb' : '#374151' }}>
                    <p className="font-bold mb-2">Campus Debug</p>
                    <p>eduVerified: {String(eduVerified)}</p>
                    <p>schoolDomain: {String(schoolDomain)}</p>
                    <p>campusTag: {String(campusTag)}</p>
                    <p>lastFetchUrl: {lastCampusFetch?.url || 'n/a'}</p>
                    <p>lastFetchStatus: {lastCampusFetch?.status ?? 'n/a'}</p>
                    {lastCampusFetch?.error && <p>lastFetchError: {lastCampusFetch.error}</p>}
                    <p>businesses: {businesses.length}</p>
                    <p>featured: {featuredBusinesses.length}</p>
                    {eduDebug && (
                      <div className="mt-2 pt-2 border-t" style={{ borderColor: dm ? '#1f2937' : '#e5e7eb' }}>
                        <p>eduDebug: {JSON.stringify(eduDebug)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3" style={{ alignItems: 'stretch' }}>
                {sorted.filter((biz) => {
                  if (activeCategory === 'All' && !search) return !featuredIds.has(biz.id);
                  return true;
                }).map((biz, i) => (
                  <BizCard key={biz.id} biz={biz} onClick={() => { if (biz.slug||biz.realId||biz.id) window.location.href='/biz/'+(biz.slug||biz.realId||biz.id); }} dm={dm} index={i} pinned={pinnedIds.has(biz.id)} onTogglePin={togglePinned} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
          </>
  );

  // BizCard — matches Browse grid style
  function BizCard({ biz, onClick, dm, index = 0, pinned, onTogglePin }: { biz: Business; onClick: () => void; dm?: boolean; index?: number; pinned?: boolean; onTogglePin?: (id: string) => void }) {
    const [imgLoaded, setImgLoaded] = useState(false);
    const cardBg = dm ? '#1c1c1e' : 'white';
    const status = getOpenStatus(biz.hours, (biz as any).availability_status, (biz as any).break_until);
    const cardLabel = biz.category || 'Provider';
    const cardName = biz.name || '';
    const displayName = cardName || cardLabel;
    const cardInitials = initials(cardName || cardLabel);
    const website = String((biz as any).website || '').trim();
    const instagramRaw = String((biz as any).instagram || '').trim();
    const instagramHandle = instagramRaw
      ? instagramRaw.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/+$/, '')
      : '';
    return (
      <button onClick={onClick} className="biz-card group w-full text-left flex flex-col"
        style={{ borderRadius: 18, overflow: 'hidden', background: cardBg, boxShadow: dm ? '0 0 0 1px #2c2c2e' : '0 2px 12px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)' }}>
        <div className="relative flex-shrink-0 w-full overflow-hidden" style={{ aspectRatio: '4/3', background: dm ? '#2c2c2e' : '#e5e7eb' }}>
          {biz.coverUrl && biz.coverUrl !== TRANSPARENT_PIXEL ? (
            <img src={biz.coverUrl} alt={cardLabel} onLoad={() => setImgLoaded(true)}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              style={{ objectPosition: 'center 25%', opacity: imgLoaded ? 1 : 0 }} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ background: dm ? '#242426' : '#e5e7eb' }}>
              {cardInitials ? (
                <span className="text-lg font-bold" style={{ color: dm ? '#d1d5db' : '#6b7280' }}>{cardInitials}</span>
              ) : null}
              <span className="text-[11px] font-semibold" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>No photos added</span>
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePin?.(biz.id); }}
            className="absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center transition-transform active:scale-90"
            style={{ background: pinned ? 'rgba(16,185,129,0.18)' : (dm ? 'rgba(255,255,255,0.08)' : '#f3f4f6'), border: '1px solid ' + (pinned ? 'rgba(16,185,129,0.45)' : (dm ? 'rgba(255,255,255,0.12)' : '#e5e7eb')) }}
            aria-label={pinned ? 'Unpin' : 'Pin'}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke={pinned ? '#10b981' : (dm ? '#9ca3af' : '#6b7280')} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 4l6 6-3 3 1 4-4-1-3 3-6-6 3-3-1-4 4 1 3-3z" />
              <path d="M9 15l-5 5" />
            </svg>
          </button>
          {(biz as any).founder50 && !['paused','revoked'].includes(String((biz as any).founder50_status || '')) && (
            <div
              className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{
                background: 'rgba(0,0,0,0.6)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.18)',
                backdropFilter: 'blur(6px)',
              }}
            >
              Founder50
            </div>
          )}
        </div>
        <div className="px-3 py-2.5 flex flex-col gap-1" style={{ background: cardBg }}>
          <p className="text-[13px] sm:text-sm font-semibold leading-tight line-clamp-2" style={{ color: dm ? '#f3f4f6' : '#111827' }}>
            {displayName}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(0,126,109,0.2)' : 'rgba(0,126,109,0.12)', color: '#007e6d' }}>{biz.category}</span>
            {formatPriceTierLabel(biz.price_tier) ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(0,126,109,0.2)' : 'rgba(0,126,109,0.12)', color: '#007e6d' }}>{formatPriceTierLabel(biz.price_tier)}</span> : null}
            {shouldShowNewBadge({ createdAt: (biz as any).created_at, reviewCount: biz.reviews }) && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(251,191,36,0.18)' : '#fef3c7', color: dm ? '#f59e0b' : '#92400e' }}>New</span>
            )}
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: status.open ? (dm ? 'rgba(52,211,153,0.15)' : '#f0fdf4') : (dm ? 'rgba(255,255,255,0.07)' : '#f5f5f5'), color: status.open ? '#16a34a' : (dm ? '#6b7280' : '#9ca3af') }}>
              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${status.open ? 'bg-emerald-500' : 'bg-neutral-400'}`} />{status.label}
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px]" style={{ color: dm ? '#8e8e93' : '#8e8e93' }}>{biz.distance}</p>
          {(website || instagramHandle) && (
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {website && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: dm ? '#d1d5db' : '#4b5563' }}>
                  Website
                </span>
              )}
              {instagramHandle && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: dm ? '#d1d5db' : '#4b5563' }}>
                  @{instagramHandle}
                </span>
              )}
            </div>
          )}
          {(biz.reviews ?? 0) > 0 && biz.rating != null && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <RatingStars rating={Number(biz.rating)} size={12} />
              <span className="text-[12px] font-bold" style={{ color: dm ? '#d1d5db' : '#374151' }}>{biz.rating}</span>
              <span className="text-[11px]" style={{ color: dm ? '#6b7280' : '#9ca3af' }}>({biz.reviews})</span>
            </div>
          )}
        </div>
      </button>
    );
  }

  function FeaturedMobileCard({ biz, dm, onClick, pinned, onTogglePin }: { biz: Business; dm?: boolean; onClick: () => void; pinned?: boolean; onTogglePin?: (id: string) => void }) {
    const status = getOpenStatus(biz.hours, (biz as any).availability_status, (biz as any).break_until);
    const displayName = biz.name || biz.category || 'Provider';
    const hasCover = !!biz.coverUrl && biz.coverUrl !== TRANSPARENT_PIXEL;
    return (
      <button
        onClick={onClick}
        className="w-full text-left rounded-2xl border p-2.5 flex gap-2.5"
        style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(0,0,0,0.08)' }}
      >
        <div className="relative shrink-0 rounded-xl overflow-hidden" style={{ width: 104, height: 92, background: dm ? '#2c2c2e' : '#e5e7eb' }}>
          {hasCover ? (
            <img src={biz.coverUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
              No photo
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePin?.(biz.id); }}
            className="absolute right-1.5 top-1.5 h-6 w-6 rounded-full flex items-center justify-center"
            style={{ background: pinned ? 'rgba(16,185,129,0.18)' : 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.22)' }}
            aria-label={pinned ? 'Unpin' : 'Pin'}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke={pinned ? '#34d399' : 'white'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 4l6 6-3 3 1 4-4-1-3 3-6-6 3-3-1-4 4 1 3-3z" />
              <path d="M9 15l-5 5" />
            </svg>
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-black leading-tight line-clamp-2" style={{ color: dm ? '#f3f4f6' : '#111827', letterSpacing: '-0.02em' }}>{displayName}</p>
          {biz.tagline && <p className="mt-1 text-[12px] leading-snug line-clamp-2" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>{biz.tagline}</p>}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(0,126,109,0.2)' : 'rgba(0,126,109,0.12)', color: '#007e6d' }}>{biz.category}</span>
            {shouldShowNewBadge({ createdAt: (biz as any).created_at, reviewCount: biz.reviews }) && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(251,191,36,0.18)' : '#fef3c7', color: dm ? '#f59e0b' : '#92400e' }}>New</span>
            )}
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: status.open ? (dm ? 'rgba(52,211,153,0.15)' : '#f0fdf4') : (dm ? 'rgba(255,255,255,0.08)' : '#f5f5f5'), color: status.open ? '#16a34a' : (dm ? '#9ca3af' : '#9ca3af') }}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.open ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: dm ? '#8e8e93' : '#8e8e93' }}>{biz.distance}</p>
        </div>
      </button>
    );
  }

  function renderVerifyForm() {
    return !codeSent ? (
      <div className="space-y-3">
        <input type="email" placeholder="you@university.edu" value={schoolEmail}
          onChange={e => setSchoolEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          style={{ background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : '#e5e7eb', color: dm ? '#f3f4f6' : '#171717' }} />
        {verifyError && <p className="text-xs text-red-500">{verifyError}</p>}
        <button onClick={sendCode} disabled={sending || !schoolEmail.endsWith('.edu')}
          className="w-full py-3 rounded-xl btn-primary text-sm font-semibold disabled:opacity-50">
          {sending ? 'Sending…' : 'Send Verification Code'}
        </button>
      </div>
    ) : (
      <div className="space-y-3">
        <p className="text-sm text-center" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
          Code sent to <strong>{schoolEmail}</strong>
        </p>
        <input type="text" placeholder="123456" value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full px-4 py-3 rounded-xl border text-center text-2xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-accent"
          style={{ background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : '#e5e7eb', color: dm ? '#f3f4f6' : '#171717' }}
          maxLength={6} />
        {verifyError && <p className="text-xs text-red-500 text-center">{verifyError}</p>}
        <button onClick={verifyCode} disabled={verifying || code.length !== 6}
          className="w-full py-3 rounded-xl btn-primary text-sm font-semibold disabled:opacity-50">
          {verifying ? 'Verifying…' : 'Verify Code'}
        </button>
        <button onClick={() => { setCodeSent(false); setCode(''); setVerifyError(''); }}
          className="w-full text-xs text-center" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>
          Use a different email
        </button>
      </div>
    );
  }
};

export default CampusPage;
