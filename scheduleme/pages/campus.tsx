// @ts-nocheck
// pages/campus.tsx — GPS-first campus marketplace
// View feed with GPS, verify .edu to message/book
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

// Known campus coordinates — expand as you grow
const KNOWN_CAMPUSES = [
  { name: 'Arizona State University', domain: 'asu.edu', lat: 33.4255, lng: -111.9400, radius: 3 },
  { name: 'University of Arizona', domain: 'arizona.edu', lat: 32.2319, lng: -110.9501, radius: 3 },
  { name: 'UCLA', domain: 'ucla.edu', lat: 34.0689, lng: -118.4452, radius: 3 },
  { name: 'USC', domain: 'usc.edu', lat: 34.0224, lng: -118.2851, radius: 2 },
  { name: 'UT Austin', domain: 'utexas.edu', lat: 30.2849, lng: -97.7341, radius: 3 },
  { name: 'NYU', domain: 'nyu.edu', lat: 40.7295, lng: -73.9965, radius: 2 },
  { name: 'Columbia', domain: 'columbia.edu', lat: 40.8075, lng: -73.9626, radius: 2 },
  { name: 'Michigan', domain: 'umich.edu', lat: 42.2780, lng: -83.7382, radius: 3 },
];

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function mapCampusBusiness(b: any): Business {
  const rawTags = Array.isArray(b.service_tags)
    ? b.service_tags
    : (b.service_tags ? [String(b.service_tags)] : []);
  const tags = rawTags.filter(Boolean).map((t: any) => String(t));
  const category = tags.length > 0
    ? tags[0].charAt(0).toUpperCase() + tags[0].slice(1).replace(/_/g, ' ')
    : (b.category || 'General');
  const dist = b.address || 'Campus';
  return {
    id: b.id,
    realId: b.id,
    name: b.name || 'Campus Provider',
    slug: b.slug || b.id,
    description: b.description || '',
    tagline: b.description ? b.description.split('.')[0] : '',
    address: b.address || '',
    lat: b.lat,
    lng: b.lng,
    category,
    independent: true,
    available: true,
    distance: dist,
    rating: parseFloat(b.rating) || 4.5,
    reviews: b.review_count ?? 0,
    price_tier: b.price_tier ?? 2,
    coverUrl: getCover(tags, b.cover_url, b.media_urls),
    allImages: b.media_urls || [getCover(tags, b.cover_url, b.media_urls)],
    phone: b.phone || '',
    website: b.website || '',
    calendly_url: b.calendly_url || '',
    hours: [],
    services: [],
    about: b.description || '',
    badges: [],
  } as Business;
}

function detectNearestCampus(lat: number, lng: number) {
  let nearest = null;
  let minDist = Infinity;
  for (const campus of KNOWN_CAMPUSES) {
    const d = distanceMiles(lat, lng, campus.lat, campus.lng);
    if (d < campus.radius && d < minDist) {
      minDist = d;
      nearest = campus;
    }
  }
  return nearest;
}

const CAMPUS_CATEGORIES_DEFAULT = ['All', 'Hair & Beauty', 'Photography', 'Tutoring', 'Arts & Crafts', 'Moving', 'Handyman', 'Other'];

