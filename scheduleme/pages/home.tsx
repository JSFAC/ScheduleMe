// @ts-nocheck
// pages/home.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import { useDm } from '../lib/DarkModeContext';
import BusinessProfile from '../components/BusinessProfile';
import type { Business } from '../lib/mockBusinesses';
import { SkeletonScrollRow, SkeletonCard } from '../components/SkeletonCard';
import FeedbackModal from '../components/FeedbackModal';
import { fetchAllBusinesses } from '../lib/realBusinesses';
import { formatPriceTierLabel } from '../lib/priceTierLabel';

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
const ALL_CATEGORY_ICON = 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z';

function iconForCategory(label: string) {
  const lower = label.toLowerCase();
  const exact = QUICK_CATS.find((c) => c.label.toLowerCase() === lower);
  if (exact) return exact.d;
  if (lower.includes('photo') || lower.includes('video') || lower.includes('media')) return 'M6.429 9.75L3.75 12m0 0l2.679 2.25M3.75 12h9m3.75-1.5h.008v.008h-.008V10.5zm0 3h.008v.008h-.008V13.5zm3-3h.008v.008h-.008V10.5zm0 3h.008v.008h-.008V13.5zm3-3h.008v.008h-.008V10.5zm0 3h.008v.008h-.008V13.5z';
  if (lower.includes('hair') || lower.includes('beauty') || lower.includes('barber') || lower.includes('nails')) return 'M3.75 9.75l8.25-6 8.25 6M4.5 10.5v8.25a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5V10.5M9 21V12h6v9';
  if (lower.includes('music') || lower.includes('audio') || lower.includes('dj')) return 'M9 19V6l12-2v13';
  if (lower.includes('design') || lower.includes('print') || lower.includes('3d') || lower.includes('cad')) return 'M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42';
  return 'M12 6v12m6-6H6';
}

function shouldShowNewBadge({ createdAt, reviewCount }: { createdAt?: string | null; reviewCount?: number | null }) {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  const ageDays = (Date.now() - t) / (1000 * 60 * 60 * 24);
  return ageDays <= 30 && (reviewCount ?? 0) <= 2;
}

function AISearchBar({ userName, onSubmit }: { userName: string; onSubmit: (q: string) => void }) {
  const { dm } = useDm();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [thinking, setThinking] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  // Animated placeholder — cycles through example prompts
  const PLACEHOLDERS = [
    "Describe what you need — 'kitchen pipe dripping for a week'",
    "e.g. 'Need a haircut before formal this Friday'",
    "e.g. 'Looking for a photographer for my graduation'",
    "e.g. 'AC stopped working, need someone today'",
    "e.g. 'Help moving out of my dorm on May 15th'",
  ];
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [displayPlaceholder, setDisplayPlaceholder] = useState('');
  const [isTypingPlaceholder, setIsTypingPlaceholder] = useState(true);

  useEffect(() => {
    if (focused || query) return; // stop animation when user is using the field
    const target = PLACEHOLDERS[placeholderIdx];
    let i = 0;
    setDisplayPlaceholder('');
    setIsTypingPlaceholder(true);
    const typeInterval = setInterval(() => {
      i++;
      setDisplayPlaceholder(target.slice(0, i));
      if (i >= target.length) {
        clearInterval(typeInterval);
        setIsTypingPlaceholder(false);
        // Pause then move to next
        setTimeout(() => {
          setPlaceholderIdx(idx => (idx + 1) % PLACEHOLDERS.length);
        }, 2200);
      }
    }, 28);
    return () => clearInterval(typeInterval);
  }, [placeholderIdx, focused, query]);
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
      <h1 className="text-[2.6rem] font-black text-white mb-5" style={{ letterSpacing: '-0.03em', lineHeight: 1.08 }}>
        What do you need<br />done today?
      </h1>
      <div className={`relative rounded-2xl border transition-all duration-200 ${focused ? 'border-accent shadow-[0_0_0_4px_rgba(15,118,110,0.12),0_8px_32px_rgba(0,0,0,0.08)]' : ''}`}
        style={{ background: dm ? '#111111' : 'white', borderColor: focused ? undefined : (dm ? '#262626' : '#e5e5e5') }}>
        <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b" style={{ borderColor: dm ? '#262626' : '#f5f5f5' }}>
          <svg className="h-3.5 w-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <span className="text-[10px] font-black text-accent uppercase tracking-[0.14em]">AI Matching</span>
        </div>
        <textarea
          ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(query); } }}
          placeholder={focused || query ? "Describe what you need…" : (displayPlaceholder || PLACEHOLDERS[0])}
          rows={4}
          className="w-full px-4 pt-3 pb-14 text-sm placeholder:text-neutral-400 bg-transparent focus:outline-none resize-none leading-relaxed" style={{ color: dm ? '#f3f4f6' : '#171717' }}
        />
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 pb-3.5">
          <p className="text-[11px]" style={{ color: dm ? 'rgba(255,255,255,0.35)' : '#a3a3a3' }}>↵ to send</p>
          <button onClick={() => submit(query)} disabled={!query.trim() || thinking}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              query.trim() && !thinking
                ? 'bg-accent text-white shadow-[0_2px_10px_rgba(15,118,110,0.3)] hover:bg-accent-dark'
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
              style={{ background: dm ? 'rgba(10,10,20,0.75)' : 'rgba(249,247,242,0.95)', color: dm ? '#6ee7b7' : '#0F766E', border: dm ? '1px solid rgba(110,231,183,0.35)' : '1px solid rgba(15,118,110,0.22)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = dm ? 'rgba(20,20,30,0.95)' : 'rgba(243,239,230,1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = dm ? 'rgba(10,10,20,0.75)' : 'rgba(249,247,242,0.95)'; }}>
              {label}
            </button>
          ))}
          <span className="shrink-0 w-4 block" />
        </div>
      </div>
    </div>
  );
}

