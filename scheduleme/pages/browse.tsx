// pages/browse.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import { useDarkMode } from '../lib/useDarkMode';
import BusinessProfile from '../components/BusinessProfile';
import { ALL_BUSINESSES, type Business } from '../lib/mockBusinesses';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const CATEGORIES = ['All', 'Independent', 'Plumbing', 'House Cleaning', 'Electrical', 'HVAC', 'Landscaping', 'Painting', 'Handyman'];
type SortMode = 'distance' | 'rating' | 'reviews';
const SORT_LABELS: Record<SortMode, string> = { distance: 'Nearest', rating: 'Top Rated', reviews: 'Most Reviewed' };

// Uniform blue pill — same as home
const PILL_STYLE = { background: '#EBF4FF', color: '#1A6FD4' };

function MapPlaceholder({ businesses, selected, onSelect }: {
  businesses: Business[]; selected: string | null; onSelect: (id: string) => void;
}) {
  return (
    <div className="relative w-full h-full bg-[#e8ecf0] overflow-hidden">
      <div className="absolute inset-0" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 500 600" preserveAspectRatio="xMidYMid slice">
        <rect x="0" y="0" width="500" height="600" fill="#e8ecf0" />
        <rect x="0" y="145" width="500" height="10" fill="#fff" opacity="0.7" />
        <rect x="0" y="275" width="500" height="8" fill="#fff" opacity="0.6" />
        <rect x="95" y="0" width="10" height="600" fill="#fff" opacity="0.7" />
        <rect x="245" y="0" width="8" height="600" fill="#fff" opacity="0.6" />
        <rect x="380" y="0" width="6" height="600" fill="#fff" opacity="0.5" />
        <rect x="108" y="158" width="128" height="108" fill="#dde3e9" rx="4" />
        <rect x="258" y="158" width="112" height="75" fill="#dde3e9" rx="4" />
        <rect x="10" y="158" width="76" height="75" fill="#dde3e9" rx="4" />
        <rect x="108" y="290" width="128" height="90" fill="#dde3e9" rx="4" />
        <rect x="258" y="290" width="112" height="90" fill="#dde3e9" rx="4" />
        <rect x="396" y="158" width="90" height="90" fill="#dde3e9" rx="4" />
      </svg>
      {businesses.map((biz, i) => {
        const x = 40 + (i * 51) % 400;
        const y = 60 + (i * 67) % 460;
        const isSel = selected === biz.id;
        return (
          <button key={biz.id} onClick={() => onSelect(biz.id)}
            style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -100%)', zIndex: isSel ? 10 : 1 }}>
            <div className="flex flex-col items-center">
              <div className={`px-2.5 py-1 rounded-lg text-xs font-bold shadow-md whitespace-nowrap transition-all ${
                isSel ? 'bg-neutral-900 text-white scale-110 shadow-xl' : 'bg-white text-neutral-800 hover:bg-neutral-900 hover:text-white shadow'
              }`}>
                {biz.name.split(' ').slice(0, 2).join(' ')}
              </div>
              <div className={`w-1.5 h-1.5 rotate-45 -mt-0.5 ${isSel ? 'bg-neutral-900' : 'bg-white'} shadow-sm`} />
            </div>
          </button>
        );
      })}
      <div className="absolute bottom-3 right-3 text-[10px] text-neutral-400 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-md font-medium">Live map coming soon</div>
    </div>
  );
}

