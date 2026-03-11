// pages/home.tsx — Logged-in consumer home feed
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

const CATEGORIES = [
  { label: 'Plumbing', icon: '🔧', color: 'bg-blue-50 border-blue-100 hover:bg-blue-100' },
  { label: 'Cleaning', icon: '🧹', color: 'bg-green-50 border-green-100 hover:bg-green-100' },
  { label: 'Electrical', icon: '⚡', color: 'bg-yellow-50 border-yellow-100 hover:bg-yellow-100' },
  { label: 'HVAC', icon: '❄️', color: 'bg-sky-50 border-sky-100 hover:bg-sky-100' },
  { label: 'Landscaping', icon: '🌿', color: 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100' },
  { label: 'Painting', icon: '🎨', color: 'bg-purple-50 border-purple-100 hover:bg-purple-100' },
  { label: 'Roofing', icon: '🏠', color: 'bg-orange-50 border-orange-100 hover:bg-orange-100' },
  { label: 'Moving', icon: '📦', color: 'bg-rose-50 border-rose-100 hover:bg-rose-100' },
];

const MOCK_BUSINESSES = [
  { id: '1', name: 'Pacific Plumbing Co.', category: 'Plumbing', rating: 4.9, reviews: 127, distance: '0.8 mi', price_tier: 2, badge: 'Top Rated', available: true, initials: 'PP' },
  { id: '2', name: 'Sparkle Clean SF', category: 'Cleaning', rating: 4.8, reviews: 89, distance: '1.2 mi', price_tier: 1, badge: 'Fast Response', available: true, initials: 'SC' },
  { id: '3', name: 'Bay Area Electric', category: 'Electrical', rating: 4.7, reviews: 203, distance: '2.1 mi', price_tier: 2, badge: 'Licensed & Insured', available: false, initials: 'BE' },
  { id: '4', name: 'Green Thumb Gardens', category: 'Landscaping', rating: 5.0, reviews: 44, distance: '0.5 mi', price_tier: 1, badge: 'New', available: true, initials: 'GT' },
  { id: '5', name: 'Summit HVAC', category: 'HVAC', rating: 4.6, reviews: 156, distance: '3.4 mi', price_tier: 3, badge: null, available: true, initials: 'SH' },
  { id: '6', name: 'Canvas & Coat', category: 'Painting', rating: 4.9, reviews: 71, distance: '1.8 mi', price_tier: 2, badge: 'Top Rated', available: true, initials: 'CC' },
];

const MOCK_POPULAR = [
  { id: '7', name: 'Rapid Response Plumbing', category: 'Plumbing', rating: 4.8, reviews: 312, price_tier: 2, initials: 'RR', bookings: '200+ bookings' },
  { id: '8', name: 'Merry Maids Pro', category: 'Cleaning', rating: 4.9, reviews: 445, price_tier: 1, initials: 'MM', bookings: '500+ bookings' },
  { id: '9', name: 'Volt Masters Electric', category: 'Electrical', rating: 4.7, reviews: 189, price_tier: 2, initials: 'VM', bookings: '150+ bookings' },
];

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
  return (
    <span className="text-xs text-neutral-400">
      {'$'.repeat(tier)}<span className="opacity-30">{'$'.repeat(3 - tier)}</span>
    </span>
  );
}

const AVATAR_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];

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
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
      </div>
    </div>
  );

  return (
    <>
      <Head><title>Home — ScheduleMe</title></Head>
      <Nav />
      <div className="min-h-screen bg-neutral-50 pt-[72px]">

        {/* Hero search bar */}
        <div className="bg-white border-b border-neutral-100 px-6 py-8">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-2xl font-bold text-neutral-900 mb-1">
              Good {getTimeOfDay()}, {userName} 👋
            </h1>
            <p className="text-neutral-500 mb-5 text-sm">What do you need help with today?</p>
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="flex-1 relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder='Try "leaking faucet" or "deep clean"…'
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                />
              </div>
              <button type="submit" className="btn-primary px-6 py-3.5">Search</button>
            </form>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-6 py-8 space-y-12">

          {/* Categories */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-neutral-900">Browse by category</h2>
              <Link href="/browse" className="text-sm text-accent hover:underline font-medium">See all →</Link>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
              {CATEGORIES.map((cat) => (
                <Link key={cat.label} href={`/browse?category=${encodeURIComponent(cat.label)}`}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${cat.color}`}>
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="text-xs font-medium text-neutral-700 text-center leading-tight">{cat.label}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* Nearby businesses */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">Businesses near you</h2>
                <p className="text-xs text-neutral-400 mt-0.5">Based on your location</p>
              </div>
              <Link href="/browse" className="text-sm text-accent hover:underline font-medium">View all →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {MOCK_BUSINESSES.map((biz, i) => (
                <Link key={biz.id} href={`/browse?q=${encodeURIComponent(biz.name)}`}
                  className="group bg-white rounded-2xl border border-neutral-100 p-5 hover:shadow-md hover:border-neutral-200 transition-all">
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-xl ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                      {biz.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-neutral-900 truncate group-hover:text-accent transition-colors">{biz.name}</h3>
                        {biz.available ? (
                          <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            Available
                          </span>
                        ) : (
                          <span className="flex-shrink-0 text-[10px] font-medium text-neutral-400 bg-neutral-50 border border-neutral-100 px-2 py-0.5 rounded-full">Busy</span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">{biz.category}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <StarRating rating={biz.rating} />
                        <span className="text-xs text-neutral-400">({biz.reviews})</span>
                        <span className="text-xs text-neutral-300">·</span>
                        <span className="text-xs text-neutral-400">{biz.distance}</span>
                        <PriceTier tier={biz.price_tier} />
                      </div>
                      {biz.badge && (
                        <span className="inline-block mt-2 text-[10px] font-semibold text-accent bg-accent/8 px-2 py-0.5 rounded-full">{biz.badge}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Popular in your area */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-neutral-900">Popular in your area</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {MOCK_POPULAR.map((biz, i) => (
                <Link key={biz.id} href={`/browse?q=${encodeURIComponent(biz.name)}`}
                  className="group relative bg-white rounded-2xl border border-neutral-100 p-5 hover:shadow-md hover:border-neutral-200 transition-all overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 opacity-5">
                    <div className={`h-full w-full rounded-full ${AVATAR_COLORS[(i + 2) % AVATAR_COLORS.length]}`} />
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`h-10 w-10 rounded-xl ${AVATAR_COLORS[(i + 2) % AVATAR_COLORS.length]} flex items-center justify-center text-white text-sm font-bold`}>
                      {biz.initials}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900 group-hover:text-accent transition-colors">{biz.name}</h3>
                      <p className="text-xs text-neutral-400">{biz.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StarRating rating={biz.rating} />
                      <span className="text-xs text-neutral-400">({biz.reviews})</span>
                    </div>
                    <span className="text-[10px] font-medium text-neutral-400">{biz.bookings}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Quick book CTA */}
          <section className="bg-accent rounded-2xl p-8 text-white text-center">
            <h2 className="text-xl font-bold mb-2">Need something done today?</h2>
            <p className="text-accent-light/80 text-sm mb-5">Describe your issue and get matched with a local pro in minutes.</p>
            <Link href="/bookings" className="inline-flex items-center gap-2 bg-white text-accent font-semibold text-sm px-6 py-3 rounded-xl hover:bg-neutral-50 transition-colors">
              Book Now — It&apos;s Free
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </section>

        </div>
      </div>
    </>
  );
};

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export default HomePage;
