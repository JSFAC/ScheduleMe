// pages/home.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
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
    <span className="flex items-center gap-0.5">
      <svg className="h-3 w-3 text-amber-400 fill-current shrink-0" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <span className="text-xs font-semibold text-neutral-600 tabular-nums ml-0.5">{rating}</span>
    </span>
  );
}

// AI assistant suggestions shown as chips
const AI_SUGGESTIONS = [
  'Leaking pipe under my kitchen sink',
  'Deep clean before a move-out',
  'HVAC not cooling properly',
  'Paint two rooms this weekend',
  'Electrical panel making noise',
  'Lawn hasn\'t been touched in months',
];

/* ── AI Search bar ── */
function AISearchBar({ userName, onSubmit }: { userName: string; onSubmit: (q: string) => void }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [thinking, setThinking] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function submit(q: string) {
    if (!q.trim()) return;
    setThinking(true);
    setTimeout(() => { setThinking(false); onSubmit(q.trim()); }, 420);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(query); }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm text-neutral-400 mb-1.5 font-medium">Good {timeOfDay()}, {userName}</p>
      <h1 className="text-[1.6rem] font-black text-neutral-900 mb-5" style={{ letterSpacing: '-0.025em', lineHeight: 1.15 }}>
        What do you need done?
      </h1>

      {/* Chat-style input */}
      <div className={`relative bg-white rounded-2xl border transition-all duration-200 shadow-sm ${
        focused ? 'border-accent shadow-[0_0_0_3px_rgba(10,132,255,0.12)]' : 'border-neutral-200 hover:border-neutral-300'
      }`}>
        {/* Sparkle icon */}
        <div className="absolute left-4 top-4 flex items-center gap-1.5">
          <svg className="h-4 w-4 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <span className="text-[10px] font-bold text-accent uppercase tracking-wider">AI</span>
        </div>
        <textarea
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKey}
          placeholder="Describe what's wrong or what you need — the more detail, the better the match"
          rows={2}
          className="w-full pl-16 pr-14 pt-4 pb-4 text-sm text-neutral-900 placeholder:text-neutral-400 bg-transparent focus:outline-none resize-none rounded-2xl"
          style={{ lineHeight: '1.5' }}
        />
        <button
          onClick={() => submit(query)}
          disabled={!query.trim() || thinking}
          className={`absolute right-3 bottom-3 h-8 w-8 rounded-xl flex items-center justify-center transition-all ${
            query.trim() && !thinking ? 'bg-accent text-white hover:bg-accent-dark' : 'bg-neutral-100 text-neutral-400'
          }`}>
          {thinking ? (
            <div className="h-3.5 w-3.5 rounded-full border-2 border-neutral-300 border-t-accent animate-spin" />
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          )}
        </button>
      </div>

      {/* Suggestion chips */}
      <div className="flex gap-2 mt-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {AI_SUGGESTIONS.map(s => (
          <button key={s} onClick={() => { setQuery(s); inputRef.current?.focus(); }}
            className="shrink-0 text-xs text-neutral-500 bg-white border border-neutral-200 hover:border-accent hover:text-accent px-3 py-1.5 rounded-full transition-colors whitespace-nowrap">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Business card ── */
function BizCard({ biz, onClick, size = 'md' }: { biz: Business; onClick: () => void; size?: 'sm' | 'md' }) {
  const imgH = size === 'sm' ? 'h-24' : 'h-32';
  return (
    <button onClick={onClick}
      className="group text-left bg-white rounded-2xl overflow-hidden border border-neutral-100/80 hover:border-accent/20 hover:shadow-[0_8px_32px_rgba(10,132,255,0.08)] transition-all duration-200 w-full">
      <div className={`relative ${imgH} bg-neutral-100 overflow-hidden`}>
        <img src={biz.coverUrl} alt={biz.name}
          className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        {biz.available && (
          <div className="absolute bottom-2 left-2.5 flex items-center gap-1 bg-white/95 rounded-full px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span className="text-[10px] font-semibold text-green-700">Open</span>
          </div>
        )}
        {biz.badge && (
          <div className="absolute top-2 right-2">
            <span className="text-[9px] font-bold text-white bg-accent/80 backdrop-blur-sm px-2 py-0.5 rounded-full">{biz.badge}</span>
          </div>
        )}
      </div>
      <div className="px-3.5 py-3">
        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-0.5">{biz.category}</p>
        <h3 className="text-sm font-bold text-neutral-900 truncate" style={{ letterSpacing: '-0.01em' }}>{biz.name}</h3>
        <div className="flex items-center gap-2 mt-1.5">
          <Stars rating={biz.rating} />
          <span className="text-[11px] text-neutral-400">({biz.reviews})</span>
          <span className="text-neutral-200">·</span>
          <span className="text-[11px] text-neutral-400">{biz.distance}</span>
        </div>
      </div>
    </button>
  );
}

