// pages/home.tsx — Logged-in home feed. Clean, image-led, Apple/Yelp feel.
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

const SPONSORED = [
  {
    id: 's1', name: 'Pacific Plumbing Co.', category: 'Plumbing',
    rating: 4.9, reviews: 127, distance: '0.8 mi', price_tier: 2, available: true,
    tagline: 'Same-day emergency service. Licensed & insured.',
    coverUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=75',
    previewUrls: [
      'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=200&q=70',
      'https://images.unsplash.com/photo-1585704032915-c3400305e979?w=200&q=70',
    ],
  },
  {
    id: 's2', name: 'Sparkle Clean SF', category: 'House Cleaning',
    rating: 4.8, reviews: 89, distance: '1.2 mi', price_tier: 1, available: true,
    tagline: 'Deep cleans, recurring service, eco-friendly products.',
    coverUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&q=75',
    previewUrls: [
      'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=200&q=70',
      'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=200&q=70',
    ],
  },
  {
    id: 's3', name: 'Bay Area Electric', category: 'Electrical',
    rating: 4.7, reviews: 203, distance: '2.1 mi', price_tier: 2, available: true,
    tagline: 'Panel upgrades, EV charger installation, 24/7 service.',
    coverUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&q=75',
    previewUrls: [
      'https://images.unsplash.com/photo-1558002038-1055907df827?w=200&q=70',
      'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=200&q=70',
    ],
  },
  {
    id: 's4', name: 'Green Thumb Gardens', category: 'Landscaping',
    rating: 5.0, reviews: 44, distance: '0.5 mi', price_tier: 1, available: true,
    tagline: 'Lawn care, garden design, and seasonal maintenance.',
    coverUrl: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&q=75',
    previewUrls: [
      'https://images.unsplash.com/photo-1558904541-efa843a96f01?w=200&q=70',
      'https://images.unsplash.com/photo-1585320806297-9794b3e4aaae?w=200&q=70',
    ],
  },
];

const NEARBY = [
  { id: 'n1', name: 'Summit HVAC', category: 'HVAC', rating: 4.6, reviews: 156, distance: '3.4 mi', price_tier: 3,
    coverUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&q=70' },
  { id: 'n2', name: 'Canvas & Coat', category: 'Painting', rating: 4.9, reviews: 71, distance: '1.8 mi', price_tier: 2,
    coverUrl: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=400&q=70' },
  { id: 'n3', name: 'HandyPro Services', category: 'Handyman', rating: 4.7, reviews: 88, distance: '1.1 mi', price_tier: 1,
    coverUrl: 'https://images.unsplash.com/photo-1609220136736-443140cfeaa8?w=400&q=70' },
  { id: 'n4', name: 'Rapid Response Plumbing', category: 'Plumbing', rating: 4.8, reviews: 312, distance: '2.5 mi', price_tier: 2,
    coverUrl: 'https://images.unsplash.com/photo-1573588028698-f4759befb09a?w=400&q=70' },
];

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

const HomePage: NextPage = () => {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/signin'); return; }
      const name = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'there';
      setUserName(name.split(' ')[0]);
      setLoading(false);
    });
  }, [router]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) router.push(`/browse?q=${encodeURIComponent(searchQuery)}`);
  }

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
      <Head><title>Home — ScheduleMe</title></Head>
      <Nav />
      <div className="min-h-screen bg-[#f9f9f9] pt-[72px]">

        {/* Search bar */}
        <div className="bg-white border-b border-neutral-100 px-6 py-8">
          <div className="mx-auto max-w-xl">
            <p className="text-sm text-neutral-400 mb-1">Good {timeOfDay()}, {userName}</p>
            <h1 className="text-2xl font-bold text-neutral-900 mb-5" style={{ letterSpacing: '-0.02em' }}>
              Find a local professional
            </h1>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="flex-1 relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder='Try "leaking pipe" or "deep clean"'
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 text-sm bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                />
              </div>
              <button type="submit" className="btn-primary px-5 py-3 text-sm">Search</button>
            </form>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-6 py-10 space-y-12">

          {/* Sponsored */}
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-neutral-900">Featured near you</h2>
              </div>
              <Link href="/browse" className="text-sm text-accent font-medium">See all</Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {SPONSORED.map(biz => (
                <Link
                  key={biz.id}
                  href={`/browse?q=${encodeURIComponent(biz.name)}`}
                  className="group bg-white rounded-2xl overflow-hidden border border-neutral-100 hover:shadow-lg transition-all duration-200"
                >
                  {/* Cover image */}
                  <div className="relative h-32 bg-neutral-100 overflow-hidden">
                    <img
                      src={biz.coverUrl}
                      alt={biz.name}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
                    <div className="absolute top-2.5 left-2.5">
                      <span className="text-[9px] font-bold tracking-widest uppercase text-white/90 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">
                        Sponsored
                      </span>
                    </div>
                    {biz.available && (
                      <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-white/95 rounded-full px-2 py-0.5 shadow-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        <span className="text-[10px] font-semibold text-green-700">Open</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="px-3.5 pt-3 pb-1">
                    <p className="text-xs font-medium text-neutral-400">{biz.category}</p>
                    <h3 className="text-sm font-semibold text-neutral-900 mt-0.5 truncate">{biz.name}</h3>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed line-clamp-2">{biz.tagline}</p>
                  </div>

                  {/* Preview images */}
                  <div className="flex gap-1.5 px-3.5 my-2.5">
                    {biz.previewUrls.map((url, i) => (
                      <div key={i} className="h-12 flex-1 rounded-lg overflow-hidden bg-neutral-100">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-2 px-3.5 pb-3.5">
                    <Stars rating={biz.rating} />
                    <span className="text-xs text-neutral-400">({biz.reviews})</span>
                    <span className="text-neutral-200 text-xs">·</span>
                    <span className="text-xs text-neutral-400">{biz.distance}</span>
                    <span className="text-neutral-200 text-xs">·</span>
                    <Price tier={biz.price_tier} />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Nearby */}
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-base font-bold text-neutral-900">More near you</h2>
              <Link href="/browse" className="text-sm text-accent font-medium">See all</Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {NEARBY.map(biz => (
                <Link
                  key={biz.id}
                  href={`/browse?q=${encodeURIComponent(biz.name)}`}
                  className="group bg-white rounded-2xl overflow-hidden border border-neutral-100 hover:shadow-lg transition-all duration-200"
                >
                  <div className="relative h-28 bg-neutral-100 overflow-hidden">
                    <img
                      src={biz.coverUrl}
                      alt={biz.name}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>
                  <div className="px-3.5 py-3">
                    <p className="text-[11px] font-medium text-neutral-400">{biz.category}</p>
                    <h3 className="text-sm font-semibold text-neutral-900 mt-0.5 truncate">{biz.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <Stars rating={biz.rating} />
                      <span className="text-xs text-neutral-400">({biz.reviews})</span>
                      <span className="text-neutral-200 text-xs">·</span>
                      <span className="text-xs text-neutral-400">{biz.distance}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="rounded-2xl bg-neutral-900 px-8 py-9 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Need something done today?</h2>
              <p className="text-sm text-neutral-400">Describe your issue and get matched with a pro.</p>
            </div>
            <Link href="/bookings" className="flex-shrink-0 bg-white text-neutral-900 font-semibold text-sm px-6 py-3 rounded-xl hover:bg-neutral-100 transition-colors">
              Book a Service
            </Link>
          </section>
        </div>
      </div>
    </>
  );
};

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export default HomePage;
