// pages/browse.tsx — Browse businesses with list/map toggle
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import Nav from '../components/Nav';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const CATEGORIES = ['All', 'Plumbing', 'Cleaning', 'Electrical', 'HVAC', 'Landscaping', 'Painting', 'Roofing', 'Moving', 'Handyman', 'Carpentry'];

const MOCK_BUSINESSES = [
  { id: '1', name: 'Pacific Plumbing Co.', category: 'Plumbing', rating: 4.9, reviews: 127, distance: '0.8 mi', price_tier: 2, badge: 'Top Rated', available: true, initials: 'PP', description: 'Licensed plumbers with 15+ years experience. Same-day service available.', lat: 37.775, lng: -122.418 },
  { id: '2', name: 'Sparkle Clean SF', category: 'Cleaning', rating: 4.8, reviews: 89, distance: '1.2 mi', price_tier: 1, badge: 'Fast Response', available: true, initials: 'SC', description: 'Professional home and office cleaning. Eco-friendly products available.', lat: 37.779, lng: -122.413 },
  { id: '3', name: 'Bay Area Electric', category: 'Electrical', rating: 4.7, reviews: 203, distance: '2.1 mi', price_tier: 2, badge: 'Licensed & Insured', available: false, initials: 'BE', description: 'Full electrical services from panel upgrades to EV charger installation.', lat: 37.771, lng: -122.422 },
  { id: '4', name: 'Green Thumb Gardens', category: 'Landscaping', rating: 5.0, reviews: 44, distance: '0.5 mi', price_tier: 1, badge: 'New', available: true, initials: 'GT', description: 'Lawn care, garden design, and seasonal maintenance.', lat: 37.773, lng: -122.420 },
  { id: '5', name: 'Summit HVAC', category: 'HVAC', rating: 4.6, reviews: 156, distance: '3.4 mi', price_tier: 3, badge: null, available: true, initials: 'SH', description: 'Heating, cooling, and ventilation installation and repair.', lat: 37.768, lng: -122.415 },
  { id: '6', name: 'Canvas & Coat', category: 'Painting', rating: 4.9, reviews: 71, distance: '1.8 mi', price_tier: 2, badge: 'Top Rated', available: true, initials: 'CC', description: 'Interior and exterior painting. Free estimates within 24 hours.', lat: 37.776, lng: -122.410 },
  { id: '7', name: 'Rapid Response Plumbing', category: 'Plumbing', rating: 4.8, reviews: 312, distance: '2.5 mi', price_tier: 2, badge: null, available: true, initials: 'RR', description: '24/7 emergency plumbing. Drain cleaning, pipe repair, water heaters.', lat: 37.780, lng: -122.416 },
  { id: '8', name: 'Merry Maids Pro', category: 'Cleaning', rating: 4.9, reviews: 445, distance: '0.9 mi', price_tier: 1, badge: null, available: true, initials: 'MM', description: 'Recurring and one-time cleaning packages. Bonded and insured team.', lat: 37.774, lng: -122.419 },
  { id: '9', name: 'HandyPro Services', category: 'Handyman', rating: 4.7, reviews: 88, distance: '1.1 mi', price_tier: 1, badge: 'Fast Response', available: true, initials: 'HP', description: 'General repairs, furniture assembly, mounting, and more.', lat: 37.777, lng: -122.421 },
];

const AVATAR_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];

type ViewMode = 'list' | 'map';
type SortMode = 'distance' | 'rating' | 'reviews';

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-1">
      <svg className="h-3.5 w-3.5 text-amber-400 fill-current" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <span className="text-xs font-semibold text-neutral-700">{rating}</span>
    </span>
  );
}

function PriceTier({ tier }: { tier: number }) {
  return <span className="text-xs text-neutral-400">{'$'.repeat(tier)}<span className="opacity-30">{'$'.repeat(3 - tier)}</span></span>;
}

