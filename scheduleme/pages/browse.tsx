// pages/browse.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import BusinessProfile from '../components/BusinessProfile';
import { ALL_BUSINESSES, type Business } from '../lib/mockBusinesses';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const CATEGORIES = ['All', 'Independent', 'Plumbing', 'House Cleaning', 'Electrical', 'HVAC', 'Landscaping', 'Painting', 'Handyman'];
type ViewMode = 'list' | 'map';
type SortMode = 'distance' | 'rating' | 'reviews';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-1">
      <svg className="h-3 w-3 text-amber-400 fill-current flex-shrink-0" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <span className="text-xs font-semibold text-neutral-700 tabular-nums">{rating}</span>
    </span>
  );
}

function Price({ tier }: { tier: number }) {
  return <span className="text-xs font-medium text-neutral-400">{'$'.repeat(tier)}<span className="opacity-25">{'$'.repeat(3 - tier)}</span></span>;
}

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

// Card image with thumbnail swap
function BizCardImage({ biz, onCardClick }: { biz: Business; onCardClick: () => void }) {
  const [activeImg, setActiveImg] = useState(0);
  return (
    <div className="flex items-start gap-0">
      <div className="relative w-32 sm:w-40 flex-shrink-0 self-stretch overflow-hidden bg-neutral-100 cursor-pointer" onClick={onCardClick}>
        <img src={biz.allImages[activeImg]} alt={biz.name}
          className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-500 min-h-[130px]" />
        {biz.available ? (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-1.5 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
            <span className="text-[9px] font-bold text-green-700">Open</span>
          </div>
        ) : (
          <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur-sm rounded-full px-1.5 py-0.5">
            <span className="text-[9px] font-bold text-white/80">Busy</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 p-4">
        <div className="flex items-start justify-between gap-3" onClick={onCardClick} style={{ cursor: 'pointer' }}>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-neutral-400">{biz.category} · {biz.distance}</p>
            <h3 className="font-semibold text-neutral-900 mt-0.5 text-[15px] group-hover:text-accent transition-colors">{biz.name}</h3>
          </div>
          {biz.badge && (
            <span className="flex-shrink-0 text-[10px] font-semibold text-accent bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{biz.badge}</span>
          )}
        </div>

        <p className="text-sm text-neutral-500 mt-1.5 line-clamp-2 leading-relaxed cursor-pointer" onClick={onCardClick}>{biz.description}</p>

        {/* Swappable preview thumbnails */}
        <div className="flex gap-1.5 mt-3">
          {biz.allImages.slice(0, 4).map((url, i) => (
            <button key={i} onClick={() => setActiveImg(i)}
              className={`h-14 w-[60px] rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0 border-2 transition-all ${
                activeImg === i ? 'border-accent scale-105' : 'border-transparent hover:border-neutral-300'
              }`}>
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>

        {/* Meta + book */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <Stars rating={biz.rating} />
            <span className="text-xs text-neutral-400">({biz.reviews})</span>
            <span className="text-neutral-200">·</span>
            <Price tier={biz.price_tier} />
          </div>
          <button onClick={onCardClick}
            className="btn-primary text-xs px-4 py-2 flex-shrink-0">
            View &amp; Book
          </button>
        </div>
      </div>
    </div>
  );
}

function NominateInline() {
  const [open, setOpen] = useState(false);
  const [bizName, setBizName] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) return (
    <div className="mt-2 rounded-2xl border border-green-100 bg-green-50 px-5 py-4 text-center">
      <p className="text-sm font-semibold text-green-800">Referral received — we'll reach out to {bizName}.</p>
    </div>
  );

  if (!open) return (
    <div className="mt-2 rounded-2xl border border-dashed border-neutral-200 bg-white px-5 py-4 flex items-center gap-4">
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
    <div className="mt-2 rounded-2xl border border-neutral-200 bg-white px-5 py-4 space-y-3">
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
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortMode, setSortMode] = useState<SortMode>('distance');
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMapBiz, setSelectedMapBiz] = useState<string | null>(null);
  const [activeBiz, setActiveBiz] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Open profile from biz_id query param (e.g. from bookings redirect)
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

  const selectedMapBizData = ALL_BUSINESSES.find(b => b.id === selectedMapBiz) ?? null;

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="relative h-7 w-7">
        <div className="absolute inset-0 rounded-full border-2 border-neutral-200" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-neutral-900 animate-spin" />
      </div>
    </div>
  );

  return (
    <>
      <Head><title>Browse — ScheduleMe</title></Head>
      <div className="flex flex-col h-screen page-grid" style={{ overflow: 'visible' }}>
        <Nav />

        {/* Filter bar — premium panel matching home sections */}
        <div className="flex-shrink-0 bg-white border-b border-neutral-100 mt-[72px]" style={{ position: 'relative', overflow: 'hidden' }}>
          {/* Inner grid + glow like home sections */}
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'linear-gradient(to right,rgba(0,0,0,0.028) 1px,transparent 1px),linear-gradient(to bottom,rgba(0,0,0,0.028) 1px,transparent 1px)',
            backgroundSize: '32px 32px',
          }} />
          <div className="sm-glow" style={{ width: 400, height: 300, top: -150, right: '10%' }} />
          <div className="relative mx-auto max-w-6xl px-6 pt-4 pb-3.5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input type="text" placeholder="Search businesses or services…"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all shadow-[0_1px_4px_rgba(0,0,0,0.04)]" />
              </div>
              <select value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)}
                className="pl-3 pr-8 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-accent bg-white appearance-none flex-shrink-0">
                <option value="distance">Nearest</option>
                <option value="rating">Top Rated</option>
                <option value="reviews">Most Reviewed</option>
              </select>
              <div className="flex items-center bg-neutral-100 rounded-xl p-1 flex-shrink-0">
                {([['list','List','M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z'],
                  ['map','Map','M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z']] as const)
                  .map(([mode,label,d]) => (
                    <button key={mode} onClick={() => setViewMode(mode as ViewMode)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === mode ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
                      </svg>
                      {label}
                    </button>
                  ))}
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    activeCategory === cat
                      ? cat === 'Independent' ? 'bg-accent text-white border-accent' : 'bg-accent text-white border-accent'
                      : cat === 'Independent'
                        ? 'bg-blue-50 text-accent border-blue-200 hover:bg-accent hover:text-white hover:border-accent'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:border-accent hover:text-accent'
                  }`}>
                  {cat === 'Independent' ? 'Independent' : cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto bg-[#f8f8f8]">
          <div className="mx-auto max-w-6xl px-6 py-5">
            <p className="text-xs text-neutral-400 mb-4 font-medium">{filtered.length} businesses</p>

            {viewMode === 'list' ? (
              <div className="space-y-3">
                {filtered.length === 0 ? (
                  <div className="text-center py-24">
                    <p className="text-neutral-500 font-semibold">No results found</p>
                    <p className="text-neutral-400 text-sm mt-1">Try a different search or category</p>
                  </div>
                ) : filtered.map(biz => (
                  <div key={biz.id} className="sm-card overflow-hidden cursor-pointer" onClick={() => setActiveBiz(biz)}>
                    <BizCardImage biz={biz} onCardClick={() => setActiveBiz(biz)} />
                  </div>
                ))}

                {/* Nominate a business — bottom of list */}
                {filtered.length > 0 && (
                  <NominateInline />
                )}
              </div>
            ) : (
              <div className="flex gap-4" style={{ height: 'calc(100vh - 230px)' }}>
                <div className="w-72 flex-shrink-0 overflow-y-auto space-y-2 pr-1" style={{ scrollbarWidth: 'none' }}>
                  {filtered.map(biz => (
                    <button key={biz.id} onClick={() => setSelectedMapBiz(biz.id === selectedMapBiz ? null : biz.id)}
                      className={`w-full text-left rounded-xl border overflow-hidden transition-all ${
                        selectedMapBiz === biz.id ? 'border-neutral-900 shadow-md' : 'bg-white border-neutral-100 hover:border-neutral-200'
                      }`}>
                      <div className="flex items-start">
                        <div className="w-16 flex-shrink-0 self-stretch overflow-hidden">
                          <img src={biz.coverUrl} alt={biz.name} className="w-full h-full object-cover min-h-[64px]" />
                        </div>
                        <div className="flex-1 min-w-0 p-2.5 bg-white">
                          <p className={`text-sm font-semibold truncate ${selectedMapBiz === biz.id ? 'text-neutral-900' : 'text-neutral-800'}`}>{biz.name}</p>
                          <p className="text-[11px] text-neutral-400 mt-0.5">{biz.category} · {biz.distance}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Stars rating={biz.rating} />
                            <span className="text-[11px] text-neutral-400">({biz.reviews})</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex-1 relative rounded-2xl overflow-hidden border border-neutral-200">
                  <MapPlaceholder businesses={filtered} selected={selectedMapBiz} onSelect={id => setSelectedMapBiz(id === selectedMapBiz ? null : id)} />
                  {selectedMapBizData && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-80 bg-white rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden">
                      <div className="h-28 relative overflow-hidden bg-neutral-100">
                        <img src={selectedMapBizData.coverUrl} alt={selectedMapBizData.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-neutral-400">{selectedMapBizData.category} · {selectedMapBizData.distance}</p>
                        <h3 className="font-semibold text-neutral-900 mt-0.5">{selectedMapBizData.name}</h3>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Stars rating={selectedMapBizData.rating} />
                          <span className="text-xs text-neutral-400">({selectedMapBizData.reviews})</span>
                        </div>
                        <button onClick={() => setActiveBiz(selectedMapBizData)}
                          className="btn-primary w-full mt-3 text-sm py-2.5">
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
      </div>

      {activeBiz && <BusinessProfile biz={activeBiz} onClose={() => setActiveBiz(null)} />}
    </>
  );
};

export default BrowsePage;
