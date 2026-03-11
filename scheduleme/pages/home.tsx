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

/* ── Scroll reveal hook (same as landing page) ── */
function useScrollReveal(selector: string, delay = 80) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
    els.forEach((el, i) => {
      el.setAttribute('data-reveal', 'hidden');
      el.style.transitionDelay = `${i * delay}ms`;
    });
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.setAttribute('data-reveal', 'visible'); io.unobserve(e.target); }
      }),
      { threshold: 0.08, rootMargin: '0px 0px -32px 0px' }
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [selector, delay]);
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

const AI_SUGGESTIONS = [
  'Leaking pipe under my sink',
  'Deep clean before moving out',
  'AC stopped working',
  'Repaint two rooms',
  'Electrical panel noise',
  'Lawn overgrown for months',
];

/* ── AI Search ── */
function AISearchBar({ userName, onSubmit }: { userName: string; onSubmit: (q: string) => void }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [thinking, setThinking] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function submit(q: string) {
    if (!q.trim() || thinking) return;
    setThinking(true);
    setTimeout(() => { setThinking(false); onSubmit(q.trim()); }, 380);
  }

  return (
    <div className="w-full">
      {/* Greeting */}
      <p className="text-sm text-neutral-400 font-medium mb-2">
        Good {timeOfDay()}, <span className="text-neutral-600">{userName}</span>
      </p>
      <h1 className="text-[1.75rem] font-black text-neutral-900 mb-5" style={{ letterSpacing: '-0.03em', lineHeight: 1.1 }}>
        What do you need done?
      </h1>

      {/* Input */}
      <div className={`relative bg-white rounded-2xl border transition-all duration-200 ${
        focused
          ? 'border-accent shadow-[0_0_0_3px_rgba(10,132,255,0.1),0_4px_20px_rgba(0,0,0,0.06)]'
          : 'border-neutral-200 shadow-sm hover:border-neutral-300'
      }`}>
        {/* Left badge — sits on the first line of text */}
        <div className="absolute left-4 top-[14px] flex items-center gap-1.5 pointer-events-none select-none">
          <svg className="h-[15px] w-[15px] text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <span className="text-[9px] font-black text-accent uppercase tracking-[0.12em] leading-none">AI</span>
          {/* Thin divider */}
          <span className="text-neutral-200 text-xs leading-none ml-0.5">|</span>
        </div>
        <textarea
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(query); } }}
          placeholder="Describe your issue or job — the more detail, the better the match"
          rows={3}
          className="w-full pl-[72px] pr-14 pt-[13px] pb-[13px] text-sm text-neutral-900 placeholder:text-neutral-400 bg-transparent focus:outline-none resize-none rounded-2xl leading-[1.55]"
        />
        <button
          onClick={() => submit(query)}
          disabled={!query.trim() || thinking}
          className={`absolute right-3 bottom-3 h-8 w-8 rounded-xl flex items-center justify-center transition-all ${
            query.trim() && !thinking
              ? 'bg-accent text-white shadow-[0_2px_8px_rgba(10,132,255,0.35)] hover:bg-accent-dark'
              : 'bg-neutral-100 text-neutral-400'
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
      <div className="flex gap-2 mt-3 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {AI_SUGGESTIONS.map(s => (
          <button key={s} onClick={() => { setQuery(s); setTimeout(() => inputRef.current?.focus(), 0); }}
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
  return (
    <button onClick={onClick}
      className="group text-left bg-white rounded-2xl overflow-hidden w-full sm-card">
      <div className={`relative ${size === 'sm' ? 'h-[100px]' : 'h-[120px]'} bg-neutral-100 overflow-hidden`}>
        <img src={biz.coverUrl} alt={biz.name}
          className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500 ease-out" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
        {biz.available && (
          <div className="absolute bottom-2 left-2.5 flex items-center gap-1 bg-white/95 rounded-full px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span className="text-[9px] font-bold text-green-700">Open</span>
          </div>
        )}
        {biz.badge && (
          <div className="absolute top-2 right-2">
            <span className="text-[9px] font-bold text-white bg-accent/80 backdrop-blur-sm px-2 py-0.5 rounded-full">{biz.badge}</span>
          </div>
        )}
      </div>
      <div className="px-3.5 py-3">
        <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-[0.1em] mb-0.5">{biz.category}</p>
        <h3 className="text-sm font-bold text-neutral-900 truncate" style={{ letterSpacing: '-0.01em' }}>{biz.name}</h3>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Stars rating={biz.rating} />
          <span className="text-[10px] text-neutral-400">·</span>
          <span className="text-[10px] text-neutral-400">{biz.distance}</span>
        </div>
      </div>
    </button>
  );
}

/* ── Nominate card ── */
function NominateCard() {
  const [open, setOpen] = useState(false);
  const [bizName, setBizName] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) return (
    <div className="rounded-2xl border border-green-100 bg-green-50 px-6 py-6 text-center">
      <p className="text-sm font-bold text-green-800">Thanks — we'll reach out to {bizName}.</p>
      <p className="text-xs text-green-600 mt-1">We'll email you if they join ScheduleMe.</p>
    </div>
  );

  if (!open) return (
    <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-neutral-900">Know a great local pro?</p>
        <p className="text-xs text-neutral-500 mt-0.5">Nominate someone you trust — plumber, cleaner, anyone. We'll invite them so you can book directly here.</p>
      </div>
      <button onClick={() => setOpen(true)}
        className="shrink-0 text-sm font-semibold text-accent border border-accent/25 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors">
        Nominate
      </button>
    </div>
  );

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-neutral-900">Who should we invite?</p>
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

/* ── Page ── */
const HomePage: NextPage = () => {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeBiz, setActiveBiz] = useState<Business | null>(null);

  useScrollReveal('.js-biz-card', 60);
  useScrollReveal('.js-section', 0);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/signin'); return; }
      const name = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'there';
      setUserName(name.split(' ')[0]);
      setLoading(false);
    });
  }, [router]);

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

        {/* ── AI Search header — grid + glow signature ── */}
        <div className="relative bg-white border-b border-neutral-100 overflow-hidden sm-grid">
          {/* Blue glow orb */}
          <div className="sm-glow" style={{ width: 520, height: 520, top: -260, right: -80, opacity: 0.8 }} />
          <div className="sm-glow" style={{ width: 300, height: 300, top: -150, left: '30%', opacity: 0.5 }} />

          <div className="relative mx-auto max-w-6xl px-6 pt-9 pb-8">
            <AISearchBar userName={userName} onSubmit={q => router.push(`/browse?q=${encodeURIComponent(q)}`)} />
          </div>
        </div>

        {/* ── Content ── */}
        <div className="mx-auto max-w-6xl px-6 py-10 space-y-14">

          {/* Featured */}
          <section className="js-section">
            <div className="flex items-end justify-between mb-5">
              <div>
                <span className="sm-eyebrow">Featured</span>
                <h2 className="text-base font-bold text-neutral-900 mt-2" style={{ letterSpacing: '-0.015em' }}>Top-rated near you</h2>
              </div>
              <Link href="/browse" scroll={false} className="text-sm font-semibold text-accent hover:underline underline-offset-2">See all</Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {SPONSORED.map(biz => (
                <div key={biz.id} className="js-biz-card">
                  <BizCard biz={biz} onClick={() => setActiveBiz(biz)} />
                </div>
              ))}
            </div>
          </section>

          {/* Small & Independent — with signature grid */}
          <section className="js-section">
            <div className="relative rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(160deg,#f0f7ff 0%,#fafdff 100%)', border: '1px solid #dbeafe' }}>
              {/* Signature grid inside section */}
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: 'linear-gradient(to right,rgba(10,132,255,0.05) 1px,transparent 1px),linear-gradient(to bottom,rgba(10,132,255,0.05) 1px,transparent 1px)',
                backgroundSize: '32px 32px',
                maskImage: 'radial-gradient(ellipse 80% 100% at 10% 50%, black 40%, transparent 100%)',
                WebkitMaskImage: 'radial-gradient(ellipse 80% 100% at 10% 50%, black 40%, transparent 100%)',
              }} />
              <div className="relative px-5 pt-5 pb-4 flex items-start justify-between gap-4">
                <div>
                  <span className="sm-eyebrow" style={{ color: '#0A84FF' }}>Community Pick</span>
                  <h2 className="text-base font-bold text-neutral-900 mt-2" style={{ letterSpacing: '-0.015em' }}>Small &amp; Independent</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">Solo tradespeople — your booking helps them grow</p>
                </div>
                <Link href="/browse?category=Independent" scroll={false} className="shrink-0 text-sm font-semibold text-accent hover:underline underline-offset-2">See all</Link>
              </div>
              <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 pb-4">
                {INDEPENDENT.map(biz => (
                  <div key={biz.id} className="js-biz-card">
                    <BizCard biz={biz} size="sm" onClick={() => setActiveBiz(biz)} />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* More near you */}
          <section className="js-section">
            <div className="flex items-end justify-between mb-5">
              <div>
                <span className="sm-eyebrow">Nearby</span>
                <h2 className="text-base font-bold text-neutral-900 mt-2" style={{ letterSpacing: '-0.015em' }}>More near you</h2>
              </div>
              <Link href="/browse" scroll={false} className="text-sm font-semibold text-accent hover:underline underline-offset-2">See all</Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {NEARBY.map(biz => (
                <div key={biz.id} className="js-biz-card">
                  <BizCard biz={biz} onClick={() => setActiveBiz(biz)} />
                </div>
              ))}
            </div>
          </section>

          {/* Nominate */}
          <section className="js-section pb-4">
            <NominateCard />
          </section>

        </div>
      </div>

      {activeBiz && <BusinessProfile biz={activeBiz} onClose={() => setActiveBiz(null)} />}
    </>
  );
};

export default HomePage;