function MapPlaceholder({ businesses, selected, onSelect }: { businesses: typeof MOCK_BUSINESSES; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="relative w-full h-full bg-neutral-100 rounded-2xl overflow-hidden border border-neutral-200">
      {/* Stylized map background */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        backgroundColor: '#f1f5f9'
      }} />
      {/* Roads */}
      <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 500">
        <line x1="0" y1="150" x2="400" y2="150" stroke="#94a3b8" strokeWidth="8" />
        <line x1="0" y1="280" x2="400" y2="280" stroke="#94a3b8" strokeWidth="6" />
        <line x1="100" y1="0" x2="100" y2="500" stroke="#94a3b8" strokeWidth="8" />
        <line x1="250" y1="0" x2="250" y2="500" stroke="#94a3b8" strokeWidth="6" />
        <line x1="0" y1="380" x2="400" y2="340" stroke="#94a3b8" strokeWidth="4" />
        <rect x="110" y="160" width="130" height="110" fill="#e2e8f0" />
        <rect x="260" y="160" width="80" height="60" fill="#e2e8f0" />
        <rect x="10" y="160" width="80" height="60" fill="#e2e8f0" />
      </svg>

      {/* Business pins */}
      {businesses.map((biz, i) => {
        const x = 30 + (i * 47) % 320;
        const y = 60 + (i * 73) % 360;
        const isSelected = selected === biz.id;
        return (
          <button key={biz.id} onClick={() => onSelect(biz.id)}
            style={{ left: x, top: y, transform: 'translate(-50%, -100%)' }}
            className="absolute transition-all"
          >
            <div className={`relative flex flex-col items-center`}>
              <div className={`px-2.5 py-1 rounded-lg text-xs font-bold shadow-md transition-all whitespace-nowrap ${
                isSelected ? 'bg-accent text-white scale-110 shadow-lg' : 'bg-white text-neutral-800 hover:bg-accent hover:text-white'
              }`}>
                {biz.name.split(' ')[0]}
              </div>
              <div className={`w-2 h-2 rotate-45 -mt-1 ${isSelected ? 'bg-accent' : 'bg-white'} shadow-sm`} />
            </div>
          </button>
        );
      })}

      {/* Map attribution */}
      <div className="absolute bottom-3 right-3 text-xs text-neutral-400 bg-white/80 px-2 py-1 rounded-lg">
        Map view — live data coming soon
      </div>
    </div>
  );
}

