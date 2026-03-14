// pages/home.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import { useDarkMode } from '../lib/useDarkMode';
import BusinessProfile from '../components/BusinessProfile';
import { SPONSORED, INDEPENDENT, NEARBY, type Business } from '../lib/mockBusinesses';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
function timeOfDay() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

// PILL_STYLE is now inline-dynamic in components that have dm

const AI_SUGGESTIONS: { label: string; prompt: string }[] = [
  { label: 'Leaking pipe', prompt: 'My kitchen pipe has been dripping under the sink for about a week. It gets worse when I run the dishwasher. I need a licensed plumber who can come soon.' },
  { label: 'Deep clean', prompt: "I need a thorough deep clean of my apartment before my landlord inspection next week. It's a 2-bed 1-bath, roughly 900 sq ft. Looking for someone reliable and detail-oriented." },
  { label: 'AC not cooling', prompt: "My AC unit runs but the house isn't cooling down properly. It's an older central air system and I think it might need refrigerant or a tune-up. Can someone take a look?" },
  { label: 'Room repaint', prompt: 'I want to repaint my living room and hallway before guests arrive next month. The walls are currently a dark gray and I want to go lighter. Looking for a clean, professional job.' },
  { label: 'Breaker tripping', prompt: 'My circuit breaker keeps tripping every time I use the microwave in my kitchen. It might be an overloaded circuit. I need a licensed electrician to assess and fix it.' },
  { label: 'Overgrown yard', prompt: 'My backyard is completely overgrown — tall grass, weeds, and some overgrown bushes. I need someone who can do a full cleanup and haul away the clippings.' },
  { label: 'Cracked tiles', prompt: 'Several bathroom floor tiles are cracked and one is completely broken. I need someone experienced with tile replacement who can match or closely approximate the existing style.' },
  { label: 'Furniture assembly', prompt: 'I just got a delivery of IKEA furniture — a bed frame, wardrobe, and two nightstands. I need someone available this weekend to assemble everything.' },
  { label: 'Water heater noise', prompt: 'My water heater has been making a loud banging or popping noise, especially in the morning. I think it might need flushing or a part replaced. Looking for a plumber or HVAC tech.' },
  { label: 'Patio lighting', prompt: 'I want to add outdoor string lights and two wall-mounted fixtures to my patio. I need an electrician who can run the wiring properly and make it weatherproof.' },
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
  const chipsRef = useRef<HTMLDivElement>(null);
  const chipsDragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });

  function submit(q: string) {
    if (!q.trim() || thinking) return;
    setThinking(true);
    setTimeout(() => { setThinking(false); onSubmit(q.trim()); }, 380);
  }

  // Non-passive wheel on chips row
  useEffect(() => {
    const el = chipsRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el!.scrollLeft += e.deltaY * 1.2;
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function onChipsMouseDown(e: React.MouseEvent) {
    chipsDragRef.current = { active: true, startX: e.pageX - chipsRef.current!.offsetLeft, scrollLeft: chipsRef.current!.scrollLeft };
    if (chipsRef.current) chipsRef.current.style.cursor = 'grabbing';
  }
  function onChipsMouseMove(e: React.MouseEvent) {
    if (!chipsDragRef.current.active || !chipsRef.current) return;
    e.preventDefault();
    const x = e.pageX - chipsRef.current.offsetLeft;
    chipsRef.current.scrollLeft = chipsDragRef.current.scrollLeft - (x - chipsDragRef.current.startX) * 1.2;
  }
  function onChipsMouseUp() {
    chipsDragRef.current.active = false;
    if (chipsRef.current) chipsRef.current.style.cursor = 'grab';
  }

  return (
    <div className="w-full">
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
            Find Pro
          </button>
        </div>
      </div>
      {/* Suggestion chips — clipped to chat box width, draggable, wheel-scrollable */}
      <div className="mt-3 overflow-hidden" style={{
        maskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 92%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 92%, transparent 100%)',
      }}>
        <div
          ref={chipsRef}
          onMouseDown={onChipsMouseDown}
          onMouseMove={onChipsMouseMove}
          onMouseUp={onChipsMouseUp}
          onMouseLeave={onChipsMouseUp}
          className="flex gap-2 overflow-x-auto pb-0.5 select-none"
          style={{ scrollbarWidth: 'none', cursor: 'grab' }}
        >
          <span className="shrink-0 w-1 block" />
          {AI_SUGGESTIONS.map(({ label, prompt }) => (
            <button key={label} onClick={() => { setQuery(prompt); setTimeout(() => inputRef.current?.focus(), 0); }}
              className="shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all whitespace-nowrap"
              style={{ background: 'rgba(255,255,255,0.88)', color: '#2563eb', border: '1px solid rgba(255,255,255,0.95)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.88)'; }}>
              {label}
            </button>
          ))}
          <span className="shrink-0 w-4 block" />
        </div>
      </div>
    </div>
  );
}