// Same card design as home — full-bleed image, gradient overlay, pill + arrow row below
// Standard card used in grid view
function BizCard({ biz, onClick, hero }: { biz: Business; onClick: () => void; hero?: boolean }) {
  return (
    <button onClick={onClick} className="biz-card group w-full text-left flex flex-col">
      <div className="relative overflow-hidden bg-neutral-100 flex-shrink-0" style={{ height: 210 }}>
        <img src={biz.coverUrl} alt={biz.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" style={{ objectPosition: 'center 20%' }} />
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.08) 52%, transparent 100%)'
        }} />
        {biz.available ? (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 shadow-sm"
            style={{ background: 'rgba(255,255,255,0.96)' }}>
            <span className="h-2 w-2 rounded-full shrink-0 bg-emerald-500" />
            <span className="text-[10px] font-black tracking-wide text-emerald-600">Open</span>
          </div>
        ) : (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/52 backdrop-blur-sm rounded-full px-2.5 py-1">
            <span className="h-2 w-2 rounded-full bg-neutral-400 shrink-0" />
            <span className="text-[10px] font-bold text-white/60 tracking-wide">Fully Booked</span>
          </div>
        )}
        {biz.badge && (
          <div className="absolute top-3 right-3 text-white text-[9px] font-black px-2.5 py-1 rounded-full tracking-wide"
            style={{ background: 'rgba(0,0,0,0.58)', backdropFilter: 'blur(8px)' }}>
            {biz.badge}
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <p className="text-white font-black leading-snug" style={{
            fontSize: 13,
            letterSpacing: '-0.01em',
            textShadow: '0 1px 8px rgba(0,0,0,0.55)'
          }}>
            {biz.name}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(i => (
                <svg key={i} className={`h-2.5 w-2.5 ${i <= Math.round(biz.rating) ? 'text-amber-400' : 'text-white/20'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-white/90 font-semibold" style={{ fontSize: 10 }}>{biz.rating}</span>
            <span className="text-white/35 text-[10px]">·</span>
            <span className="text-white/55 text-[10px]">{biz.reviews} reviews</span>
            <span className="text-white/35 text-[10px]">·</span>
            <span className="text-white/65 text-[10px]">{biz.distance}</span>
          </div>
        </div>
      </div>
      {/* Card body */}
      <div className="px-3.5 pt-3 pb-3.5 flex-1" style={{ minHeight: 118, overflow: 'hidden' }}>
        <p className="text-[12px] text-neutral-500 leading-snug line-clamp-2 mb-2">{biz.tagline}</p>
        {biz.topReview && (
          <div className="mb-2.5">
            <p className="text-[11px] text-neutral-500 leading-snug line-clamp-2 italic mb-1.5">{biz.topReview}</p>
            {biz.reviewer && (
              <div className="flex items-center gap-1.5">
                <img src={biz.reviewer.avatarUrl} alt={biz.reviewer.name}
                  className="h-5 w-5 rounded-full object-cover border border-neutral-100" />
                <span className="text-[10.5px] font-semibold text-neutral-400">{biz.reviewer.name}</span>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="flex" style={{ gap: 0 }}>
              {biz.allImages.slice(1, 3).map((url, i) => (
                <div key={i} className="h-5 w-5 rounded-full overflow-hidden bg-neutral-100 border-2 border-white shadow-sm flex-shrink-0"
                  style={{ marginLeft: i === 0 ? 0 : -4, zIndex: 2 - i }}>
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <span className="text-[10px] text-neutral-400">{biz.reviews} reviews</span>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0" style={PILL_STYLE}>
            {biz.category}
          </span>
        </div>
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
  useDarkMode(); // apply persisted dark mode
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/signin'); return; }
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    if (router.query.category) setActiveCategory(router.query.category as string);
    if (router.query.q) setSearchQuery(router.query.q as string);
  }, [router.query]);

  useEffect(() => {
    if (router.query.biz) {
      const biz = ALL_BUSINESSES.find(b => b.id === router.query.biz);
      if (biz) setActiveBiz(biz);
    }
  }, [router.query.biz]);

  const filtered = ALL_BUSINESSES.filter(b => {
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

  const selectedMapBizData = ALL_BUSINESSES.find(b => b.id === selectedMapBiz) ?? null;

  if (loading) return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="relative h-6 w-6">
        <div className="absolute inset-0 rounded-full border-2 border-neutral-200" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
      </div>
    </div>
  );

  return (
    <>
      <Head><title>Browse — ScheduleMe</title></Head>

      <div className="min-h-screen pt-[72px]" data-page-bg="true" style={{ background: 'var(--page-bg, #EDF5FF)' }}>
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
              <div className="flex items-center rounded-xl p-1 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)' }}>
                {([
                  ['list', 'List', 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z'],
                  ['grid', 'Grid', 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z'],
                  ['map', 'Map', 'M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z'],
                ] as const).map(([mode, label, d]) => (
                  <button key={mode} onClick={() => setViewMode(mode as 'list' | 'grid' | 'map')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={viewMode === mode
                      ? { background: 'white', color: '#0A84FF' }
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
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input type="text" placeholder="Search businesses or services…"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all placeholder:text-neutral-400"
                  style={{ background: 'white', color: '#171717', border: '1px solid rgba(255,255,255,0.3)' }}
                />
              </div>
              {/* Custom sort dropdown */}
              <div className="relative flex-shrink-0" data-sort-dropdown>
                <button
                  onClick={() => setSortOpen(o => !o)}
                  className="flex items-center gap-2 pl-3.5 pr-3 py-2.5 rounded-xl text-sm font-semibold focus:outline-none"
                  style={{ background: 'white', color: '#171717', border: '1px solid rgba(255,255,255,0.3)', minWidth: 130 }}>
                  <span className="flex-1 text-left">{SORT_LABELS[sortMode]}</span>
                  <svg className={`h-3.5 w-3.5 text-neutral-400 transition-transform duration-150 ${sortOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {sortOpen && (
                  <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-lg overflow-hidden z-50"
                    style={{ minWidth: 150, border: '1px solid rgba(0,0,0,0.07)' }}>
                    {(['distance', 'rating', 'reviews'] as const).map(mode => (
                      <button key={mode}
                        onClick={() => { setSortMode(mode); setSortOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent-wash flex items-center justify-between gap-3"
                        style={{ color: sortMode === mode ? '#0A84FF' : '#374151' }}>
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
        <div className="bg-white border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <div className="flex justify-center gap-2 overflow-x-auto px-6 py-3" style={{ scrollbarWidth: 'none' }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                  activeCategory === cat
                    ? 'bg-accent text-white'
                    : 'bg-accent-wash text-accent/70 border border-accent/15 hover:border-accent/30 hover:text-accent'
                }`}>
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
                {filtered.length} {filtered.length === 1 ? 'business' : 'businesses'}
                {totalPages > 1 && <span className="ml-2 text-neutral-300">· Page {page} of {totalPages}</span>}
              </p>
              {filtered.length === 0 ? (
                <div className="text-center py-24">
                  <p className="text-neutral-500 font-semibold">No results found</p>
                  <p className="text-neutral-400 text-sm mt-1">Try a different search or category</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4" style={{ alignItems: 'stretch' }}>
                  {paginated.map((biz) => (
                    <BizCard key={biz.id} biz={biz} onClick={() => setActiveBiz(biz)} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {paginated.map(biz => (
                    <button key={biz.id} onClick={() => setActiveBiz(biz)}
                      className="biz-card group w-full text-left flex overflow-hidden" style={{ minHeight: 148 }}>
                      <div className="relative w-40 sm:w-48 flex-shrink-0 overflow-hidden bg-neutral-100" style={{ height: 148 }}>
                        <img src={biz.coverUrl} alt={biz.name}
                          className="w-full h-full object-cover" style={{ objectPosition: 'center 25%' }} />
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, transparent 60%, rgba(0,0,0,0.18) 100%)' }} />
                        {biz.available ? (
                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full px-2 py-0.5 shadow-sm"
                            style={{ background: 'rgba(255,255,255,0.96)' }}>
                            <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-500" />
                            <span className="text-[9px] font-black tracking-wide text-emerald-600">Open</span>
                          </div>
                        ) : (
                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-black/55 backdrop-blur-sm rounded-full px-2 py-0.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 shrink-0" />
                            <span className="text-[9px] font-bold text-white/70 tracking-wide">Fully Booked</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 px-4 py-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-0.5">
                            <h3 className="font-bold text-neutral-900 text-[15px] leading-snug group-hover:text-accent transition-colors" style={{ letterSpacing: '-0.01em' }}>{biz.name}</h3>
                            {biz.badge && (
                              <span className="shrink-0 text-[9px] font-bold bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full tracking-wide uppercase">{biz.badge}</span>
                            )}
                          </div>
                          <p className="text-[11.5px] text-neutral-500 leading-snug line-clamp-2 mt-0.5">{biz.tagline}</p>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1.5">
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map(i => (
                                <svg key={i} className={`h-2.5 w-2.5 ${i <= Math.round(biz.rating) ? 'text-amber-400' : 'text-neutral-200'}`} fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                            <span className="text-[11px] font-semibold text-neutral-700">{biz.rating}</span>
                            <span className="text-neutral-300 text-[11px]">·</span>
                            <span className="text-[11px] text-neutral-400">{biz.reviews} reviews</span>
                            <span className="text-neutral-300 text-[11px]">·</span>
                            <span className="text-[11px] text-neutral-400">{biz.distance}</span>
                          </div>
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0" style={PILL_STYLE}>{biz.category}</span>
                        </div>
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
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent-wash border-neutral-200 text-neutral-600 hover:border-accent/30 hover:text-accent">
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
                        : { background: 'white', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                      {p}
                    </button>
                  ))}
                  <button onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={page === totalPages}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent-wash border-neutral-200 text-neutral-600 hover:border-accent/30 hover:text-accent">
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
            /* ── MAP VIEW — revamped ── */
            <div className="flex gap-4" style={{ height: 'calc(100vh - 240px)', minHeight: 520 }}>
              {/* Sidebar */}
              <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>
                <p className="text-[10px] font-black text-accent/50 uppercase tracking-[0.14em] px-0.5 pt-1">
                  {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
                </p>
                {filtered.map(biz => (
                  <button key={biz.id}
                    onClick={() => setSelectedMapBiz(biz.id === selectedMapBiz ? null : biz.id)}
                    className={`w-full text-left rounded-2xl overflow-hidden transition-all biz-card group ${
                      selectedMapBiz === biz.id ? 'ring-2 ring-accent shadow-lg' : ''
                    }`}>
                    <div className="relative overflow-hidden bg-neutral-100" style={{ height: 110 }}>
                      <img src={biz.coverUrl} alt={biz.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        style={{ objectPosition: 'center 25%' }} />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%)' }} />
                      {biz.available ? (
                        <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5"
                          style={{ background: 'rgba(255,255,255,0.95)' }}>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-[9px] font-black text-emerald-600">Open</span>
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
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={PILL_STYLE}>{biz.category}</span>
                      <span className="text-[10px] text-neutral-400 font-medium">{biz.reviews} reviews</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Map */}
              <div className="flex-1 relative rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">
                <MapPlaceholder businesses={filtered} selected={selectedMapBiz} onSelect={id => setSelectedMapBiz(id === selectedMapBiz ? null : id)} />
                {selectedMapBizData && (
                  <div className="absolute bottom-4 right-4 w-72 bg-white rounded-2xl shadow-2xl overflow-hidden"
                    style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="relative h-36 overflow-hidden bg-neutral-100">
                      <img src={selectedMapBizData.coverUrl} alt={selectedMapBizData.name}
                        className="w-full h-full object-cover" style={{ objectPosition: 'center 25%' }} />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)' }} />
                      <button onClick={() => setSelectedMapBiz(null)}
                        className="absolute top-2.5 right-2.5 h-6 w-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 px-3.5 pb-3">
                        <p className="text-white font-black text-[15px] leading-tight" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}>{selectedMapBizData.name}</p>
                      </div>
                    </div>
                    <div className="px-4 py-3.5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={PILL_STYLE}>{selectedMapBizData.category}</span>
                        <div className="flex items-center gap-1.5">
                          <svg className="h-3 w-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-sm font-bold text-neutral-800">{selectedMapBizData.rating}</span>
                          <span className="text-neutral-300">·</span>
                          <span className="text-xs text-neutral-400">{selectedMapBizData.distance}</span>
                        </div>
                      </div>
                      <p className="text-[11.5px] text-neutral-500 leading-snug mb-3 line-clamp-2">{selectedMapBizData.tagline}</p>
                      <button onClick={() => setActiveBiz(selectedMapBizData)}
                        className="btn-primary w-full text-sm py-2.5">
                        View &amp; Book
                      </button>
                    </div>
                  </div>
                )}
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