const BrowsePage: NextPage = () => {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortMode, setSortMode] = useState<SortMode>('distance');
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBiz, setSelectedBiz] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/signin'); return; }
      setLoading(false);
    });
  }, [router]);

  // Read query params
  useEffect(() => {
    if (router.query.category) setActiveCategory(router.query.category as string);
    if (router.query.q) setSearchQuery(router.query.q as string);
  }, [router.query]);

  const filtered = MOCK_BUSINESSES.filter(b => {
    const matchCat = activeCategory === 'All' || b.category === activeCategory;
    const matchSearch = !searchQuery || b.name.toLowerCase().includes(searchQuery.toLowerCase()) || b.category.toLowerCase().includes(searchQuery.toLowerCase()) || b.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  }).sort((a, b) => {
    if (sortMode === 'rating') return b.rating - a.rating;
    if (sortMode === 'reviews') return b.reviews - a.reviews;
    return parseFloat(a.distance) - parseFloat(b.distance);
  });

  const selectedBizData = MOCK_BUSINESSES.find(b => b.id === selectedBiz);

  if (loading) return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
      </div>
    </div>
  );

  return (
    <>
      <Head><title>Browse — ScheduleMe</title></Head>
      <Nav />
      <div className="min-h-screen bg-neutral-50 pt-[72px]">

        {/* Top bar */}
        <div className="bg-white border-b border-neutral-100 px-6 py-4 sticky top-[72px] z-30">
          <div className="mx-auto max-w-6xl">
            {/* Search + view toggle */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input type="text" placeholder="Search businesses, services…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>

              {/* Sort */}
              <select value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)}
                className="pl-3 pr-8 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-accent bg-white appearance-none">
                <option value="distance">Nearest</option>
                <option value="rating">Top Rated</option>
                <option value="reviews">Most Reviewed</option>
              </select>

              {/* View toggle — Spotify library style */}
              <div className="flex items-center bg-neutral-100 rounded-xl p-1 gap-1">
                <button onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'list' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  List
                </button>
                <button onClick={() => setViewMode('map')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'map' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                  </svg>
                  Map
                </button>
              </div>
            </div>

            {/* Category pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                    activeCategory === cat
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mx-auto max-w-6xl px-6 py-6">
          <p className="text-sm text-neutral-400 mb-4">{filtered.length} businesses found</p>

          {viewMode === 'list' ? (
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-3xl mb-3">🔍</p>
                  <p className="text-neutral-500 font-medium">No businesses found</p>
                  <p className="text-neutral-400 text-sm mt-1">Try a different search or category</p>
                </div>
              ) : (
                filtered.map((biz, i) => (
                  <Link key={biz.id} href={`/bookings?business=${biz.id}`}
                    className="group flex items-start gap-4 bg-white rounded-2xl border border-neutral-100 p-5 hover:shadow-md hover:border-neutral-200 transition-all">
                    <div className={`h-14 w-14 rounded-xl ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                      {biz.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-neutral-900 group-hover:text-accent transition-colors">{biz.name}</h3>
                          <p className="text-xs text-neutral-400 mt-0.5">{biz.category} · {biz.distance}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {biz.available ? (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              Available
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-neutral-400 bg-neutral-50 border border-neutral-100 px-2 py-0.5 rounded-full">Busy</span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-neutral-500 mt-1.5 line-clamp-2">{biz.description}</p>
                      <div className="flex items-center gap-3 mt-2.5">
                        <StarRating rating={biz.rating} />
                        <span className="text-xs text-neutral-400">({biz.reviews} reviews)</span>
                        <PriceTier tier={biz.price_tier} />
                        {biz.badge && (
                          <span className="text-[10px] font-semibold text-accent bg-accent/8 px-2 py-0.5 rounded-full">{biz.badge}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 self-center">
                      <span className="btn-primary text-xs px-4 py-2">Book</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          ) : (
            /* Map view */
            <div className="flex gap-4 h-[calc(100vh-260px)]">
              {/* Sidebar list */}
              <div className="w-80 flex-shrink-0 overflow-y-auto space-y-2 pr-1">
                {filtered.map((biz, i) => (
                  <button key={biz.id} onClick={() => setSelectedBiz(biz.id === selectedBiz ? null : biz.id)}
                    className={`w-full text-left flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                      selectedBiz === biz.id
                        ? 'bg-accent/5 border-accent/20'
                        : 'bg-white border-neutral-100 hover:border-neutral-200'
                    }`}>
                    <div className={`h-10 w-10 rounded-lg ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {biz.initials}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${selectedBiz === biz.id ? 'text-accent' : 'text-neutral-900'}`}>{biz.name}</p>
                      <p className="text-xs text-neutral-400">{biz.category} · {biz.distance}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StarRating rating={biz.rating} />
                        <span className="text-xs text-neutral-400">({biz.reviews})</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Map */}
              <div className="flex-1 relative">
                <MapPlaceholder businesses={filtered} selected={selectedBiz} onSelect={id => setSelectedBiz(id === selectedBiz ? null : id)} />

                {/* Selected business card */}
                {selectedBizData && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-80 bg-white rounded-2xl border border-neutral-200 shadow-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className={`h-12 w-12 rounded-xl ${AVATAR_COLORS[MOCK_BUSINESSES.findIndex(b => b.id === selectedBizData.id) % AVATAR_COLORS.length]} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                        {selectedBizData.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-neutral-900 text-sm">{selectedBizData.name}</h3>
                        <p className="text-xs text-neutral-400">{selectedBizData.category} · {selectedBizData.distance}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <StarRating rating={selectedBizData.rating} />
                          <span className="text-xs text-neutral-400">({selectedBizData.reviews})</span>
                        </div>
                      </div>
                    </div>
                    <Link href={`/bookings?business=${selectedBizData.id}`} className="btn-primary w-full mt-3 text-sm py-2.5">
                      Book Now
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default BrowsePage;
