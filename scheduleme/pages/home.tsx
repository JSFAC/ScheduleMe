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

function useScrollReveal(selector: string, delay = 70) {
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
      { threshold: 0.06, rootMargin: '0px 0px -24px 0px' }
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [selector, delay]);
}

// Category → color accent for variety
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Plumbing':      { bg: '#EFF6FF', text: '#1D4ED8' },
  'House Cleaning':{ bg: '#F0FDF4', text: '#166534' },
  'Electrical':    { bg: '#FFFBEB', text: '#92400E' },
  'Landscaping':   { bg: '#F0FDF4', text: '#14532D' },
  'HVAC':          { bg: '#FFF1F2', text: '#9F1239' },
  'Painting':      { bg: '#FDF4FF', text: '#6B21A8' },
  'Handyman':      { bg: '#F8FAFC', text: '#334155' },
};

function StarRating({ rating, reviews }: { rating: number; reviews: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1,2,3,4,5].map(i => (
          <svg key={i} className={`h-2.5 w-2.5 ${i <= Math.round(rating) ? 'text-amber-400' : 'text-neutral-200'}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-[10px] font-bold text-neutral-700">{rating}</span>
      <span className="text-[10px] text-neutral-400">({reviews})</span>
    </div>
  );
}

const AI_SUGGESTIONS = [
  'Leaking pipe under my sink',
  'Deep clean before move-out',
  'AC not cooling properly',
  'Repaint two rooms',
  'Electrical panel noise',
  'Lawn completely overgrown',
];

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
    <div className="mx-auto max-w-xl w-full">
      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.14em] mb-3">
        Good {timeOfDay()}, {userName}
      </p>
      <h1 className="text-[2.1rem] font-bold text-neutral-900 mb-6" style={{ letterSpacing: '-0.03em', lineHeight: 1.1 }}>
        What do you need<br />done today?
      </h1>

      <div className={`relative bg-white rounded-2xl border transition-all duration-200 ${
        focused
          ? 'border-accent shadow-[0_0_0_4px_rgba(10,132,255,0.10),0_4px_24px_rgba(0,0,0,0.07)]'
          : 'border-neutral-200 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:border-neutral-300'
      }`}>
        <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-neutral-100">
          <svg className="h-3.5 w-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <span className="text-[10px] font-black text-accent uppercase tracking-[0.14em]">AI Matching</span>
        </div>
        <textarea
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(query); } }}
          placeholder="Describe your issue — 'my kitchen pipe has been dripping for a week'"
          rows={4}
          className="w-full px-4 pt-3 pb-14 text-sm text-neutral-900 placeholder:text-neutral-400 bg-transparent focus:outline-none resize-none leading-relaxed"
        />
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 pb-3.5">
          <p className="text-[11px] text-neutral-400">↵ to send</p>
          <button onClick={() => submit(query)} disabled={!query.trim() || thinking}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              query.trim() && !thinking
                ? 'bg-accent text-white shadow-[0_2px_10px_rgba(10,132,255,0.3)] hover:bg-accent-dark'
                : 'bg-neutral-100 text-neutral-400'
            }`}>
            {thinking
              ? <div className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              : <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
            }
            Find pros
          </button>
        </div>
      </div>

      <div className="flex gap-2 mt-3 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {AI_SUGGESTIONS.map(s => (
          <button key={s} onClick={() => { setQuery(s); setTimeout(() => inputRef.current?.focus(), 0); }}
            className="shrink-0 text-[11px] text-neutral-500 bg-white border border-neutral-200 hover:border-accent hover:text-accent px-3 py-1.5 rounded-full transition-colors whitespace-nowrap">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// Full-bleed image card — the real premium treatment
function BizCard({ biz, onClick }: { biz: Business; onClick: () => void }) {
  const cat = CATEGORY_COLORS[biz.category] || { bg: '#F8FAFC', text: '#334155' };
  return (
    <button onClick={onClick} className="biz-card group w-full text-left">
      {/* Image — tall, fills the card */}
      <div className="relative h-[140px] overflow-hidden bg-neutral-100">
        <img src={biz.coverUrl} alt={biz.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
        {/* Gradient overlay — bottom up */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.18) 50%, transparent 100%)'
        }} />
        {/* Status pill — floating on image */}
        {biz.available && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-white/95 backdrop-blur-sm rounded-full px-2 py-0.5 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-black text-green-800 uppercase tracking-wide">Open now</span>
          </div>
        )}
        {biz.badge && (
          <div className="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
            {biz.badge}
          </div>
        )}
        {/* Name + rating — bottom of image */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
          <p className="text-white font-bold text-sm leading-tight" style={{ letterSpacing: '-0.01em', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
            {biz.name}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(i => (
                <svg key={i} className={`h-2.5 w-2.5 ${i <= Math.round(biz.rating) ? 'text-amber-400' : 'text-white/30'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-white/90 text-[10px] font-semibold">{biz.rating}</span>
            <span className="text-white/50 text-[10px]">·</span>
            <span className="text-white/70 text-[10px]">{biz.distance}</span>
          </div>
        </div>
      </div>
      {/* Category tag */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-full"
          style={{ background: cat.bg, color: cat.text }}>
          {biz.category}
        </span>
        <svg className="h-3.5 w-3.5 text-neutral-300 group-hover:text-neutral-500 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </button>
  );
}

function ReferCard() {
  const [open, setOpen] = useState(false);
  const [bizName, setBizName] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) return (
    <div className="rounded-2xl border border-green-100 bg-green-50 px-6 py-5 text-center">
      <p className="text-sm font-bold text-green-800">Referral received — thanks.</p>
      <p className="text-xs text-green-600 mt-1">We'll reach out to {bizName} and let you know if they join.</p>
    </div>
  );

  if (!open) return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-neutral-900">Know a great local business?</p>
        <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">Refer a plumber, cleaner, or tradesperson you trust. We'll reach out and invite them to join.</p>
      </div>
      <button onClick={() => setOpen(true)}
        className="shrink-0 text-xs font-black text-accent border border-accent/25 bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-xl transition-colors tracking-widest uppercase">
        Refer
      </button>
    </div>
  );

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-neutral-900">Who should we reach out to?</p>
        <button onClick={() => setOpen(false)} className="text-xs text-neutral-400 hover:text-neutral-600">Cancel</button>
      </div>
      <input type="text" value={bizName} onChange={e => setBizName(e.target.value)}
        placeholder="Business or person's name"
        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent" />
      <button disabled={!bizName.trim()} onClick={() => { if (bizName.trim()) setSent(true); }}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${bizName.trim() ? 'bg-accent text-white hover:bg-accent-dark' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'}`}>
        Submit referral
      </button>
    </div>
  );
}

// Section panel component — white card with hero-matching grid
function SectionPanel({ eyebrow, title, subtitle, blue, href, hrefLabel, children }: {
  eyebrow: string; title: string; subtitle: string;
  blue?: boolean; href: string; hrefLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`sm-panel rounded-2xl border ${blue ? 'sm-panel-blue border-blue-100' : 'border-neutral-150'}`}
      style={!blue ? { border: '1px solid rgba(0,0,0,0.07)' } : undefined}>
      <div className="sm-glow" style={{ width: 400, height: 320, top: -160, right: blue ? -60 : 0 }} />
      <div className="relative px-5 pt-5 pb-4 flex items-start justify-between gap-4">
        <div>
          <span className="sm-eyebrow">{eyebrow}</span>
          <h2 className="text-base font-bold text-neutral-900 mt-2" style={{ letterSpacing: '-0.02em' }}>{title}</h2>
          <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>
        </div>
        <Link href={href} scroll={false} className="shrink-0 text-[11px] font-black text-accent uppercase tracking-widest mt-1">See all →</Link>
      </div>
      <div className="relative px-4 pb-4">
        {children}
      </div>
    </div>
  );
}

const HomePage: NextPage = () => {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeBiz, setActiveBiz] = useState<Business | null>(null);

  useScrollReveal('.js-biz-card', 55);
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
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="relative h-6 w-6">
        <div className="absolute inset-0 rounded-full border-2 border-neutral-200" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
      </div>
    </div>
  );

  return (
    <>
      <Head><title>Home — ScheduleMe</title></Head>
      <Nav />

      <div className="min-h-screen bg-neutral-50 pt-[72px]">

        {/* AI Search header — sm-panel treatment */}
        <div className="sm-panel border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          {/* Glow blooms behind/under the heading */}
          <div className="sm-glow" style={{ width: 600, height: 440, top: -80, left: -100 }} />
          <div className="relative mx-auto max-w-6xl px-6 pt-10 pb-10">
            <AISearchBar userName={userName} onSubmit={q => router.push(`/browse?q=${encodeURIComponent(q)}`)} />
          </div>
        </div>

        {/* Content */}
        <div className="mx-auto max-w-6xl px-6 py-6 space-y-4">

          <SectionPanel
            eyebrow="Featured"
            title="Top-rated near you"
            subtitle="Available now and highly reviewed"
            href="/browse"
            hrefLabel="See all"
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {SPONSORED.map(biz => (
                <div key={biz.id} className="js-biz-card">
                  <BizCard biz={biz} onClick={() => setActiveBiz(biz)} />
                </div>
              ))}
            </div>
          </SectionPanel>

          <SectionPanel
            eyebrow="Community Pick"
            title="Small & Independent"
            subtitle="Solo tradespeople — your booking helps them grow"
            blue
            href="/browse?category=Independent"
            hrefLabel="See all"
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {INDEPENDENT.map(biz => (
                <div key={biz.id} className="js-biz-card">
                  <BizCard biz={biz} onClick={() => setActiveBiz(biz)} />
                </div>
              ))}
            </div>
          </SectionPanel>

          <SectionPanel
            eyebrow="Nearby"
            title="More near you"
            subtitle="Local pros ready to take on your job"
            href="/browse"
            hrefLabel="See all"
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {NEARBY.map(biz => (
                <div key={biz.id} className="js-biz-card">
                  <BizCard biz={biz} onClick={() => setActiveBiz(biz)} />
                </div>
              ))}
            </div>
          </SectionPanel>

          <section className="js-section pb-4">
            <ReferCard />
          </section>

        </div>
      </div>

      {activeBiz && <BusinessProfile biz={activeBiz} onClose={() => setActiveBiz(null)} />}
    </>
  );
};

export default HomePage;
