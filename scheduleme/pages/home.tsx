// pages/home.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import BusinessProfile from '../components/BusinessProfile';
import { SPONSORED, INDEPENDENT, NEARBY, type Business } from '../lib/mockBusinesses';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

function timeOfDay() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

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
  return (
    <span className="text-xs font-medium text-neutral-400">
      {'$'.repeat(tier)}<span className="opacity-25">{'$'.repeat(3 - tier)}</span>
    </span>
  );
}

const CATEGORIES = [
  { label: 'Plumbing', icon: '🔧' },
  { label: 'Cleaning', icon: '🧹' },
  { label: 'Electrical', icon: '⚡' },
  { label: 'HVAC', icon: '❄️' },
  { label: 'Landscaping', icon: '🌿' },
  { label: 'Painting', icon: '🖌️' },
  { label: 'Handyman', icon: '🔨' },
];

const HomePage: NextPage = () => {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBiz, setActiveBiz] = useState<Business | null>(null);

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
      <div className="min-h-screen bg-[#f4f6fb] pt-[72px]">

        {/* Hero search — blue gradient */}
        <div style={{ background: 'linear-gradient(135deg, #0A84FF 0%, #0055CC 100%)' }} className="px-6 pt-10 pb-12">
          <div className="mx-auto max-w-xl">
            <p className="text-blue-200 text-sm mb-1">Good {timeOfDay()}, {userName}</p>
            <h1 className="text-3xl font-black text-white mb-6" style={{ letterSpacing: '-0.025em' }}>
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
                  className="w-full pl-10 pr-4 py-3 rounded-xl border-0 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-white/50 shadow-lg"
                />
              </div>
              <button type="submit"
                className="flex-shrink-0 bg-white text-accent font-bold text-sm px-5 py-3 rounded-xl shadow-lg hover:bg-blue-50 transition-colors">
                Search
              </button>
            </form>

            {/* Category pills */}
            <div className="flex gap-2 mt-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {CATEGORIES.map(cat => (
                <Link key={cat.label} href={`/browse?category=${encodeURIComponent(cat.label)}`} scroll={false}
                  className="flex-shrink-0 flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20 transition-colors">
                  <span>{cat.icon}</span>
                  {cat.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-6 py-10 space-y-12">

          {/* Featured */}
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-neutral-900">Featured</h2>
                <p className="text-xs text-neutral-400 mt-0.5">Top-rated pros in your area</p>
              </div>
              <Link href="/browse" scroll={false} className="text-sm text-accent font-semibold">See all →</Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {SPONSORED.map(biz => (
                <button key={biz.id} onClick={() => setActiveBiz(biz)}
                  className="group text-left bg-white rounded-2xl overflow-hidden border border-neutral-100 hover:shadow-lg hover:border-blue-100 transition-all duration-200">
                  <div className="relative h-32 bg-neutral-100 overflow-hidden">
                    <img src={biz.coverUrl} alt={biz.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    <div className="absolute top-2.5 left-2.5">
                      <span className="text-[9px] font-bold tracking-widest uppercase text-white/90 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">Sponsored</span>
                    </div>
                    {biz.available && (
                      <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-white/95 rounded-full px-2 py-0.5 shadow-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        <span className="text-[10px] font-semibold text-green-700">Open</span>
                      </div>
                    )}
                  </div>
                  <div className="px-3.5 pt-3 pb-1">
                    <p className="text-xs font-medium text-neutral-400">{biz.category}</p>
                    <h3 className="text-sm font-semibold text-neutral-900 mt-0.5 truncate">{biz.name}</h3>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed line-clamp-2">{biz.tagline}</p>
                  </div>
                  <div className="flex gap-1.5 px-3.5 my-2.5">
                    {biz.allImages.slice(1, 3).map((url, i) => (
                      <div key={i} className="h-12 flex-1 rounded-lg overflow-hidden bg-neutral-100">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 px-3.5 pb-3.5">
                    <Stars rating={biz.rating} />
                    <span className="text-xs text-neutral-400">({biz.reviews})</span>
                    <span className="text-neutral-200">·</span>
                    <span className="text-xs text-neutral-400">{biz.distance}</span>
                    <span className="text-neutral-200">·</span>
                    <Price tier={biz.price_tier} />
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Small & Independent — blue-tinted section */}
          <section>
            <div className="rounded-2xl overflow-hidden border border-blue-100" style={{ background: 'linear-gradient(135deg, #f0f6ff 0%, #e8f1ff 100%)' }}>
              <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-accent uppercase tracking-wider">Community Pick</span>
                  </div>
                  <h2 className="text-base font-bold text-neutral-900">Small &amp; Independent</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">Local sole traders &amp; small teams — your booking helps them grow</p>
                </div>
                <Link href="/browse" scroll={false} className="flex-shrink-0 text-sm text-accent font-semibold">See all →</Link>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 pb-4">
                {INDEPENDENT.map(biz => (
                  <button key={biz.id} onClick={() => setActiveBiz(biz)}
                    className="group text-left bg-white rounded-xl overflow-hidden border border-blue-100 hover:shadow-md hover:border-blue-200 transition-all duration-200">
                    <div className="relative h-24 bg-neutral-100 overflow-hidden">
                      <img src={biz.coverUrl} alt={biz.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      <div className="absolute bottom-1.5 right-1.5">
                        <span className="text-[8px] font-bold text-white/90 bg-accent/80 backdrop-blur-sm px-1.5 py-0.5 rounded-full">Independent</span>
                      </div>
                      {biz.badge && (
                        <div className="absolute top-1.5 left-1.5">
                          <span className="text-[8px] font-bold text-white bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-full">{biz.badge}</span>
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-[10px] font-medium text-neutral-400">{biz.category}</p>
                      <h3 className="text-xs font-semibold text-neutral-900 mt-0.5 truncate">{biz.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Stars rating={biz.rating} />
                        <span className="text-[10px] text-neutral-400">({biz.reviews})</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* More near you */}
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-base font-bold text-neutral-900">More near you</h2>
              <Link href="/browse" scroll={false} className="text-sm text-accent font-semibold">See all →</Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {NEARBY.map(biz => (
                <button key={biz.id} onClick={() => setActiveBiz(biz)}
                  className="group text-left bg-white rounded-2xl overflow-hidden border border-neutral-100 hover:shadow-lg hover:border-blue-100 transition-all duration-200">
                  <div className="relative h-28 bg-neutral-100 overflow-hidden">
                    <img src={biz.coverUrl} alt={biz.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>
                  <div className="px-3.5 py-3">
                    <p className="text-[11px] font-medium text-neutral-400">{biz.category}</p>
                    <h3 className="text-sm font-semibold text-neutral-900 mt-0.5 truncate">{biz.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <Stars rating={biz.rating} />
                      <span className="text-xs text-neutral-400">({biz.reviews})</span>
                      <span className="text-neutral-200">·</span>
                      <span className="text-xs text-neutral-400">{biz.distance}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Blue CTA */}
          <section className="rounded-2xl px-8 py-9 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
            style={{ background: 'linear-gradient(135deg, #0A84FF 0%, #0055CC 100%)' }}>
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Need something done today?</h2>
              <p className="text-sm text-blue-200">Describe your issue and get matched with a pro.</p>
            </div>
            <Link href="/bookings" scroll={false}
              className="flex-shrink-0 bg-white text-accent font-bold text-sm px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors shadow-lg">
              Book a Service
            </Link>
          </section>

        </div>
      </div>

      {activeBiz && <BusinessProfile biz={activeBiz} onClose={() => setActiveBiz(null)} />}
    </>
  );
};

export default HomePage;