// Card — horizontal scroll card, clean stacked layout
function BizCard({ biz, onClick, dm, index = 0 }: { biz: Business; onClick: () => void; dm?: boolean; index?: number }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const cardBg = dm ? '#1c1c1e' : 'white';
  const isLocked = biz.preview_locked === true;
  const showName = biz.name || biz.category || 'Provider';
  const initials = isLocked ? 'ST' : ((showName || '').split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || 'PR');
  const hasCover = !!biz.coverUrl && biz.coverUrl !== 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  return (
    <button
      onClick={isLocked ? undefined : onClick}
      disabled={isLocked}
      className="biz-card group text-left flex-shrink-0 animate-fade-up flex flex-col"
      style={{
        width: 'clamp(180px, 48vw, 240px)',
        animationDelay: `${index * 0.06}s`,
        borderRadius: 16,
        overflow: 'hidden',
        background: cardBg,
        boxShadow: dm ? '0 0 0 1px #2c2c2e' : '0 1px 4px rgba(0,0,0,0.08)',
        cursor: isLocked ? 'not-allowed' : 'pointer',
      }}>
      {/* Square image */}
      <div className="relative flex-shrink-0 w-full overflow-hidden" style={{ aspectRatio: '3/2', background: dm ? '#2c2c2e' : '#e5e7eb' }}>
        {isLocked ? (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: dm ? '#30333f' : '#d1d5db' }}>
            <span className="text-[30px] font-black" style={{ color: dm ? '#9ca3af' : '#6b7280', letterSpacing: '-0.04em' }}>{initials}</span>
          </div>
        ) : hasCover ? (
          <img src={biz.coverUrl} alt={biz.name}
            onLoad={() => setImgLoaded(true)}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            style={{ objectPosition: '50% 20%', opacity: imgLoaded ? 1 : 0 }} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
            <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0L15 15m-1.5-1.5l1.159-1.159a2.25 2.25 0 013.182 0L21.75 16.5m-1.5-13.5h-15A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21h15a2.25 2.25 0 002.25-2.25V5.25A2.25 2.25 0 0020.25 3z" />
              </svg>
            </div>
            <span className="text-[11px] font-semibold">No photos added</span>
          </div>
        )}
        <div className="absolute top-2 left-2">
          {biz.available
            ? <div className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: dm ? 'rgba(16,185,129,0.16)' : 'rgba(255,255,255,0.92)', border: dm ? '1px solid rgba(52,211,153,0.35)' : 'none', backdropFilter: 'blur(4px)' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold" style={{ color: dm ? '#86efac' : '#047857' }}>Open</span>
              </div>
            : <div className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: dm ? 'rgba(38,38,38,0.9)' : 'rgba(0,0,0,0.5)', border: dm ? '1px solid rgba(255,255,255,0.12)' : 'none', backdropFilter: 'blur(4px)' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                <span className="text-[10px] font-bold" style={{ color: dm ? '#d1d5db' : 'rgba(255,255,255,0.85)' }}>Booked</span>
              </div>
          }
        </div>
        {isLocked && (
          <div className="absolute left-2 bottom-2 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.08em]" style={{ background: dm ? 'rgba(23,23,23,0.94)' : 'rgba(31,41,55,0.92)', color: '#f3f4f6', border: '1px solid rgba(255,255,255,0.18)' }}>
            Private until student verification
          </div>
        )}
      </div>
      {/* Body */}
      <div className="p-2.5 flex flex-col gap-1" style={{ background: cardBg }}>
        <p className="font-bold text-[12px] leading-snug" style={{ color: dm ? '#f2f2f7' : '#1c1c1e', letterSpacing: '-0.01em' }}>{showName}</p>
        {isLocked && (
          <p className="text-[10px] font-medium" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>Private until student verification</p>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: dm ? 'rgba(15,118,110,0.2)' : '#DCEEEB', color: '#0F766E' }}>{biz.category}</span>
          {formatPriceTierLabel(biz.price_tier) ? (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: dm ? 'rgba(15,118,110,0.2)' : '#DCEEEB', color: '#0F766E' }}>
              {formatPriceTierLabel(biz.price_tier)}
            </span>
          ) : null}
          {shouldShowNewBadge({ createdAt: (biz as any).created_at, reviewCount: biz.reviews }) ? (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: dm ? 'rgba(251,191,36,0.18)' : '#fef3c7', color: dm ? '#f59e0b' : '#92400e' }}>
              New
            </span>
          ) : null}
        </div>
        <p className="text-[10px]" style={{ color: dm ? '#8e8e93' : '#8e8e93' }}>{biz.distance}</p>
        <div className="flex items-center gap-0.5">
          {[1,2,3,4,5].map(i => (
            <svg key={i} className={`h-2.5 w-2.5 ${i <= Math.round(biz.rating) ? 'text-amber-400' : (dm ? 'text-neutral-600' : 'text-neutral-200')}`} fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
          <span className="text-[10px] font-semibold ml-1" style={{ color: dm ? '#d1d5db' : '#374151' }}>{biz.rating}</span>
        </div>
        <p className="text-[10px]" style={{ color: dm ? '#8e8e93' : '#8e8e93' }}>{biz.reviews} review{biz.reviews !== 1 ? 's' : ''}</p>
      </div>
    </button>
  );
}


function ScrollSection({ title, subtitle, href, businesses, onBizClick, dm, isLoading }: {
  title: string; subtitle: string; href: string;
  businesses: Business[]; onBizClick: (b: Business) => void; dm?: boolean; isLoading?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });

  // Reset scroll to start when businesses list changes (category filter)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [businesses]);

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
    <section className="py-4" style={{ background: dm ? '#0a0a0a' : '#F4EFE6' }}>
      <div className="flex items-center justify-between mb-4" style={{ paddingLeft: edgePad, paddingRight: edgePad }}>
        <div className="flex items-baseline gap-3">
          <h2 className="text-[1.2rem] font-black" style={{ letterSpacing: '-0.025em', color: dm ? '#f3f4f6' : '#171717' }}>{title}</h2>
          <span className="text-[11px] text-neutral-400 font-medium hidden sm:block">{subtitle}</span>
        </div>
        <Link href={href} scroll={false}
          className="text-[11px] font-black uppercase tracking-widest hover:opacity-70 transition-opacity shrink-0" style={{ color: '#0F766E' }}>
          See all →
        </Link>
      </div>

      {/* Scroll container — full width, cards start at edgePad */}
      <div className="relative">
        {/* Left curtain — solid cover + very subtle 20px feather */}
        <div className="absolute left-0 top-0 bottom-0 z-10 pointer-events-auto"
          style={{ width: edgePad, background: dm ? '#0a0a0a' : '#F4EFE6' }} />
        {/* Right curtain */}
        <div className="absolute right-0 top-0 bottom-0 z-10 pointer-events-auto"
          style={{ width: edgePad, background: dm ? '#0a0a0a' : '#F4EFE6' }} />

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
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            : businesses.map((biz, i) => (
                <BizCard key={biz.id} biz={biz} onClick={() => onBizClick(biz)} dm={dm} index={i} />
              ))
          }
          {/* See more — same total height as BizCard (image + body) */}
          <Link href={href} scroll={false}
            className="flex-shrink-0 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-accent/20 hover:border-accent/40 bg-white hover:bg-accent-wash transition-all group"
            style={{
              width: 'clamp(160px, 13vw, 200px)',
              height: 'calc(clamp(185px, 15vw, 240px) + 68px)',
              marginBottom: '8px',
              background: dm ? '#171717' : 'white',
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
  const [copiedLink, setCopiedLink] = useState(false);

  async function copyProviderSignupLink() {
    const signupUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://usescheduleme.com'}/business`;
    try {
      await navigator.clipboard.writeText(signupUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      // ignore clipboard failures silently
    }
  }

  if (sent) return (
    <div className="rounded-2xl border border-green-100 bg-green-50 px-5 py-4 text-center" style={{ marginLeft: 'max(24px, calc((100vw - 1400px) / 2))', marginRight: 'max(24px, calc((100vw - 1400px) / 2))' }}>
      <p className="text-sm font-semibold text-green-800">Referral received — we'll reach out to {bizName}.</p>
    </div>
  );
  if (!open) return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 flex items-center gap-3.5" style={{ marginLeft: 'max(24px, calc((100vw - 1400px) / 2))', marginRight: 'max(24px, calc((100vw - 1400px) / 2))' }}>
      <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-800 leading-tight">Know a skilled student?</p>
        <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">Refer someone trusted and we will invite them to your campus marketplace.</p>
      </div>
      <button onClick={() => setOpen(true)}
        className="shrink-0 text-xs font-bold text-accent bg-accent-light border border-accent/20 px-4 py-2 rounded-xl hover:brightness-95 transition-colors uppercase tracking-wide">
        Refer
      </button>
    </div>
  );
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 space-y-3" style={{ marginLeft: 'max(24px, calc((100vw - 1400px) / 2))', marginRight: 'max(24px, calc((100vw - 1400px) / 2))' }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-neutral-900">Who should we reach out to?</p>
        <button onClick={() => setOpen(false)} className="text-xs text-neutral-400 hover:text-neutral-600">Cancel</button>
      </div>
      <input type="text" value={bizName} onChange={e => setBizName(e.target.value)}
        placeholder="Their name or business name"
        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent" />
      <button
        type="button"
        onClick={copyProviderSignupLink}
        className="w-full py-2.5 rounded-xl text-sm font-semibold border border-accent/25 text-accent bg-accent-light hover:brightness-95 transition-colors"
      >
        {copiedLink ? 'Signup link copied' : 'Copy provider signup link'}
      </button>
      <button disabled={!bizName.trim()} onClick={() => { if (bizName.trim()) setSent(true); }}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${bizName.trim() ? 'bg-accent text-white' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'}`}>
        Submit referral
      </button>
    </div>
  );
}

const HomePage: NextPage = () => {
  const router = useRouter();
  const { dm } = useDm();
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeBiz, setActiveBiz] = useState<Business | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [realBizList, setRealBizList] = useState<Business[]>([]);
  const [usingRealData, setUsingRealData] = useState(false);
  const [dataLoading, setDataLoading] = useState(true); // true until real data or fallback loads
  const [eduVerified, setEduVerified] = useState<boolean | null>(null); // null = loading
  const [showEduBanner, setShowEduBanner] = useState(true);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showReferModal, setShowReferModal] = useState(false);
  const [referName, setReferName] = useState('');
  const [referSent, setReferSent] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const categoryCounts = realBizList.reduce((acc, biz) => {
    const key = (biz.category || '').trim();
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const categoryQuickLinks = [
    { label: 'All', d: ALL_CATEGORY_ICON },
    ...(Object.keys(categoryCounts).length > 0
      ? Object.keys(categoryCounts)
        .sort((a, b) => (categoryCounts[b] - categoryCounts[a]) || a.localeCompare(b))
        .map((label) => ({ label, d: iconForCategory(label) }))
      : QUICK_CATS),
  ];
  const openNowCount = realBizList.filter((biz) => biz.available).length;
  const topCategoryEntry = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
  const topCategoryName = topCategoryEntry?.[0] || 'Campus services';
  const showCampusPulse = eduVerified === true;

  async function tryFetchNearbyWithCoords(lat: number, lng: number) {
    const mod = await import('../lib/realBusinesses');
    const real = await mod.fetchNearbyBusinesses(lat, lng, { limit: 24, radius: 25 });
    if (real.length > 0) {
      setRealBizList(real);
      setUsingRealData(true);
      return true;
    }
    return false;
  }

  async function tryIpFallbackNearby() {
    const ipSources = ['https://ipapi.co/json/', 'https://ipwho.is/'];
    for (const src of ipSources) {
      try {
        const res = await fetch(src);
        const json = await res.json();
        const lat = Number(json.latitude ?? json.lat);
        const lng = Number(json.longitude ?? json.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const loaded = await tryFetchNearbyWithCoords(lat, lng);
        if (loaded) return true;
      } catch {
        // Try next IP provider.
      }
    }
    return false;
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = localStorage.getItem('sm_home_edu_banner_dismissed');
    if (dismissed === '1') setShowEduBanner(false);
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/signin'); return; }
      const name = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'there';
      setUserName(name.split(' ')[0]);
      setLoading(false);
      // Check edu verification status
      const supabaseInst = getSupabase();
      const { data: profile } = await supabaseInst
        .from('profiles').select('edu_verified').eq('id', session.user.id).maybeSingle();
      const verified = profile?.edu_verified ?? false;
      setEduVerified(verified);
      if (verified) {
        setShowEduBanner(false);
      } else if (typeof window !== 'undefined' && localStorage.getItem('sm_home_edu_banner_dismissed') !== '1') {
        setShowEduBanner(true);
      }
      // Show install banner on mobile if not already installed and not dismissed
      const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
      const isAndroid = /android/.test(navigator.userAgent.toLowerCase());
      const isMobile = isIOS || isAndroid;
      if (isIOS) setIsIOSDevice(true);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
      const dismissed = localStorage.getItem('sm_install_dismissed');
      if (isMobile && !isStandalone && !dismissed) {
        setShowInstallBanner(true);
      }
      let loaded = false;
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              loaded = await tryFetchNearbyWithCoords(pos.coords.latitude, pos.coords.longitude);
              resolve();
            },
            () => resolve(),
            { timeout: 8000, maximumAge: 300000 }
          );
        });
      }

      // Fall back to IP-approximate location when geolocation is denied/unavailable.
      if (!loaded) loaded = await tryIpFallbackNearby();
      if (!loaded) setRealBizList([]);
      setDataLoading(false);
    });
  }, [router]);

  if (loading) return (
    <>
      <Head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" /><title>Home — ScheduleMe</title></Head>
      <Nav />
      <div className="min-h-screen pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-0 page-fade-in" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))', background: dm ? '#0a0a0a' : '#F4EFE6' }}>
        <div className="border-b py-8" style={{ background: dm ? '#111' : '#0F766E' }}>
          <div className="max-w-3xl mx-auto px-6"><div className="h-12 rounded-2xl shimmer" /></div>
        </div>
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </>
  );

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <title>Home — ScheduleMe</title></Head>
      <Nav />
      <div className="min-h-screen pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-0" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))', background: 'var(--page-bg, #F4EFE6)' }} data-page-bg="true">

        <div className="border-b" style={{
          background: 'linear-gradient(145deg,#0F766E 0%, #156F68 100%)',
          borderColor: 'rgba(0,0,0,0.08)'
        }}>
          <div className="relative mx-auto max-w-4xl px-4 sm:px-6 pt-9 pb-9">
            <div className="flex items-center gap-10">
              {/* Search — constrained width */}
              <div className="flex-1 min-w-0 max-w-lg">
                <AISearchBar userName={userName} onSubmit={q => router.push(`/browse?q=${encodeURIComponent(q)}`)} />
              </div>
              {/* 4 utility nav tiles — right side, desktop only */}
              <div className="hidden lg:grid grid-cols-2 grid-rows-2 gap-2.5 w-[260px] shrink-0">
                {([
                  { label: 'My Bookings', sub: 'Track your jobs', href: '/bookings', d: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5' },
                  { label: 'Browse Services', sub: 'See all services', href: '/browse', d: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z' },
                  { label: 'How It Works', sub: 'Pricing & info', href: '/pricing', d: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z' },
                  { label: 'Refer a Pro', sub: 'Know someone good?', href: '#refer', isModal: true, d: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
                ] as const).map((tile) => tile.label === 'Refer a Pro' ? (
                  <button key={tile.label} onClick={() => setShowReferModal(true)}
                    className="flex flex-col justify-between rounded-2xl px-3.5 py-3.5 transition-all hover:scale-[1.02] hover:shadow-md text-left"
                    style={{ background: dm ? '#111111' : 'white', border: dm ? '1px solid #2a2d3a' : '1px solid #e5e5e5', aspectRatio: '1', boxShadow: dm ? 'none' : '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center mb-2" style={{ background: 'rgba(15,118,110,0.10)' }}>
                      <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={tile.d} />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[12px] font-black leading-snug" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{tile.label}</p>
                      <p className="text-[10px] mt-0.5 font-medium" style={{ color: dm ? 'rgba(255,255,255,0.45)' : '#0F766E' }}>{tile.sub}</p>
                    </div>
                  </button>
                ) : (
                  <Link key={tile.label} href={tile.href} scroll={false}
                    className="flex flex-col justify-between rounded-2xl px-3.5 py-3.5 transition-all hover:scale-[1.02] hover:shadow-md"
                    style={{ background: dm ? '#111111' : 'white', border: dm ? '1px solid #2a2d3a' : '1px solid #e5e5e5', aspectRatio: '1', boxShadow: dm ? 'none' : '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center mb-2" style={{ background: 'rgba(15,118,110,0.10)' }}>
                      <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={tile.d} />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[12px] font-black leading-snug" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{tile.label}</p>
                      <p className="text-[10px] mt-0.5 font-medium" style={{ color: dm ? 'rgba(255,255,255,0.45)' : '#0F766E' }}>{tile.sub}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Category quick-links */}
        <div className="border-b" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(0,0,0,0.06)' }}>
          <div className="flex gap-1.5 overflow-x-auto px-6 py-3" style={{ scrollbarWidth: 'none', justifyContent: 'safe center' }}>
            {categoryQuickLinks.map(cat => (
              <button key={cat.label} onClick={() => setActiveCategory(cat.label)}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all group border"
                style={activeCategory === cat.label
                  ? { background: '#0F766E', borderColor: '#0F766E' }
                  : { background: dm ? 'rgba(15,118,110,0.2)' : '#F4EFE6', borderColor: dm ? 'rgba(15,118,110,0.4)' : 'rgba(15,118,110,0.15)' }}>
                <svg className="h-4 w-4 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: activeCategory === cat.label ? 'white' : (dm ? '#e5e7eb' : '#0F766E') }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={cat.d} />
                </svg>
                <span className="text-[12px] font-semibold whitespace-nowrap transition-colors" style={{ color: activeCategory === cat.label ? 'white' : (dm ? '#e5e7eb' : '#0F766E') }}>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {showCampusPulse && (
          <div className="md:hidden px-4 pt-4">
            <div className="rounded-2xl p-3.5 border" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(15,118,110,0.15)' }}>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[12px] font-black uppercase tracking-[0.12em]" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>Campus Pulse</p>
                <p className="text-[11px] font-semibold" style={{ color: dm ? '#6b7280' : '#9ca3af' }}>Updated daily</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border p-2.5" style={{ background: dm ? '#111111' : '#F4EFE6', borderColor: dm ? '#262626' : 'rgba(15,118,110,0.14)' }}>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: '#0F766E' }}>Trending On Campus</p>
                  <p className="text-sm font-bold mt-1 line-clamp-1" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{topCategoryName}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>{topCategoryEntry?.[1] || 0} active providers</p>
                </div>
                <div className="rounded-xl border p-2.5" style={{ background: dm ? '#111111' : '#F4EFE6', borderColor: dm ? '#262626' : 'rgba(15,118,110,0.14)' }}>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: '#0F766E' }}>Open Now</p>
                  <p className="text-sm font-bold mt-1" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{openNowCount} available</p>
                  <p className="text-[11px] mt-0.5" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>Live provider status</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EDU Campus banner — only shown to non-verified users */}
        {eduVerified === false && showEduBanner && (
          <div style={{ paddingLeft: 'max(24px, calc((100vw - 1400px) / 2))', paddingRight: 'max(24px, calc((100vw - 1400px) / 2))', paddingTop: 24 }}>
            <div
              className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl"
              style={{
                background: dm ? 'linear-gradient(135deg, rgba(6,35,32,0.96) 0%, rgba(11,66,60,0.84) 100%)' : '#EFF8F4',
                border: dm ? '1px solid rgba(110,231,183,0.24)' : '1px solid rgba(15,118,110,0.2)',
                boxShadow: dm ? 'none' : '0 6px 18px rgba(15,118,110,0.08)',
              }}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div
                  className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center"
                  style={{ background: dm ? 'rgba(110,231,183,0.12)' : 'rgba(15,118,110,0.12)', color: '#0F766E' }}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0A50.57 50.57 0 0012 13.489a50.702 50.702 0 017.74-3.342m-15.48 0L12 3.493l7.74 6.654" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-black leading-tight" style={{ color: dm ? '#f3f4f6' : '#111827' }}>Are you a student?</p>
                  <p className="text-[12px] leading-snug mt-0.5" style={{ color: dm ? '#d1d5db' : '#374151' }}>
                    Verify your .edu email to unlock your campus marketplace.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 shrink-0">
                <Link href="/campus" scroll={false}
                  className="text-xs font-bold px-3.5 py-2 rounded-xl whitespace-nowrap transition-all hover:opacity-80"
                  style={{ background: '#0F766E', color: 'white' }}>
                  Sign up
                </Link>
                <button
                  onClick={() => {
                    setShowEduBanner(false);
                    if (typeof window !== 'undefined') localStorage.setItem('sm_home_edu_banner_dismissed', '1');
                  }}
                  className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full"
                  style={{ background: dm ? '#2c2c2e' : '#e5e7eb' }}
                >
                  <svg className="h-3.5 w-3.5" style={{ color: dm ? '#8e8e93' : '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Install app banner — mobile only, not shown if already installed */}
        {showInstallBanner && (
          <div style={{ paddingLeft: 'max(24px, calc((100vw - 1400px) / 2))', paddingRight: 'max(24px, calc((100vw - 1400px) / 2))', paddingTop: eduVerified === false ? 8 : 12 }}>
            <div className="rounded-2xl overflow-hidden"
              style={{ background: dm ? '#171717' : 'white', border: dm ? '1px solid #262626' : '1px solid rgba(0,0,0,0.08)', boxShadow: dm ? 'none' : '0 2px 12px rgba(0,0,0,0.06)' }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#0F766E' }}>
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-black" style={{ color: dm ? '#f3f4f6' : '#171717', letterSpacing: '-0.01em' }}>Add to Home Screen</p>
                    <p className="text-xs" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>Get the full app experience</p>
                  </div>
                </div>
                <button onClick={() => { setShowInstallBanner(false); localStorage.setItem('sm_install_dismissed', '1'); }}
                  className="h-7 w-7 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: dm ? '#262626' : '#f5f5f5', color: dm ? '#9ca3af' : '#a3a3a3' }}>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Steps */}
              <div className="px-4 pb-4 space-y-2.5">
                {[
                  { step: '1', icon: 'share', text: isIOSDevice ? 'Tap the Share icon in your browser (box with arrow pointing up)' : 'Tap the menu icon in your browser (three dots ⋮ or ⋯)' },
                  { step: '2', icon: 'plus', text: 'Scroll down and tap "Add to Home Screen"' },
                  { step: '3', icon: 'check', text: 'Tap "Add" — ScheduleMe appears on your home screen' },
                ].map(({ step, icon, text }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(15,118,110,0.12)' }}>
                      <span className="text-[11px] font-black text-accent">{step}</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: dm ? '#d1d5db' : '#525252' }}>{text}</p>
                  </div>
                ))}
                {/* Visual hint arrow pointing down toward browser UI */}
                <div className="flex items-center gap-2 pt-1">
                  <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  </svg>
                  <p className="text-[11px] font-semibold text-accent">{isIOSDevice ? 'The share icon looks like a box with an arrow pointing up' : 'Usually in the top-right corner of your browser'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable business rows */}
        <div className="py-5 space-y-6" style={{ background: dm ? '#0a0a0a' : '#F4EFE6' }}>
          {(() => {
            const pool = realBizList.length > 0 ? realBizList : [];
            const filtered = activeCategory === 'All' ? pool : pool.filter(b => b.category === activeCategory);
            const sortedByRating = [...filtered].sort((a, b) => ((b.rating || 0) - (a.rating || 0)) || ((b.reviews || 0) - (a.reviews || 0)));
            const sortedByReviews = [...filtered].sort((a, b) => (b.reviews - a.reviews) || ((b.rating || 0) - (a.rating || 0)));
            const ratedOnly = sortedByRating.filter((b) => (b.rating || 0) > 0 && (b.reviews || 0) > 0);
            const nonStudentOnly = sortedByReviews.filter((b) => b.campus_provider !== true);

            const takeMax = (arr: Business[], n: number) => arr.slice(0, n);

            const topRated = takeMax(ratedOnly, 6);
            const nonStudentProviders = takeMax(nonStudentOnly, 6);
            const quickResponse = takeMax(sortedByReviews, 6);
            return (
              <>
                <ScrollSection
                  key={`quick-${activeCategory}`}
                  title="Quick response"
                  subtitle="Pros that pick up jobs fast"
                  href="/browse"
                  businesses={quickResponse}
                  onBizClick={(biz) => { if (biz.preview_locked) return; window.location.href = '/biz/' + (biz.slug || biz.realId || biz.id); }}
                  dm={dm}
                  isLoading={dataLoading}
                />
                <ScrollSection
                  key={`top-${activeCategory}-${dataLoading}`}
                  title="Top-rated near you"
                  subtitle="Available now — highly reviewed"
                  href="/browse"
                  businesses={topRated}
                  onBizClick={(biz) => { if (biz.preview_locked) return; window.location.href = '/biz/' + (biz.slug || biz.realId || biz.id); }}
                  dm={dm}
                  isLoading={dataLoading}
                />
                <ScrollSection
                  key={`indie-${activeCategory}`}
                  title="Non-student providers"
                  subtitle="Local businesses in your area"
                  href="/browse"
                  businesses={nonStudentProviders}
                  onBizClick={(biz) => { if (biz.preview_locked) return; window.location.href = '/biz/' + (biz.slug || biz.realId || biz.id); }}
                  dm={dm}
                  isLoading={dataLoading}
                />
              </>
            );
          })()}
          <ReferCard />
        </div>

      </div>
      {showReferModal && (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setShowReferModal(false)}>
    <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl" style={{ background: dm ? '#1c1c1e' : 'white' }} onClick={e => e.stopPropagation()}>
      {referSent ? (
        <div className="text-center py-4">
          <div className="text-4xl mb-3">🎉</div>
          <p className="font-bold text-lg mb-1" style={{ color: dm ? '#f2f2f7' : '#111' }}>Referral received!</p>
          <p className="text-sm mb-6" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>We'll reach out to {referName} and let you know if they join.</p>
          <button onClick={() => { setShowReferModal(false); setReferSent(false); setReferName(''); }} className="w-full py-3 rounded-2xl font-bold text-white" style={{ background: '#0F766E' }}>Done</button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold" style={{ color: dm ? '#f2f2f7' : '#111', letterSpacing: '-0.02em' }}>Refer a Pro</h3>
              <p className="text-sm mt-0.5" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>Know a skilled student provider? Tell us.</p>
            </div>
            <button onClick={() => setShowReferModal(false)} className="h-8 w-8 flex items-center justify-center rounded-full" style={{ background: dm ? '#2c2c2e' : '#f5f5f5' }}>
              <svg className="h-4 w-4" style={{ color: dm ? '#8e8e93' : '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <input type="text" value={referName} onChange={e => setReferName(e.target.value)} placeholder="Business or person's name" className="w-full px-4 py-3 rounded-2xl text-sm outline-none mb-4" style={{ background: dm ? '#2c2c2e' : '#f5f5f5', color: dm ? '#f2f2f7' : '#111', border: dm ? '1.5px solid #3a3a3c' : '1.5px solid #e5e7eb' }} />
          <button disabled={!referName.trim()} onClick={() => { if (referName.trim()) setReferSent(true); }} className="w-full py-3.5 rounded-2xl font-bold text-sm" style={{ background: referName.trim() ? '#0F766E' : (dm ? '#2c2c2e' : '#e5e7eb'), color: referName.trim() ? 'white' : (dm ? '#6b7280' : '#9ca3af') }}>Submit Referral</button>
        </>
      )}
    </div>
  </div>
)}
{activeBiz && <BusinessProfile biz={activeBiz} onClose={() => setActiveBiz(null)} />}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
      {/* Floating feedback button */}
      <button onClick={() => setShowFeedback(true)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+96px)] md:bottom-6 right-4 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
        style={{ background: '#0F766E', color: 'white' }}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
        <span className="text-sm font-bold">Feedback</span>
      </button>
    </>
  );
};

export default HomePage;
