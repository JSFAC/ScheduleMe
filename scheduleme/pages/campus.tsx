// @ts-nocheck
// pages/campus.tsx — Campus marketplace
// View feed, verify .edu to message/book
import type { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Nav from '../components/Nav';
import { useDm } from '../lib/DarkModeContext';
import BusinessProfile from '../components/BusinessProfile';
import { SkeletonCard } from '../components/SkeletonCard';
import type { Business } from '../lib/mockBusinesses';

const CATEGORY_COVERS: Record<string, string> = {
  plumbing: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80',
  electrical: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=900&q=80',
  hvac: 'https://images.unsplash.com/photo-1631545806609-b67a6ca855e4?w=900&q=80',
  cleaning: 'https://images.unsplash.com/photo-1581578731548-c64695cc695b?w=900&q=80',
  landscaping: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=900&q=80',
  painting: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=900&q=80',
  handyman: 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=900&q=80',
};

function getCover(service_tags: string[], cover_url?: string | null, media_urls?: string[] | null): string {
  if (cover_url) return cover_url;
  if (media_urls && media_urls.length > 0) return media_urls[0];
  for (const tag of (service_tags || [])) {
    const key = tag.toLowerCase().replace(/_/g,' ');
    if (CATEGORY_COVERS[key]) return CATEGORY_COVERS[key];
    if (CATEGORY_COVERS[tag.toLowerCase()]) return CATEGORY_COVERS[tag.toLowerCase()];
  }
  return 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&q=80';
}

function getOpenStatus(hours: { day: string; time: string }[]): { open: boolean; label: string } {
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
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

function deriveCampusTag(domain?: string | null): string | null {
  if (!domain) return null;
  const base = domain.split('.')[0]?.trim();
  if (!base) return null;
  return base.toUpperCase();
}

const CampusPage: NextPage = () => {
  const router = useRouter();
  const { dm } = useDm();
  const [loading, setLoading] = useState(true);
  const [eduVerified, setEduVerified] = useState<boolean | null>(null);
  const eduCache = typeof window !== 'undefined' ? localStorage.getItem('sm_edu_verified') : null;
  const [schoolDomain, setSchoolDomain] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeBiz, setActiveBiz] = useState<Business | null>(null);

  const loadCampusBusinesses = useCallback(async (tag: string | null, domain?: string | null) => {
    if (!tag && !domain) { setBusinesses([]); return; }
    try {
      const params = new URLSearchParams({ limit: '40' });
      if (tag) params.set('campus_school_name', tag);
      if (domain) params.set('school_domain', domain);
      const res = await fetch(`/api/campus-businesses?${params.toString()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store' },
      });
      if (!res.ok) { setBusinesses([]); return; }
      const json = await res.json();
      const rows = json?.businesses || [];
      setBusinesses(rows.map((b: any) => mapCampusBusiness(b)));
    } catch {
      setBusinesses([]);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/signin'); return; }

      if (eduCache === 'true') setEduVerified(true);

      // Check existing EDU verification
      const { data: profile } = await supabase
        .from('profiles').select('edu_verified, school_name, school_domain')
        .eq('id', session.user.id).maybeSingle();

      // Fallback: some verified users only have edu_verified on their business record
      const { data: biz } = await supabase
        .from('businesses')
        .select('edu_verified, school_domain')
        .eq('owner_email', session.user.email)
        .maybeSingle();

      if (cancelled) return;

      const profileVerified = profile?.edu_verified === true;
      const bizVerified = biz?.edu_verified === true;

      if (!profileVerified && !bizVerified) {
        setEduVerified(false);
        if (typeof window !== 'undefined') localStorage.setItem('sm_edu_verified', 'false');
        router.replace('/home');
        return;
      }

      setEduVerified(true);
      if (typeof window !== 'undefined') localStorage.setItem('sm_edu_verified', 'true');

      const emailDomain = session.user.email?.split('@')[1] || null;
      const schoolName = profile?.school_name || profile?.school_domain || biz?.school_domain || (emailDomain && emailDomain.endsWith('.edu') ? emailDomain : null);
      setSchoolDomain(schoolName);
      if (schoolName) loadCampusBusinesses(deriveCampusTag(schoolName), schoolName);

      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [router, loadCampusBusinesses, eduCache]);


  const filtered = businesses.filter(b =>
    activeCategory === 'All' || b.category === activeCategory
  );

  const canView = eduVerified === true;
  const campusCategories = businesses.length > 0
    ? ['All', ...Array.from(new Set(businesses.map(b => b.category).filter(Boolean))).sort()]
    : [];

  const campusName = (eduVerified && schoolDomain)
    ? schoolDomain.replace('.edu', '').toUpperCase()
    : 'Campus';

  if (loading) return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <title>Campus — ScheduleMe</title>
      </Head>
      <Nav />
      <div className="min-h-screen pb-20 md:pb-0" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))', background: dm ? '#0a0a0a' : '#EDF5FF' }}>
        <div className="h-[88px] border-b" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#e5e7eb' }} />
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </>
  );

  if (eduVerified === false) return null;

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <title>Campus — ScheduleMe</title></Head>
      <Nav />
      <div className="min-h-screen pb-20 md:pb-0" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))', background: dm ? '#0a0a0a' : '#EDF5FF' }}>

        {/* Header */}
        <div className="border-b" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#e5e7eb' }}>
          <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
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
          <div className="max-w-5xl mx-auto px-6 py-8">

            {/* .edu verify prompt */}

            {/* Inline verify form */}

            {/* Category pills */}
            {campusCategories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-6" style={{ scrollbarWidth: 'none' }}>
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

            {filtered.length === 0 ? (
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
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 animate-fade-up" style={{ alignItems: 'stretch', animationDuration: '0.3s' }}>
                {filtered.map((biz, i) => (
                  <BizCard key={biz.id} biz={biz} onClick={() => setActiveBiz(biz)} dm={dm} index={i} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {activeBiz && <BusinessProfile biz={activeBiz} onClose={() => setActiveBiz(null)} />}
    </>
  );

  // BizCard — matches Browse grid style
  function BizCard({ biz, onClick, dm, index = 0 }: { biz: Business; onClick: () => void; dm?: boolean; index?: number }) {
    const [imgLoaded, setImgLoaded] = useState(false);
    const cardBg = dm ? '#1c1c1e' : 'white';
    const status = getOpenStatus(biz.hours);
    return (
      <button onClick={onClick} className="biz-card group w-full text-left flex flex-col animate-fade-up"
        style={{ animationDelay: `${index * 0.05}s`, borderRadius: 18, overflow: 'hidden', background: cardBg, boxShadow: dm ? '0 0 0 1px #2c2c2e' : '0 2px 12px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)' }}>
        <div className="relative flex-shrink-0 w-full overflow-hidden" style={{ aspectRatio: '4/3', background: dm ? '#2c2c2e' : '#e5e7eb' }}>
          <img src={biz.coverUrl} alt={biz.name} onLoad={() => setImgLoaded(true)}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            style={{ objectPosition: 'center 25%', opacity: imgLoaded ? 1 : 0 }} />
        </div>
        <div className="px-3 py-2.5 flex flex-col gap-1" style={{ background: cardBg }}>
          <p className="font-bold text-[14px] leading-snug group-hover:text-accent transition-colors" style={{ color: dm ? '#f2f2f7' : '#1c1c1e', letterSpacing: '-0.02em' }}>{biz.name}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(0,126,109,0.2)' : 'rgba(0,126,109,0.12)', color: '#007e6d' }}>{biz.category}</span>
            {biz.price_tier ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(0,126,109,0.2)' : 'rgba(0,126,109,0.12)', color: '#007e6d' }}>{'$'.repeat(biz.price_tier)}</span> : null}
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: status.open ? (dm ? 'rgba(52,211,153,0.15)' : '#f0fdf4') : (dm ? 'rgba(255,255,255,0.07)' : '#f5f5f5'), color: status.open ? '#16a34a' : (dm ? '#6b7280' : '#9ca3af') }}>
              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${status.open ? 'bg-emerald-500' : 'bg-neutral-400'}`} />{status.label}
            </span>
          </div>
          <p className="text-[11px]" style={{ color: dm ? '#8e8e93' : '#8e8e93' }}>{biz.distance}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(i => (
                <svg key={i} className={`h-3 w-3 ${i <= Math.round(biz.rating) ? (dm ? 'text-neutral-300' : 'text-neutral-500') : (dm ? 'text-neutral-700' : 'text-neutral-200')}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-[12px] font-bold" style={{ color: dm ? '#d1d5db' : '#374151' }}>{biz.rating}</span>
            <span className="text-[11px]" style={{ color: dm ? '#6b7280' : '#9ca3af' }}>({biz.reviews})</span>
          </div>
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