/* ── Nominate a business card ── */
function NominateCard() {
  const [open, setOpen] = useState(false);
  const [bizName, setBizName] = useState('');
  const [sent, setSent] = useState(false);

  if (!open) return (
    <div className="mt-10 rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-7 flex flex-col sm:flex-row items-start sm:items-center gap-5">
      <div className="h-11 w-11 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-neutral-900">Know a great local pro?</p>
        <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">Nominate a plumber, cleaner, or tradesperson you trust. We'll invite them and you'll be able to book them directly here.</p>
      </div>
      <button onClick={() => setOpen(true)}
        className="shrink-0 text-sm font-semibold text-accent border border-accent/30 bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-xl transition-colors">
        Nominate someone
      </button>
    </div>
  );

  if (sent) return (
    <div className="mt-10 rounded-2xl border border-green-100 bg-green-50 px-6 py-7 text-center">
      <p className="text-sm font-bold text-green-800">Thanks for the recommendation</p>
      <p className="text-xs text-green-700 mt-1">We'll reach out to {bizName || 'them'} shortly.</p>
    </div>
  );

  return (
    <div className="mt-10 rounded-2xl border border-neutral-200 bg-white px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-neutral-900">Nominate a local pro</p>
        <button onClick={() => setOpen(false)} className="text-xs text-neutral-400 hover:text-neutral-600">Cancel</button>
      </div>
      <input type="text" value={bizName} onChange={e => setBizName(e.target.value)}
        placeholder="Business or person's name"
        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent" />
      <button disabled={!bizName.trim()} onClick={() => { if (bizName.trim()) setSent(true); }}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${bizName.trim() ? 'bg-accent text-white hover:bg-accent-dark' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'}`}>
        Submit
      </button>
    </div>
  );
}

/* ── Main page ── */
const HomePage: NextPage = () => {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
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

  function handleAISearch(query: string) {
    router.push(`/browse?q=${encodeURIComponent(query)}`);
  }

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="relative h-6 w-6">
        <div className="absolute inset-0 rounded-full border-2 border-neutral-100" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
      </div>
    </div>
  );

  return (
    <>
      <Head><title>Home — ScheduleMe</title></Head>
      <Nav />
      <div className="min-h-screen bg-[#f8f8f8] pt-[72px]">

        {/* AI search header */}
        <div className="bg-white border-b border-neutral-100 px-6 pt-8 pb-7">
          <AISearchBar userName={userName} onSubmit={handleAISearch} />
        </div>

        <div className="mx-auto max-w-6xl px-6 py-10 space-y-12">

          {/* Featured */}
          <section>
            <div className="flex items-baseline justify-between mb-5">
              <div>
                <h2 className="text-[15px] font-bold text-neutral-900" style={{ letterSpacing: '-0.01em' }}>Featured near you</h2>
                <p className="text-xs text-neutral-400 mt-0.5">Top-rated and available now</p>
              </div>
              <Link href="/browse" scroll={false} className="text-sm font-semibold text-accent">See all</Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              {SPONSORED.map(biz => (
                <BizCard key={biz.id} biz={biz} onClick={() => setActiveBiz(biz)} />
              ))}
            </div>
          </section>

          {/* Small & Independent */}
          <section>
            <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(160deg,#f0f6ff 0%,#fafbff 100%)', border: '1px solid #dbeafe' }}>
              <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Community Pick</span>
                  </div>
                  <h2 className="text-[15px] font-bold text-neutral-900" style={{ letterSpacing: '-0.01em' }}>Small &amp; Independent</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">Local sole traders — your booking helps them grow</p>
                </div>
                <Link href="/browse?category=Independent" scroll={false} className="shrink-0 text-sm font-semibold text-accent">See all</Link>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 pb-4">
                {INDEPENDENT.map(biz => (
                  <BizCard key={biz.id} biz={biz} size="sm" onClick={() => setActiveBiz(biz)} />
                ))}
              </div>
            </div>
          </section>

          {/* More near you */}
          <section>
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="text-[15px] font-bold text-neutral-900" style={{ letterSpacing: '-0.01em' }}>More near you</h2>
              <Link href="/browse" scroll={false} className="text-sm font-semibold text-accent">See all</Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              {NEARBY.map(biz => (
                <BizCard key={biz.id} biz={biz} onClick={() => setActiveBiz(biz)} />
              ))}
            </div>
          </section>

          {/* Nominate a business */}
          <NominateCard />

        </div>
      </div>

      {activeBiz && <BusinessProfile biz={activeBiz} onClose={() => setActiveBiz(null)} />}
    </>
  );
};

export default HomePage;
