// pages/browse.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import { useDm } from '../lib/DarkModeContext';
import BusinessProfile from '../components/BusinessProfile';
import type { Business } from '../lib/mockBusinesses';
import { SkeletonCard, SkeletonBrowseCard } from '../components/SkeletonCard';
import { fetchAllBusinesses, fetchNearbyBusinesses } from '../lib/realBusinesses';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const CATEGORIES = ['All', 'Independent', 'Plumbing', 'House Cleaning', 'Electrical', 'HVAC', 'Landscaping', 'Painting', 'Handyman'];
type SortMode = 'distance' | 'rating' | 'reviews';
const SORT_LABELS: Record<SortMode, string> = { distance: 'Nearest', rating: 'Top Rated', reviews: 'Most Reviewed' };

// Uniform blue pill — same as home
const PILL_STYLE = { background: '#EBF4FF', color: '#1A6FD4' };

function MapPlaceholder({ businesses, selected, onSelect, dm }: {
  businesses: Business[]; selected: string | null; onSelect: (id: string) => void; dm?: boolean;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;
    // Dynamically import leaflet to avoid SSR issues
    import('leaflet').then(L => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      // Default center: use first business with coords, else San Francisco
      const validBiz = businesses.find(b => b.lat && b.lng && b.lat !== 0);
      const center: [number, number] = validBiz ? [validBiz.lat!, validBiz.lng!] : [37.7749, -122.4194];
      const map = L.map(mapRef.current!, { zoomControl: true, scrollWheelZoom: true });
      leafletMapRef.current = map;

      // OpenStreetMap tiles — free, no API key
      L.tileLayer(dm
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        { attribution: '© OpenStreetMap © CARTO', maxZoom: 19 }
      ).addTo(map);

      map.setView(center, 13);

      // Add markers
      markersRef.current = businesses.filter(b => b.lat && b.lng && b.lat !== 0).map(biz => {
        const isSel = selected === biz.id;
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            background: ${isSel ? '#0A84FF' : (dm ? 'rgba(28,28,30,0.95)' : 'rgba(255,255,255,0.97)')};
            color: ${isSel ? 'white' : (dm ? '#f2f2f7' : '#1c1c1e')};
            border: 1.5px solid ${isSel ? 'transparent' : (dm ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)')};
            padding: 5px 11px; border-radius: 20px; font-size: 12px; font-weight: 700;
            white-space: nowrap;
            box-shadow: ${isSel ? '0 4px 16px rgba(10,132,255,0.4)' : '0 2px 8px rgba(0,0,0,0.18)'};
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
            letter-spacing: -0.01em;
            transform: ${isSel ? 'scale(1.08)' : 'scale(1)'};
            transition: all 0.15s ease;
            backdrop-filter: blur(8px);
          ">${biz.name.split(' ').slice(0, 2).join(' ')}</div>`,
          iconAnchor: [40, 32],
        });
        const marker = L.marker([biz.lat!, biz.lng!], { icon })
          .addTo(map)
          .on('click', () => onSelect(biz.id));
        return { id: biz.id, marker };
      });
    });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [businesses, dm]);

  // Update marker styles when selection changes without re-rendering the whole map
  useEffect(() => {
    if (!leafletMapRef.current) return;
    import('leaflet').then(L => {
      markersRef.current.forEach(({ id, marker }) => {
        const biz = businesses.find(b => b.id === id);
        if (!biz) return;
        const isSel = selected === id;
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            background: ${isSel ? '#0A84FF' : (dm ? 'rgba(28,28,30,0.95)' : 'rgba(255,255,255,0.97)')};
            color: ${isSel ? 'white' : (dm ? '#f2f2f7' : '#1c1c1e')};
            border: 1.5px solid ${isSel ? 'transparent' : (dm ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)')};
            padding: 5px 11px; border-radius: 20px; font-size: 12px; font-weight: 700;
            white-space: nowrap;
            box-shadow: ${isSel ? '0 4px 16px rgba(10,132,255,0.4)' : '0 2px 8px rgba(0,0,0,0.18)'};
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
            letter-spacing: -0.01em;
            backdrop-filter: blur(8px);
          ">${biz.name.split(' ').slice(0, 2).join(' ')}</div>`,
          iconAnchor: [40, 32],
        });
        marker.setIcon(icon);
      });
    });
  }, [selected]);

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>{`
        .leaflet-control-zoom a {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif !important;
          font-weight: 700 !important;
          color: ${dm ? '#f3f4f6' : '#171717'} !important;
          background: ${dm ? '#171717' : 'white'} !important;
          border-color: ${dm ? '#404040' : '#e5e7eb'} !important;
        }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
          border-radius: 10px !important;
          overflow: hidden !important;
        }
        .leaflet-control-zoom a:hover {
          background: ${dm ? '#262626' : '#f5f5f5'} !important;
        }
        .leaflet-control-attribution {
          font-family: -apple-system, BlinkMacSystemFont, sans-serif !important;
          font-size: 9px !important;
          background: ${dm ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)'} !important;
          color: ${dm ? '#9ca3af' : '#6b7280'} !important;
          border-radius: 6px 0 0 0 !important;
        }
        .leaflet-control-attribution a {
          color: ${dm ? '#60a5fa' : '#0A84FF'} !important;
        }
      `}</style>
      <div ref={mapRef} className="w-full h-full" />
    </>
  );
}


