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

const CORAL = '#FF6B4A';
const PILL_STYLE = { background: '#EBF4FF', color: '#1A6FD4' };

const AI_SUGGESTIONS = [
  'Leaking pipe under my sink',
  'Deep clean before move-out',
  'AC not cooling properly',
  'Repaint two rooms',
  'Electrical panel noise',
  'Lawn completely overgrown',
];

const QUICK_CATS = [
  { label: 'Plumbing',   d: 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z' },
  { label: 'Cleaning',   d: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5' },
  { label: 'Electrical', d: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z' },
  { label: 'HVAC',       d: 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z' },
  { label: 'Handyman',   d: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z' },
  { label: 'Painting',   d: 'M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42' },
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
      <p className="text-[10px] font-black uppercase tracking-[0.14em] mb-3" style={{ color: 'rgba(255,255,255,0.7)' }}>
        Good {timeOfDay()}, {userName}
      </p>
      <h1 className="text-[2.4rem] font-bold text-white mb-6" style={{ letterSpacing: '-0.03em', lineHeight: 1.08 }}>
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
          ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
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
            className="shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all whitespace-nowrap"
            style={{ background: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.25)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.28)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.18)'; }}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// Card — bigger, bolder. featured = first card in a row, slightly taller + wider
function BizCard({ biz, onClick, featured }: { biz: Business; onClick: () => void; featured?: boolean }) {
  return (
    <button onClick={onClick} className="biz-card group text-left flex-shrink-0"
      style={{ width: featured ? 272 : 210 }}>
      <div className="relative overflow-hidden bg-neutral-100" style={{ height: featured ? 216 : 172 }}>
        <img src={biz.coverUrl} alt={biz.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.08) 50%, transparent 100%)'
        }} />
        {biz.available ? (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 shadow-sm"
            style={{ background: 'rgba(255,255,255,0.95)' }}>
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: CORAL }} />
            <span className="text-[10px] font-black tracking-wide" style={{ color: CORAL }}>Open</span>
          </div>
        ) : (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">
            <span className="h-2 w-2 rounded-full bg-neutral-400 shrink-0" />
            <span className="text-[10px] font-bold text-white/60 tracking-wide">Busy</span>
          </div>
        )}
        {biz.badge && (
          <div className="absolute top-3 right-3 text-white text-[9px] font-black px-2.5 py-1 rounded-full tracking-wide"
            style={{ background: 'rgba(0,0,0,0.58)', backdropFilter: 'blur(8px)' }}>
            {biz.badge}
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 px-3.5 pb-3.5">
          <p className="text-white font-black leading-snug" style={{
            fontSize: featured ? 15 : 13,
            letterSpacing: '-0.01em',
            textShadow: '0 1px 8px rgba(0,0,0,0.6)'
          }}>
            {biz.name}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(i => (
                <svg key={i} className={`${featured ? 'h-3 w-3' : 'h-2.5 w-2.5'} ${i <= Math.round(biz.rating) ? 'text-amber-400' : 'text-white/20'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-white/90 font-semibold" style={{ fontSize: featured ? 11 : 10 }}>{biz.rating}</span>
            <span className="text-white/40 text-[10px]">·</span>
            <span className="text-white/65 text-[10px]">{biz.distance}</span>
          </div>
        </div>
      </div>
      <div className="px-3.5 pt-2.5 pb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={PILL_STYLE}>
            {biz.category}
          </span>
          {featured && (
            <p className="text-[11px] text-neutral-400 mt-1.5 leading-snug line-clamp-1">{biz.tagline}</p>
          )}
        </div>
        <svg className="h-4 w-4 text-neutral-300 group-hover:text-neutral-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </button>
  );
}

function ScrollSection({ title, subtitle, href, businesses, onBizClick }: {
  title: string; subtitle: string; href: string;
  businesses: Business[]; onBizClick: (b: Business) => void;
}) {
  return (
    <section>
      <div className="flex items-end justify-between mb-4 px-6">
        <div>
          <h2 className="text-[1.2rem] font-black text-neutral-900" style={{ letterSpacing: '-0.025em' }}>{title}</h2>
          <p className="text-[12px] text-neutral-400 mt-0.5">{subtitle}</p>
        </div>
        <Link href={href} scroll={false}
          className="text-[11px] font-black text-accent uppercase tracking-widest hover:opacity-70 transition-opacity shrink-0 mb-0.5">
          See all →
        </Link>
      </div>
      <div className="flex gap-3.5 overflow-x-auto pl-6 pr-6 pb-2" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        {businesses.map((biz, i) => (
          <BizCard key={biz.id} biz={biz} onClick={() => onBizClick(biz)} featured={i === 0} />
        ))}
      </div>
    </section>
  );
}

function ReferCard() {
  const [open, setOpen] = useState(false);
  const [bizName, setBizName] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) return (
    <div className="mx-6 rounded-2xl border border-green-100 bg-green-50 px-6 py-5 text-center">
      <p className="text-sm font-bold text-green-800">Referral received — thanks.</p>
      <p className="text-xs text-green-600 mt-1">We'll reach out to {bizName} and let you know if they join.</p>
    </div>
  );
  if (!open) return (
    <div className="mx-6 rounded-2xl border border-neutral-200 bg-white px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-neutral-900">Know a great local business?</p>
        <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">Refer a plumber, cleaner, or tradesperson you trust.</p>
      </div>
      <button onClick={() => setOpen(true)}
        className="shrink-0 text-xs font-black text-accent border border-accent/25 bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-xl transition-colors tracking-widest uppercase">
        Refer
      </button>
    </div>
  );
  return (
    <div className="mx-6 rounded-2xl border border-neutral-200 bg-white px-6 py-5 space-y-3">
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
      <div className="min-h-screen pt-[72px]" style={{ background: '#EDF5FF' }}>

        {/* Search hero — full-bleed blue gradient, fills all the dead space */}
        <div className="relative overflow-hidden border-b" style={{
          background: 'linear-gradient(160deg, #2563eb 0%, #3b82f6 40%, #7ab8f5 80%, #c7e2ff 100%)',
          borderColor: 'rgba(0,0,0,0.08)'
        }}>
          {/* Subtle grid overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '48px 48px'
          }} />
          {/* Glow blobs */}
          <div className="absolute top-[-80px] right-[10%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 65%)'
          }} />
          <div className="absolute bottom-[-60px] left-[5%] w-[400px] h-[400px] rounded-full pointer-events-none" style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 65%)'
          }} />
          <div className="relative mx-auto max-w-6xl px-6 pt-9 pb-9">
            <div className="flex items-start gap-16">
              {/* Search — takes up left side */}
              <div className="flex-1 min-w-0">
                <AISearchBar userName={userName} onSubmit={q => router.push(`/browse?q=${encodeURIComponent(q)}`)} />
              </div>
              {/* Decorative category tiles — right side, desktop only */}
              <div className="hidden lg:grid grid-cols-2 gap-2.5 w-[260px] shrink-0 pt-10 pb-2">
                {QUICK_CATS.map((cat) => (
                  <Link key={cat.label} href={`/browse?category=${cat.label}`} scroll={false}
                    className="flex flex-col items-center gap-2 rounded-2xl px-3 py-4 transition-all hover:scale-[1.03]"
                    style={{ background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.35)' }}>
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.30)' }}>
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={cat.d} />
                      </svg>
                    </div>
                    <span className="text-[11px] font-bold text-white/90 text-center leading-snug">{cat.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Category quick-links */}
        <div className="bg-white border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <div className="flex gap-1.5 overflow-x-auto px-6 py-3" style={{ scrollbarWidth: 'none' }}>
            {QUICK_CATS.map(cat => (
              <Link key={cat.label} href={`/browse?category=${cat.label}`} scroll={false}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-wash hover:bg-blue-100 border border-accent/15 hover:border-accent/30 transition-all group">
                <svg className="h-4 w-4 text-accent/70 group-hover:text-accent transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={cat.d} />
                </svg>
                <span className="text-[12px] font-semibold text-accent/80 group-hover:text-accent transition-colors whitespace-nowrap">{cat.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Scrollable business rows */}
        <div className="py-8 space-y-10">
          <ScrollSection
            title="Top-rated near you"
            subtitle="Available now — highly reviewed"
            href="/browse"
            businesses={[...SPONSORED, ...NEARBY].slice(0, 6)}
            onBizClick={setActiveBiz}
          />
          <ScrollSection
            title="Small & Independent"
            subtitle="Solo tradespeople — your booking helps them grow"
            href="/browse?category=Independent"
            businesses={[...INDEPENDENT, ...SPONSORED.slice(0, 2)].slice(0, 6)}
            onBizClick={setActiveBiz}
          />
          <ScrollSection
            title="Quick response"
            subtitle="Pros that pick up jobs fast"
            href="/browse"
            businesses={[...NEARBY, ...INDEPENDENT].slice(0, 6)}
            onBizClick={setActiveBiz}
          />
          <ReferCard />
        </div>

      </div>
      {activeBiz && <BusinessProfile biz={activeBiz} onClose={() => setActiveBiz(null)} />}
    </>
  );
};

export default HomePage;