// Card — horizontal scroll card with review snippet
function BizCard({ biz, onClick, dm }: { biz: Business; onClick: () => void; dm?: boolean }) {
  return (
    <button onClick={onClick} className="biz-card group text-left flex-shrink-0"
      style={{ width: 'clamp(220px, 18vw, 290px)' }}>
      <div className="relative overflow-hidden" style={{ height: 'clamp(175px, 14vw, 220px)', background: '#c8d8e8' }}>
        <img src={biz.coverUrl} alt={biz.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          style={{ objectPosition: '50% 15%' }} />
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.08) 50%, transparent 100%)'
        }} />
        {biz.available ? (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 shadow-sm"
            style={{ background: 'rgba(255,255,255,0.95)' }}>
            <span className="h-2 w-2 rounded-full shrink-0 bg-emerald-500" />
            <span className="text-[10px] font-black tracking-wide text-emerald-600">Open</span>
          </div>
        ) : (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">
            <span className="h-2 w-2 rounded-full bg-neutral-400 shrink-0" />
            <span className="text-[10px] font-bold text-white/60 tracking-wide">Fully Booked</span>
          </div>
        )}
        {biz.badge && (
          <div className="absolute top-3 right-3 text-white text-[9px] font-black px-2.5 py-1 rounded-full tracking-wide"
            style={{ background: 'rgba(0,0,0,0.58)', backdropFilter: 'blur(8px)' }}>
            {biz.badge}
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 px-3.5 pb-3">
          <p className="text-white font-black leading-snug" style={{ fontSize: 13, letterSpacing: '-0.01em', textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
            {biz.name}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(i => (
                <svg key={i} className={`h-2.5 w-2.5 ${i <= Math.round(biz.rating) ? 'text-amber-400' : 'text-white/20'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-white/90 font-semibold" style={{ fontSize: 10 }}>{biz.rating}</span>
            <span className="text-white/40 text-[10px]">·</span>
            <span className="text-white/65 text-[10px]">{biz.distance}</span>
          </div>
        </div>
      </div>
      {/* Card body — category + review snippet + reviewer */}
      <div className="px-3.5 pt-2.5 pb-3" style={{ background: dm ? '#1a1d27' : 'white' }}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: dm ? '#0d2040' : '#EBF4FF', color: dm ? '#60a5fa' : '#1A6FD4' }}>
            {biz.category}
          </span>
          <svg className="h-4 w-4 text-neutral-300 group-hover:text-neutral-500 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
        {biz.topReview && (
          <p className="text-[10.5px] italic leading-snug line-clamp-2 mb-2" style={{ color: dm ? '#d1d5db' : '#737373' }}>{biz.topReview}</p>
        )}
        {biz.reviewer && (
          <div className="flex items-center gap-1.5">
            <img src={biz.reviewer.avatarUrl} alt={biz.reviewer.name}
              className="h-4 w-4 rounded-full object-cover border border-neutral-100 shrink-0" />
            <span className="text-[10px] font-semibold" style={{ color: dm ? '#9ca3af' : '#a3a3a3' }}>{biz.reviewer.name}</span>
          </div>
        )}
      </div>
    </button>
  );
}

function ScrollSection({ title, subtitle, href, businesses, onBizClick, dm }: {
  title: string; subtitle: string; href: string;
  businesses: Business[]; onBizClick: (b: Business) => void; dm?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });

  // Non-passive wheel listener — prevents page scroll while hovering the scroll row
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      // Only intercept if cursor is in the card zone (not over the curtain margins)
      // The curtains have pointer-events:none so this fires only over cards
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el!.scrollLeft += e.deltaY * 1.4;
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function onMouseDown(e: React.MouseEvent) {
    dragRef.current = { active: true, startX: e.pageX - scrollRef.current!.offsetLeft, scrollLeft: scrollRef.current!.scrollLeft };
    if (scrollRef.current) scrollRef.current.style.cursor = 'grabbing';
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragRef.current.active || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    scrollRef.current.scrollLeft = dragRef.current.scrollLeft - (x - dragRef.current.startX) * 1.2;
  }
  function onMouseUp() {
    dragRef.current.active = false;
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab';
  }

  // edgePad must match exactly — cards start and end here, curtains cover outside
  const edgePad = 'max(24px, calc((100vw - 1400px) / 2))';

  return (
    <section>
      <div className="flex items-center justify-between mb-4" style={{ paddingLeft: edgePad, paddingRight: edgePad }}>
        <div className="flex items-baseline gap-3">
          <h2 className="text-[1.2rem] font-black text-neutral-900" style={{ letterSpacing: '-0.025em' }}>{title}</h2>
          <span className="text-[11px] text-neutral-400 font-medium hidden sm:block">{subtitle}</span>
        </div>
        <Link href={href} scroll={false}
          className="text-[11px] font-black text-accent uppercase tracking-widest hover:opacity-70 transition-opacity shrink-0">
          See all →
        </Link>
      </div>

      {/* Scroll container — full width, cards start at edgePad */}
      <div className="relative">
        {/* Left curtain — solid cover + very subtle 20px feather */}
        <div className="absolute left-0 top-0 bottom-0 z-10 pointer-events-auto"
          style={{ width: edgePad, background: dm ? '#0f1117' : '#EDF5FF' }} />
        {/* Right curtain */}
        <div className="absolute right-0 top-0 bottom-0 z-10 pointer-events-auto"
          style={{ width: edgePad, background: dm ? '#0f1117' : '#EDF5FF' }} />

        <div
          ref={scrollRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          className="flex gap-3.5 overflow-x-auto pb-2 select-none"
          style={{
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
            paddingLeft: edgePad,
            paddingRight: edgePad,
            cursor: 'grab',
          } as React.CSSProperties}
        >
          {businesses.map((biz) => (
            <BizCard key={biz.id} biz={biz} onClick={() => onBizClick(biz)} dm={dm} />
          ))}
          {/* See more — same total height as BizCard (image + body) */}
          <Link href={href} scroll={false}
            className="flex-shrink-0 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-accent/20 hover:border-accent/40 bg-white hover:bg-accent-wash transition-all group"
            style={{
              width: 'clamp(160px, 13vw, 200px)',
              height: 'calc(clamp(185px, 15vw, 240px) + 68px)',
              marginBottom: '8px',
            }}>
            <div className="h-10 w-10 rounded-full bg-accent/10 group-hover:bg-accent/15 flex items-center justify-center transition-colors">
              <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
            <div className="text-center px-4">
              <p className="text-[12px] font-black text-accent leading-tight">See all pros</p>
              <p className="text-[10px] text-neutral-400 mt-1 leading-snug">Browse more in this category</p>
            </div>
          </Link>
        </div>
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
    <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4" style={{ marginLeft: 'max(24px, calc((100vw - 1400px) / 2))', marginRight: 'max(24px, calc((100vw - 1400px) / 2))' }}>
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
    <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-5 space-y-3" style={{ marginLeft: 'max(24px, calc((100vw - 1400px) / 2))', marginRight: 'max(24px, calc((100vw - 1400px) / 2))' }}>
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
  const { dark: dm } = useDarkMode();
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
      <div className="min-h-screen pt-[72px]" data-page-bg="true" style={{ background: 'var(--page-bg, #EDF5FF)' }}>

        {/* Search hero — flat solid blue, clean */}
        <div className="border-b" style={{
          background: '#3b82f6',
          borderColor: 'rgba(0,0,0,0.08)'
        }}>
          <div className="relative mx-auto max-w-4xl px-6 pt-9 pb-9">
            <div className="flex items-center gap-10">
              {/* Search — constrained width */}
              <div className="flex-1 min-w-0 max-w-lg">
                <AISearchBar userName={userName} onSubmit={q => router.push(`/browse?q=${encodeURIComponent(q)}`)} />
              </div>
              {/* 4 utility nav tiles — right side, desktop only */}
              <div className="hidden lg:grid grid-cols-2 grid-rows-2 gap-2.5 w-[260px] shrink-0">
                {([
                  { label: 'My Bookings', sub: 'Track your jobs', href: '/bookings', d: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5' },
                  { label: 'Browse Pros', sub: 'See all services', href: '/browse', d: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z' },
                  { label: 'How It Works', sub: 'Pricing & info', href: '/pricing', d: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z' },
                  { label: 'Refer a Pro', sub: 'Know someone good?', href: '#refer', d: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
                ] as const).map((tile) => (
                  <Link key={tile.label} href={tile.href} scroll={false}
                    className="flex flex-col justify-between rounded-2xl px-3.5 py-3.5 transition-all hover:scale-[1.02] hover:shadow-md"
                    style={{ background: dm ? 'rgba(255,255,255,0.12)' : 'white', border: dm ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.07)', aspectRatio: '1', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center mb-2" style={{ background: 'rgba(59,130,246,0.10)' }}>
                      <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={tile.d} />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[12px] font-black text-neutral-800 leading-snug">{tile.label}</p>
                      <p className="text-[10px] text-blue-500 mt-0.5 font-medium">{tile.sub}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Category quick-links */}
        <div className="bg-white border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <div className="flex gap-1.5 overflow-x-auto px-6 py-3" style={{ scrollbarWidth: 'none', justifyContent: 'safe center' }}>
            {QUICK_CATS.map(cat => (
              <Link key={cat.label} href={`/browse?category=${cat.label}`} scroll={false}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all group"
                style={{ background: dm ? '#0d1f35' : '#EDF5FF', borderColor: dm ? 'rgba(10,132,255,0.3)' : 'rgba(10,132,255,0.15)' }}>
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
            dm={dm}
          />
          <ScrollSection
            title="Small & Independent"
            subtitle="Solo tradespeople — your booking helps them grow"
            href="/browse?category=Independent"
            businesses={[...INDEPENDENT, ...SPONSORED.slice(0, 2)].slice(0, 6)}
            onBizClick={setActiveBiz}
            dm={dm}
          />
          <ScrollSection
            title="Quick response"
            subtitle="Pros that pick up jobs fast"
            href="/browse"
            businesses={[...NEARBY, ...INDEPENDENT].slice(0, 6)}
            onBizClick={setActiveBiz}
            dm={dm}
          />
          <ReferCard />
        </div>

      </div>
      {activeBiz && <BusinessProfile biz={activeBiz} onClose={() => setActiveBiz(null)} />}
    </>
  );
};

export default HomePage;