// Same card design as home — full-bleed image, gradient overlay, pill + arrow row below
// Standard card — square image on mobile, clean vertical layout
function BizCard({ biz, onClick, dm, index = 0 }: { biz: Business; onClick: () => void; hero?: boolean; dm?: boolean; index?: number }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const cardBg = dm ? '#1c1c1e' : 'white';
  return (
    <button onClick={onClick} className="biz-card group w-full text-left flex flex-col animate-fade-up"
      style={{ animationDelay: `${index * 0.05}s`, borderRadius: 16, overflow: 'hidden', background: cardBg, boxShadow: dm ? '0 0 0 1px #2c2c2e' : '0 1px 4px rgba(0,0,0,0.08)' }}>
      {/* Square image */}
      <div className="relative flex-shrink-0 w-full" style={{ aspectRatio: '16/9', background: dm ? '#2c2c2e' : '#e5e7eb' }}>
        <img src={biz.coverUrl} alt={biz.name}
          onLoad={() => setImgLoaded(true)}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          style={{ objectPosition: 'center 25%', opacity: imgLoaded ? 1 : 0 }} />
        <div className="absolute top-2 left-2">
          {biz.available
            ? <div className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-emerald-700">Open</span>
              </div>
            : <div className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                <span className="text-[10px] font-bold text-white/70">Booked</span>
              </div>
          }
        </div>
      </div>
      {/* Body — one item per line */}
      <div className="p-3 flex flex-col gap-1" style={{ background: cardBg }}>
        <p className="font-bold text-[13px] leading-snug" style={{ color: dm ? '#f2f2f7' : '#1c1c1e', letterSpacing: '-0.01em' }}>{biz.name}</p>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full self-start" style={{ background: dm ? 'rgba(10,132,255,0.2)' : '#e8f0fe', color: '#0A84FF' }}>{biz.category}</span>
        <p className="text-[11px]" style={{ color: dm ? '#8e8e93' : '#8e8e93' }}>{biz.distance}</p>
        <div className="flex items-center gap-0.5">
          {[1,2,3,4,5].map(i => (
            <svg key={i} className={`h-3 w-3 ${i <= Math.round(biz.rating) ? 'text-amber-400' : (dm ? 'text-neutral-600' : 'text-neutral-200')}`} fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
          <span className="text-[11px] font-semibold ml-1" style={{ color: dm ? '#d1d5db' : '#374151' }}>{biz.rating}</span>
        </div>
        <p className="text-[11px]" style={{ color: dm ? '#8e8e93' : '#8e8e93' }}>{biz.reviews} review{biz.reviews !== 1 ? 's' : ''}</p>
      </div>
    </button>
  );
}


function ReferInline() {
  const [open, setOpen] = useState(false);
  const [bizName, setBizName] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) return (
    <div className="rounded-2xl border border-green-100 bg-green-50 px-5 py-4 text-center">
      <p className="text-sm font-semibold text-green-800">Referral received — we'll reach out to {bizName}.</p>
    </div>
  );

  if (!open) return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 flex items-center gap-4">
      <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
        <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-800">Don't see who you're looking for?</p>
        <p className="text-xs text-neutral-500 mt-0.5">Refer a local business you trust and we'll invite them.</p>
      </div>
      <button onClick={() => setOpen(true)}
        className="shrink-0 text-xs font-bold text-accent bg-blue-50 border border-blue-100 px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors uppercase tracking-wide">
        Refer a Business
      </button>
    </div>
  );

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-neutral-900">Who should we reach out to?</p>
        <button onClick={() => setOpen(false)} className="text-xs text-neutral-400 hover:text-neutral-600">Cancel</button>
      </div>
      <input type="text" value={bizName} onChange={e => setBizName(e.target.value)}
        placeholder="Their name or business name"
        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent" />
      <button disabled={!bizName.trim()} onClick={() => { if (bizName.trim()) setSent(true); }}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${bizName.trim() ? 'bg-accent text-white' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'}`}>
        Submit referral
      </button>
    </div>
  );
}

const BrowsePage: NextPage = () => {
  const router = useRouter();
  const { dm } = useDm();
  const [sortMode, setSortMode] = useState<SortMode>('distance');
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMapBiz, setSelectedMapBiz] = useState<string | null>(null);
  const [activeBiz, setActiveBiz] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'map'>('grid');
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 12;
  const [bizList, setBizList] = useState<Business[]>([]);
  const [bizLoading, setBizLoading] = useState(true);
  const [usingRealData, setUsingRealData] = useState(false);

  // Close sort dropdown on outside click
  useEffect(() => {
    if (!sortOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-sort-dropdown]')) setSortOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sortOpen]);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/signin'); return; }
      setLoading(false);
      // Always start fetching all businesses immediately — don't wait for geo
      const allPromise = fetchAllBusinesses();

      if (navigator.geolocation) {
        let geoResolved = false;
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            geoResolved = true;
            const real = await fetchNearbyBusinesses(pos.coords.latitude, pos.coords.longitude, { limit: 40 });
            if (real.length > 0) { setBizList(real); setUsingRealData(true); }
            else {
              // Geo worked but no nearby results — fall back to all
              const all = await allPromise;
              if (all.length > 0) { setBizList(all); setUsingRealData(true); }
              else { setBizList([]); }
            }
            setBizLoading(false);
          },
          async () => {
            // Geo denied or failed
            const real = await allPromise;
            if (real.length > 0) { setBizList(real); setUsingRealData(true); }
            else { setBizList([]); }
            setBizLoading(false);
          },
          { timeout: 3000 }
        );
        // If geo never fires (e.g. slow mobile), allPromise resolves and we use it
        const real = await allPromise;
        if (!geoResolved) {
          if (real.length > 0) { setBizList(real); setUsingRealData(true); }
          else { setBizList([]); }
          setBizLoading(false);
        }
      } else {
        const real = await allPromise;
        if (real.length > 0) { setBizList(real); setUsingRealData(true); }
        else { setBizList([]); }
        setBizLoading(false);
      }
    });
  }, [router]);

  useEffect(() => {
    if (router.query.category) setActiveCategory(router.query.category as string);
    if (router.query.q) setSearchQuery(router.query.q as string);
  }, [router.query]);

  useEffect(() => {
    if (router.query.biz) {
      const biz = bizList.find(b => b.id === router.query.biz);
      if (biz) setActiveBiz(biz);
    }
  }, [router.query.biz]);

  const filtered = bizList.filter(b => {
    const matchCat = activeCategory === 'All'
      || (activeCategory === 'Independent' ? b.independent === true : b.category === activeCategory);
    const matchSearch = !searchQuery
      || b.name.toLowerCase().includes(searchQuery.toLowerCase())
      || b.category.toLowerCase().includes(searchQuery.toLowerCase())
      || b.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  }).sort((a, b) => {
    if (sortMode === 'rating') return b.rating - a.rating;
    if (sortMode === 'reviews') return b.reviews - a.reviews;
    return parseFloat(a.distance) - parseFloat(b.distance);
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [activeCategory, searchQuery, sortMode]);

  const selectedMapBizData = bizList.find(b => b.id === selectedMapBiz) ?? ALL_BUSINESSES.find(b => b.id === selectedMapBiz) ?? null;

  if (loading) return (
    <>
      <Head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" /><title>Browse — ScheduleMe</title></Head>
      <Nav />
      <div className="min-h-screen pb-20 md:pb-0" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))', background: dm ? '#0a0a0a' : '#EDF5FF' }}>
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => <SkeletonBrowseCard key={i} />)}
        </div>
      </div>
    </>
  );

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <title>Browse — ScheduleMe</title></Head>

      <div className="min-h-screen pb-20 md:pb-0" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))', background: 'var(--page-bg, #EDF5FF)' }} data-page-bg="true">
        <Nav />

        {/* Hero header — flat solid blue, clean and readable */}
        <div className="border-b" style={{
          background: '#3b82f6',
          borderColor: 'rgba(0,0,0,0.08)'
        }}>
          <div className="relative mx-auto max-w-6xl px-6 pt-7 pb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Explore</p>
            <div className="flex items-center justify-between gap-4 mb-5">
              <h1 className="text-[1.9rem] font-black text-white" style={{ letterSpacing: '-0.03em', lineHeight: 1.1 }}>Browse Pros</h1>
              {/* View toggle — inside hero */}
              <div className="flex items-center rounded-xl p-1 flex-shrink-0" style={{ background: dm ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)' }}>
                {([
                  ['list', 'List', 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z'],
                  ['grid', 'Grid', 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z'],
                  ['map', 'Map', 'M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z'],
                ] as const).map(([mode, label, d]) => (
                  <button key={mode} onClick={() => setViewMode(mode as 'list' | 'grid' | 'map')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={viewMode === mode
                      ? { background: dm ? '#111111' : 'white', color: dm ? '#f3f4f6' : '#0A84FF', border: dm ? '1px solid #262626' : 'none' }
                      : { color: 'white', background: 'transparent' }}>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
                    </svg>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Search + sort row */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: dm ? 'rgba(255,255,255,0.4)' : '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input type="text" placeholder="Search businesses or services…"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all placeholder:text-neutral-400"
                  style={{ background: dm ? '#111111' : 'white', color: dm ? '#f3f4f6' : '#171717', border: dm ? '1px solid #2a2d3a' : '1px solid rgba(255,255,255,0.25)' }}
                />
              </div>
              {/* Custom sort dropdown */}
              <div className="relative flex-shrink-0" data-sort-dropdown>
                <button
                  onClick={() => setSortOpen(o => !o)}
                  className="flex items-center gap-2 pl-3.5 pr-3 py-2.5 rounded-xl text-sm font-semibold focus:outline-none" style={{ background: dm ? '#111111' : 'white', color: dm ? '#f3f4f6' : '#171717', border: dm ? '1px solid #2a2d3a' : '1px solid rgba(255,255,255,0.25)', minWidth: 130 }}>
                  <span className="flex-1 text-left">{SORT_LABELS[sortMode]}</span>
                  <svg className={`h-3.5 w-3.5 text-neutral-400 transition-transform duration-150 ${sortOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {sortOpen && (
                  <div className="absolute right-0 top-full mt-1.5 rounded-xl shadow-lg overflow-hidden z-50"
                    style={{ minWidth: 150, background: dm ? '#171717' : 'white', border: dm ? '1px solid #2a2d3a' : '1px solid rgba(0,0,0,0.07)' }}>
                    {(['distance', 'rating', 'reviews'] as const).map(mode => (
                      <button key={mode}
                        onClick={() => { setSortMode(mode); setSortOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent-wash flex items-center justify-between gap-3"
                        style={{ color: sortMode === mode ? '#0A84FF' : (dm ? '#d1d5db' : '#374151') }}>
                        {SORT_LABELS[mode]}
                        {sortMode === mode && (
                          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Category pills — white bar below hero */}
        <div className="border-b" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(0,0,0,0.06)' }}>
          <div className="flex justify-center gap-2 overflow-x-auto px-6 py-3" style={{ scrollbarWidth: 'none' }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all border"
                style={activeCategory === cat
                  ? { background: '#0A84FF', color: 'white', borderColor: '#0A84FF' }
                  : { background: dm ? 'rgba(10,132,255,0.15)' : '#EDF5FF', color: dm ? '#93c5fd' : '#0A84FF', borderColor: dm ? 'rgba(10,132,255,0.3)' : 'rgba(10,132,255,0.15)' }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="mx-auto max-w-6xl px-6 py-7">
          {viewMode !== 'map' ? (
            <>
              <p className="text-[10px] font-black text-accent/50 uppercase tracking-[0.14em] mb-5">
                {bizLoading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'business' : 'businesses'}`}
                {!bizLoading && totalPages > 1 && <span className="ml-2 text-neutral-300">· Page {page} of {totalPages}</span>}
              </p>
              {bizLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 9 }).map((_, i) => <SkeletonBrowseCard key={i} />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-24">
                  <p className="text-neutral-500 font-semibold">No results found</p>
                  <p className="text-neutral-400 text-sm mt-1">Try a different search or category</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up" style={{ alignItems: 'stretch', animationDuration: '0.3s' }}>
                  {paginated.map((biz, i) => (
                    <BizCard key={biz.id} biz={biz} onClick={() => setActiveBiz(biz)} dm={dm} index={i} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5 animate-fade-up" style={{ animationDuration: '0.3s' }}>
                  {paginated.map(biz => (
                    <button key={biz.id} onClick={() => setActiveBiz(biz)}
                      className="group w-full text-left flex gap-4 p-3 rounded-2xl border transition-all hover:-translate-y-0.5 animate-fade-up"
                      style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(10,132,255,0.1)', animationDelay: `${paginated.indexOf(biz) * 0.04}s` }}>
                      {/* Image with rounded corners */}
                      <div className="relative flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100" style={{ width: 110, height: 130 }}>
                        <img src={biz.coverUrl} alt={biz.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                          style={{ objectPosition: 'center 25%' }} />
                        {biz.available ? (
                          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full px-1.5 py-0.5"
                            style={{ background: 'rgba(255,255,255,0.95)' }}>
                            <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-500" />
                            <span className="text-[9px] font-black tracking-wide" style={{ color: dm ? 'white' : '#16a34a' }}>Open</span>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0 py-1.5 flex flex-col gap-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-[14px] leading-snug group-hover:text-accent transition-colors" style={{ letterSpacing: '-0.01em', color: dm ? '#f3f4f6' : '#171717' }}>{biz.name}</h3>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" data-pill style={PILL_STYLE}>{biz.category}</span>
                        </div>
                        <p className="text-[11px]" style={{ color: dm ? '#8e8e93' : '#8e8e93' }}>{biz.distance}</p>
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(i => (
                            <svg key={i} className={`h-2.5 w-2.5 ${i <= Math.round(biz.rating) ? 'text-amber-400' : (dm ? 'text-neutral-600' : 'text-neutral-200')}`} fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                          <span className="text-[11px] font-semibold ml-1" style={{ color: dm ? '#d1d5db' : '#404040' }}>{biz.rating}</span>
                        </div>
                        <p className="text-[11px]" style={{ color: dm ? '#8e8e93' : '#8e8e93' }}>{biz.reviews} review{biz.reviews !== 1 ? 's' : ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-8 mb-2">
                  <button onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={page === 1}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-30 disabled:cursor-not-allowed" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#e5e5e5', color: dm ? '#9ca3af' : '#525252' }}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="w-9 h-9 rounded-xl text-sm font-bold transition-all"
                      style={page === p
                        ? { background: '#0A84FF', color: 'white' }
                        : { background: dm ? '#171717' : 'white', color: dm ? '#9ca3af' : '#6b7280', border: dm ? '1px solid #2a2d3a' : '1px solid #e5e7eb' }}>
                      {p}
                    </button>
                  ))}
                  <button onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={page === totalPages}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-30 disabled:cursor-not-allowed" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#e5e5e5', color: dm ? '#9ca3af' : '#525252' }}>
                    Next
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>
              )}

              {filtered.length > 0 && (
                <div className="mt-5">
                  <ReferInline />
                </div>
              )}
            </>
          ) : (
            /* ── MAP VIEW ── */
            <div className="flex flex-col animate-fade-up" style={{ animationDuration: '0.3s' }}>
              {/* Map on top — mobile only */}
              <div className="md:hidden relative rounded-2xl overflow-hidden border border-neutral-200 shadow-sm mb-4"
                style={{ height: 300 }}>
                <MapPlaceholder businesses={filtered} selected={selectedMapBiz} onSelect={id => setSelectedMapBiz(id === selectedMapBiz ? null : id)} dm={dm} />
              </div>

              {/* Selected business card — below map on mobile */}
              {selectedMapBizData && (
                <div className="md:hidden rounded-2xl overflow-hidden border animate-fade-up mb-3"
                  style={{ background: dm ? '#171717' : 'white', borderColor: '#0A84FF' }}>
                  <div className="flex items-center gap-3 p-3">
                    <img src={selectedMapBizData.coverUrl} alt="" className="h-14 w-14 rounded-xl object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{selectedMapBizData.name}</p>
                      <p className="text-xs" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>{selectedMapBizData.category} · {selectedMapBizData.distance}</p>
                    </div>
                    <button onClick={() => setActiveBiz(selectedMapBizData)}
                      className="text-sm font-bold px-3 py-2 rounded-xl flex-shrink-0"
                      style={{ background: '#0A84FF', color: 'white' }}>View</button>
                    <button onClick={() => setSelectedMapBiz(null)}
                      className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: dm ? '#262626' : '#f5f5f5', color: dm ? '#9ca3af' : '#6b7280' }}>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Business list below map — mobile */}
              <div className="md:hidden space-y-2.5">
                <p className="text-[10px] font-black text-accent/50 uppercase tracking-[0.14em]">
                  {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
                </p>
                {filtered.map((biz, i) => (
                  <button key={biz.id}
                    onClick={() => setSelectedMapBiz(biz.id === selectedMapBiz ? null : biz.id)}
                    className={`flex-shrink-0 md:w-full text-left rounded-2xl overflow-hidden transition-all biz-card group animate-fade-up ${
                      selectedMapBiz === biz.id ? 'ring-2 ring-accent shadow-lg' : ''
                    }`}
                    style={{ animationDelay: `${i * 0.04}s`, opacity: selectedMapBiz && selectedMapBiz !== biz.id ? 0.3 : 1, transition: 'opacity 0.25s ease', filter: selectedMapBiz && selectedMapBiz !== biz.id ? 'grayscale(0.3)' : 'none' }}>
                    <div className="relative overflow-hidden bg-neutral-100" style={{ height: 110 }}>
                      <img src={biz.coverUrl} alt={biz.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        style={{ objectPosition: 'center 25%' }} />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%)' }} />
                      {biz.available ? (
                        <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5"
                          style={{ background: 'rgba(255,255,255,0.95)' }}>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-[9px] font-black" style={{ color: dm ? 'white' : '#16a34a' }}>Open</span>
                        </div>
                      ) : null}
                      <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5">
                        <p className="text-white text-[12px] font-black leading-tight" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>{biz.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <svg className="h-2.5 w-2.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-white/90 text-[10px] font-semibold">{biz.rating}</span>
                          <span className="text-white/40 text-[10px]">·</span>
                          <span className="text-white/70 text-[10px]">{biz.distance}</span>
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-2.5 bg-white flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" data-pill style={PILL_STYLE}>{biz.category}</span>
                      <span className="text-[10px] text-neutral-400 font-medium">{biz.reviews} reviews</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Desktop: two-column */}
              <div className="hidden md:flex gap-4" style={{ height: 560 }}>
                <div className="w-72 flex-shrink-0 overflow-y-auto space-y-2" style={{ scrollbarWidth: 'none' }}>
                  {filtered.map((biz, i) => (
                    <button key={biz.id}
                      onClick={() => setSelectedMapBiz(biz.id === selectedMapBiz ? null : biz.id)}
                      className="w-full text-left flex gap-3 p-3 rounded-2xl border transition-all group"
                      style={{
                        opacity: selectedMapBiz && selectedMapBiz !== biz.id ? 0.35 : 1,
                        transition: 'opacity 0.2s ease',
                        borderColor: selectedMapBiz === biz.id ? '#0A84FF' : (dm ? '#262626' : 'rgba(10,132,255,0.1)'),
                        background: dm ? '#171717' : 'white',
                      }}>
                      <div className="relative flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 56, height: 56 }}>
                        <img src={biz.coverUrl} alt={biz.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{biz.name}</p>
                        <p className="text-xs" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>{biz.category}</p>
                        <p className="text-xs" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>{biz.distance}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-3" style={{ flex: "1 1 0", minWidth: 0 }}>
                  <div className="relative rounded-2xl overflow-hidden border flex-1" style={{ borderColor: dm ? '#262626' : '#e5e7eb', aspectRatio: '1/1', minHeight: 0 }}>
                    <MapPlaceholder businesses={filtered} selected={selectedMapBiz} onSelect={id => setSelectedMapBiz(id === selectedMapBiz ? null : id)} dm={dm} />
                  </div>
                  {selectedMapBizData && (
                    <div className="rounded-2xl border p-3 flex items-center gap-3 animate-fade-up flex-shrink-0"
                      style={{ background: dm ? '#171717' : 'white', borderColor: '#0A84FF' }}>
                      <img src={selectedMapBizData.coverUrl} alt="" className="h-12 w-12 rounded-xl object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{selectedMapBizData.name}</p>
                        <p className="text-xs" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>{selectedMapBizData.category} · {selectedMapBizData.distance}</p>
                      </div>
                      <button onClick={() => setActiveBiz(selectedMapBizData)}
                        className="text-sm font-bold px-4 py-2 rounded-xl flex-shrink-0"
                        style={{ background: '#0A84FF', color: 'white' }}>View</button>
                      <button onClick={() => setSelectedMapBiz(null)}
                        className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: dm ? '#262626' : '#f5f5f5' }}>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeBiz && <BusinessProfile biz={activeBiz} onClose={() => setActiveBiz(null)} />}
    </>
  );
};

export default BrowsePage;