const CampusPage: NextPage = () => {
  const router = useRouter();
  const { dm } = useDm();
  const [loading, setLoading] = useState(true);
  const [gpsStatus, setGpsStatus] = useState<'checking' | 'on-campus' | 'off-campus' | 'denied'>('checking');
  const [detectedCampus, setDetectedCampus] = useState<typeof KNOWN_CAMPUSES[0] | null>(null);
  const [eduVerified, setEduVerified] = useState(false);
  const [schoolDomain, setSchoolDomain] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeBiz, setActiveBiz] = useState<Business | null>(null);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  // EDU verification flow
  const [showVerify, setShowVerify] = useState(false);
  const [schoolEmail, setSchoolEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const loadBusinesses = useCallback(async (domain: string | null) => {
    if (!domain) { setBusinesses([]); return; }
    try {
      const params = new URLSearchParams({ limit: '40', school_domain: domain });
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

  const loadNearbyEdu = useCallback(async (lat: number, lng: number, domain?: string | null) => {
    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        radius: '25',
        limit: '40',
        edu_only: 'true',
        campus_only: 'true',
      });
      if (domain) params.set('school_domain', domain);
      const res = await fetch(`/api/nearby-businesses?${params.toString()}`, {
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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/signin'); return; }

      // Check existing EDU verification
      const { data: profile } = await supabase
        .from('profiles').select('edu_verified, school_name')
        .eq('id', session.user.id).maybeSingle();

      if (profile?.edu_verified && profile?.school_name) {
        setEduVerified(true);
        setSchoolDomain(profile.school_name);
      } else {
        setEduVerified(false);
        setSchoolDomain(null);
      }
      // GPS detection
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            setUserLat(latitude);
            setUserLng(longitude);
            const campus = detectNearestCampus(latitude, longitude);
            if (campus) {
              setDetectedCampus(campus);
              setGpsStatus('on-campus');
            } else {
              setGpsStatus('off-campus');
            }
            loadNearbyEdu(latitude, longitude, campus?.domain || null);
          },
          () => {
            setGpsStatus('denied');
            if (profile?.edu_verified) loadBusinesses(profile.school_name);
          }
        );
      } else {
        setGpsStatus('denied');
        if (profile?.edu_verified) loadBusinesses(profile.school_name);
      }

      setLoading(false);
    });
  }, [router, loadBusinesses, loadNearbyEdu]);

  async function sendCode() {
    setSending(true); setVerifyError('');
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/verify-edu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ school_email: schoolEmail }),
      });
      const data = await res.json();
      if (!res.ok) { setVerifyError(data.error); return; }
      setCodeSent(true);
    } catch { setVerifyError('Something went wrong.'); }
    finally { setSending(false); }
  }

  async function verifyCode() {
    setVerifying(true); setVerifyError('');
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/verify-edu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'verify', code }),
      });
      const data = await res.json();
      if (!res.ok) { setVerifyError(data.error); return; }
      setEduVerified(true);
      setSchoolDomain(data.school_domain);
      setShowVerify(false);
      if (userLat != null && userLng != null) {
        loadNearbyEdu(userLat, userLng);
      } else {
        loadBusinesses(data.school_domain);
      }
    } catch { setVerifyError('Something went wrong.'); }
    finally { setVerifying(false); }
  }

  const filtered = businesses.filter(b =>
    activeCategory === 'All' || b.category === activeCategory
  );

  const canView = gpsStatus !== 'denied' || eduVerified;
  const campusName = detectedCampus?.name
    || (eduVerified && schoolDomain ? schoolDomain.replace('.edu', '').toUpperCase() : null)
    || (gpsStatus !== 'denied' ? 'Nearby' : 'Campus');

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
                {gpsStatus === 'on-campus' && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                    📍 Detected
                  </span>
                )}
                {eduVerified && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-accent text-white">
                    ✓ Verified
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5" style={{ color: dm ? '#6b7280' : '#9ca3af' }}>
                {canView ? 'Showing edu-verified providers near you' : 'Verify your .edu email to see your campus feed'}
              </p>
            </div>
            {!eduVerified && canView && (
              <button onClick={() => setShowVerify(true)}
                className="shrink-0 text-xs font-bold px-4 py-2 rounded-xl border transition-all"
                style={{ borderColor: '#007e6d', color: '#007e6d', background: dm ? 'rgba(10,132,255,0.1)' : '#EBF4FF' }}>
                Verify .edu →
              </button>
            )}
          </div>
        </div>

        {/* GPS checking */}
        {gpsStatus === 'checking' && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="relative h-8 w-8 mx-auto mb-3">
                <div className="absolute inset-0 rounded-full border-2 border-neutral-200" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
              </div>
              <p className="text-sm" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>Detecting your location…</p>
            </div>
          </div>
        )}

        {/* Not on campus + not verified */}
        {gpsStatus !== 'checking' && !canView && (
          <div className="max-w-md mx-auto px-6 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
              <svg className="h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
              </svg>
            </div>
            <h2 className="text-xl font-black mb-2" style={{ letterSpacing: '-0.025em', color: dm ? '#f3f4f6' : '#171717' }}>
              Access your campus feed
            </h2>
            <p className="text-sm mb-2" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
              {gpsStatus === 'denied'
                ? "Enable location to auto-detect your campus, or verify with your .edu email."
                : "You're not near a recognized campus. Verify your .edu email to access your campus feed."}
            </p>
            <p className="text-xs mb-8" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>
              Once verified, you never have to do this again.
            </p>
            {!showVerify ? (
              <button onClick={() => setShowVerify(true)} className="btn-primary px-8 py-3 text-sm">
                Verify .edu Email →
              </button>
            ) : renderVerifyForm()}
          </div>
        )}

        {/* Campus feed */}
        {gpsStatus !== 'checking' && canView && (
          <div className="max-w-5xl mx-auto px-6 py-8">

            {/* .edu verify prompt if GPS only */}
            {!eduVerified && (
              <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: dm ? 'rgba(10,132,255,0.1)' : '#EBF4FF', border: '1px solid rgba(10,132,255,0.2)' }}>
                <span className="text-sm" style={{ color: dm ? '#93c5fd' : '#1d4ed8' }}>
                  🔒 You can browse freely, but you'll need to verify your .edu email to message or book.
                </span>
                <button onClick={() => setShowVerify(true)}
                  className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: '#007e6d', color: 'white' }}>
                  Verify
                </button>
              </div>
            )}

            {/* Inline verify form */}
            {showVerify && !eduVerified && (
              <div className="mb-6 p-5 rounded-2xl border" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#e5e7eb' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-bold" style={{ color: dm ? '#f3f4f6' : '#171717' }}>Verify your .edu email</p>
                  <button onClick={() => { setShowVerify(false); setCodeSent(false); setCode(''); setVerifyError(''); }}
                    className="text-xs" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>Cancel</button>
                </div>
                {renderVerifyForm()}
              </div>
            )}

            {/* Category pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-6" style={{ scrollbarWidth: 'none' }}>
              {(businesses.length > 0 ? ['All', ...Array.from(new Set(businesses.map(b=>b.category).filter(Boolean)))] : CAMPUS_CATEGORIES_DEFAULT).map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border transition-all"
                  style={activeCategory === cat
                    ? { background: '#007e6d', borderColor: '#007e6d', color: 'white' }
                    : { background: dm ? 'rgba(10,132,255,0.15)' : '#EDF5FF', borderColor: dm ? 'rgba(10,132,255,0.3)' : 'transparent', color: dm ? '#93c5fd' : '#007e6d' }}>
                  {cat}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-4xl mb-4">🎓</p>
                <p className="font-semibold mb-2" style={{ color: dm ? '#f3f4f6' : '#171717' }}>
                  No edu-verified providers yet{detectedCampus ? ` for ${detectedCampus.name}` : ''}
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
                  <BizCard key={biz.id} biz={biz} onClick={() => { if (!eduVerified) { setShowVerify(true); return; } setActiveBiz(biz); }} dm={dm} index={i} />
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
