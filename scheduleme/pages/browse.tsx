// pages/browse.tsx — Browse with sticky full-page layout, images, list/map toggle
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Nav from '../components/Nav';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const CATEGORIES = ['All', 'Plumbing', 'Cleaning', 'Electrical', 'HVAC', 'Landscaping', 'Painting', 'Roofing', 'Moving', 'Handyman', 'Carpentry'];

const MOCK_BUSINESSES = [
  { id: '1', name: 'Pacific Plumbing Co.', category: 'Plumbing', rating: 4.9, reviews: 127, distance: '0.8 mi', price_tier: 2, badge: 'Top Rated', available: true,
    description: 'Licensed plumbers with 15+ years experience. Same-day service available.',
    coverUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&q=75',
    previewUrls: ['https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=200&q=70', 'https://images.unsplash.com/photo-1585704032915-c3400305e979?w=200&q=70', 'https://images.unsplash.com/photo-1573588028698-f4759befb09a?w=200&q=70'],
    lat: 37.775, lng: -122.418 },
  { id: '2', name: 'Sparkle Clean SF', category: 'Cleaning', rating: 4.8, reviews: 89, distance: '1.2 mi', price_tier: 1, badge: 'Fast Response', available: true,
    description: 'Professional home and office cleaning. Eco-friendly products available.',
    coverUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=500&q=75',
    previewUrls: ['https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=200&q=70', 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=200&q=70', 'https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=200&q=70'],
    lat: 37.779, lng: -122.413 },
  { id: '3', name: 'Bay Area Electric', category: 'Electrical', rating: 4.7, reviews: 203, distance: '2.1 mi', price_tier: 2, badge: 'Licensed & Insured', available: false,
    description: 'Full electrical services from panel upgrades to EV charger installation.',
    coverUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&q=75',
    previewUrls: ['https://images.unsplash.com/photo-1558002038-1055907df827?w=200&q=70', 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=200&q=70', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=200&q=70'],
    lat: 37.771, lng: -122.422 },
  { id: '4', name: 'Green Thumb Gardens', category: 'Landscaping', rating: 5.0, reviews: 44, distance: '0.5 mi', price_tier: 1, badge: null, available: true,
    description: 'Lawn care, garden design, and seasonal maintenance.',
    coverUrl: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=500&q=75',
    previewUrls: ['https://images.unsplash.com/photo-1558904541-efa843a96f01?w=200&q=70', 'https://images.unsplash.com/photo-1585320806297-9794b3e4aaae?w=200&q=70', 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=200&q=70'],
    lat: 37.773, lng: -122.420 },
  { id: '5', name: 'Summit HVAC', category: 'HVAC', rating: 4.6, reviews: 156, distance: '3.4 mi', price_tier: 3, badge: null, available: true,
    description: 'Heating, cooling, and ventilation installation and repair.',
    coverUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=500&q=75',
    previewUrls: ['https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=200&q=70', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&q=70', 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=200&q=70'],
    lat: 37.768, lng: -122.415 },
  { id: '6', name: 'Canvas & Coat', category: 'Painting', rating: 4.9, reviews: 71, distance: '1.8 mi', price_tier: 2, badge: 'Top Rated', available: true,
    description: 'Interior and exterior painting. Free estimates within 24 hours.',
    coverUrl: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=500&q=75',
    previewUrls: ['https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=200&q=70', 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=200&q=70', 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=200&q=70'],
    lat: 37.776, lng: -122.410 },
  { id: '7', name: 'Rapid Response Plumbing', category: 'Plumbing', rating: 4.8, reviews: 312, distance: '2.5 mi', price_tier: 2, badge: null, available: true,
    description: '24/7 emergency plumbing. Drain cleaning, pipe repair, water heaters.',
    coverUrl: 'https://images.unsplash.com/photo-1573588028698-f4759befb09a?w=500&q=75',
    previewUrls: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&q=70', 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=200&q=70', 'https://images.unsplash.com/photo-1585704032915-c3400305e979?w=200&q=70'],
    lat: 37.780, lng: -122.416 },
  { id: '8', name: 'Merry Maids Pro', category: 'Cleaning', rating: 4.9, reviews: 445, distance: '0.9 mi', price_tier: 1, badge: null, available: true,
    description: 'Recurring and one-time cleaning packages. Bonded and insured team.',
    coverUrl: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=500&q=75',
    previewUrls: ['https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=200&q=70', 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=200&q=70', 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=200&q=70'],
    lat: 37.774, lng: -122.419 },
  { id: '9', name: 'HandyPro Services', category: 'Handyman', rating: 4.7, reviews: 88, distance: '1.1 mi', price_tier: 1, badge: 'Fast Response', available: true,
    description: 'General repairs, furniture assembly, mounting, and more.',
    coverUrl: 'https://images.unsplash.com/photo-1609220136736-443140cfeaa8?w=500&q=75',
    previewUrls: ['https://images.unsplash.com/photo-1609220136736-443140cfeaa8?w=200&q=70', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&q=70', 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=200&q=70'],
    lat: 37.777, lng: -122.421 },
];

type ViewMode = 'list' | 'map';
type SortMode = 'distance' | 'rating' | 'reviews';
type Business = typeof MOCK_BUSINESSES[number];

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
        {/* Roads */}
        <rect x="0" y="145" width="500" height="10" fill="#fff" opacity="0.7" rx="0" />
        <rect x="0" y="275" width="500" height="8" fill="#fff" opacity="0.6" rx="0" />
        <rect x="95" y="0" width="10" height="600" fill="#fff" opacity="0.7" rx="0" />
        <rect x="245" y="0" width="8" height="600" fill="#fff" opacity="0.6" rx="0" />
        <rect x="380" y="0" width="6" height="600" fill="#fff" opacity="0.5" rx="0" />
        {/* Blocks */}
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
            style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -100%)', zIndex: isSel ? 10 : 1 }}
            className="transition-all">
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
      <div className="absolute bottom-3 right-3 text-[10px] text-neutral-400 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-md font-medium">
        Live map coming soon
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

  useEffect(() => {
    if (router.query.category) setActiveCategory(router.query.category as string);
    if (router.query.q) setSearchQuery(router.query.q as string);
  }, [router.query]);

  const filtered = MOCK_BUSINESSES.filter(b => {
    const matchCat = activeCategory === 'All' || b.category === activeCategory;
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

  const selectedBizData = MOCK_BUSINESSES.find(b => b.id === selectedBiz) ?? null;

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
      {/* Full-page layout: nav + filter bar are both sticky; content scrolls below */}
      <div className="flex flex-col h-screen overflow-hidden">
        <Nav />

        {/* Sticky filter bar — sits right below the 72px nav */}
        <div className="flex-shrink-0 bg-white border-b border-neutral-100 px-6 py-3.5 mt-[72px]">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input type="text" placeholder="Search businesses or services…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                />
              </div>
              <select value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)}
                className="pl-3 pr-8 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-accent bg-white appearance-none flex-shrink-0">
                <option value="distance">Nearest</option>
                <option value="rating">Top Rated</option>
                <option value="reviews">Most Reviewed</option>
              </select>
              {/* List / Map toggle */}
              <div className="flex items-center bg-neutral-100 rounded-xl p-1 flex-shrink-0">
                {([['list', 'List', 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z'],
                  ['map', 'Map', 'M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z']] as const).map(([mode, label, d]) => (
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
            {/* Category pills */}
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    activeCategory === cat
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto bg-[#f9f9f9]">
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
                  <div key={biz.id}
                    className="group bg-white rounded-2xl border border-neutral-100 overflow-hidden hover:shadow-md transition-all duration-200">
                    <div className="flex items-start gap-0">
                      {/* Cover image */}
                      <div className="relative w-32 sm:w-40 flex-shrink-0 self-stretch overflow-hidden bg-neutral-100">
                        <img src={biz.coverUrl} alt={biz.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 min-h-[120px]" />
                        {biz.available ? (
                          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-1.5 py-0.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                            <span className="text-[9px] font-bold text-green-700">Open</span>
                          </div>
                        ) : (
                          <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded-full px-1.5 py-0.5">
                            <span className="text-[9px] font-bold text-neutral-500">Busy</span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-neutral-400">{biz.category} · {biz.distance}</p>
                            <h3 className="font-semibold text-neutral-900 mt-0.5 text-base">{biz.name}</h3>
                          </div>
                          {biz.badge && (
                            <span className="flex-shrink-0 text-[10px] font-semibold text-accent bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{biz.badge}</span>
                          )}
                        </div>

                        <p className="text-sm text-neutral-500 mt-1.5 line-clamp-2 leading-relaxed">{biz.description}</p>

                        {/* Preview images */}
                        <div className="flex gap-1.5 mt-3">
                          {biz.previewUrls.map((url, i) => (
                            <div key={i} className="h-14 w-20 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0">
                              <img src={url} alt="" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>

                        {/* Meta + book button */}
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            <Stars rating={biz.rating} />
                            <span className="text-xs text-neutral-400">({biz.reviews})</span>
                            <span className="text-neutral-200 text-xs">·</span>
                            <Price tier={biz.price_tier} />
                          </div>
                          <Link href={`/bookings?business=${biz.id}`}
                            className="btn-primary text-xs px-4 py-2 flex-shrink-0">
                            Book
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Map view — full height split */
              <div className="flex gap-4" style={{ height: 'calc(100vh - 230px)' }}>
                <div className="w-72 flex-shrink-0 overflow-y-auto space-y-2 pr-1" style={{ scrollbarWidth: 'none' }}>
                  {filtered.map(biz => (
                    <button key={biz.id} onClick={() => setSelectedBiz(biz.id === selectedBiz ? null : biz.id)}
                      className={`w-full text-left rounded-xl border overflow-hidden transition-all ${
                        selectedBiz === biz.id ? 'border-neutral-900 shadow-md' : 'bg-white border-neutral-100 hover:border-neutral-200'
                      }`}>
                      <div className="flex items-start gap-0">
                        <div className="w-16 flex-shrink-0 self-stretch overflow-hidden">
                          <img src={biz.coverUrl} alt={biz.name} className="w-full h-full object-cover min-h-[64px]" />
                        </div>
                        <div className="flex-1 min-w-0 p-2.5 bg-white">
                          <p className={`text-sm font-semibold truncate ${selectedBiz === biz.id ? 'text-neutral-900' : 'text-neutral-800'}`}>{biz.name}</p>
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
                  <MapPlaceholder businesses={filtered} selected={selectedBiz} onSelect={id => setSelectedBiz(id === selectedBiz ? null : id)} />
                  {selectedBizData && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-80 bg-white rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden">
                      <div className="h-28 relative overflow-hidden bg-neutral-100">
                        <img src={selectedBizData.coverUrl} alt={selectedBizData.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-neutral-400">{selectedBizData.category} · {selectedBizData.distance}</p>
                        <h3 className="font-semibold text-neutral-900 mt-0.5">{selectedBizData.name}</h3>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Stars rating={selectedBizData.rating} />
                          <span className="text-xs text-neutral-400">({selectedBizData.reviews} reviews)</span>
                        </div>
                        <Link href={`/bookings?business=${selectedBizData.id}`} className="btn-primary w-full mt-3 text-sm py-2.5 block text-center">
                          Book Now
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default BrowsePage;
