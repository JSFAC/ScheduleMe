// @ts-nocheck
// pages/home.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';
import Nav from '../components/Nav';
import { useDm } from '../lib/DarkModeContext';
import type { Business } from '../lib/mockBusinesses';
import { SkeletonScrollRow, SkeletonCard } from '../components/SkeletonCard';
import FeedbackModal from '../components/FeedbackModal';
import { fetchAllBusinesses } from '../lib/realBusinesses';
import { maybeSendWelcomeEmail } from '../lib/sendWelcome';
import { shouldShowNewBadge } from '../lib/newBadge';

const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

function getSupabase() {
  return getSupabaseClient();
}
function timeOfDay() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

function getOpenStatus(hours: { day: string; time: string }[], availability?: string | null, breakUntil?: string | null): { open: boolean; label: string } {
  if (availability === 'break') {
    if (breakUntil) {
      const dt = new Date(breakUntil);
      if (!Number.isNaN(dt.getTime())) {
        if (dt.getTime() > Date.now()) {
          const start = new Date();
          const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const endLabel = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return { open: false, label: `On break ${startLabel}–${endLabel}` };
        }
      }
    }
    return { open: false, label: 'On break' };
  }
  if (availability === 'closed') return { open: false, label: 'Closed' };
  if (availability === 'busy') return { open: true, label: 'Busy' };

  if (!hours || hours.length === 0) return { open: true, label: 'Open' };
  const now = new Date();
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayIdx = now.getDay();
  const todayName = dayNames[todayIdx];
  const tomorrowName = dayNames[(todayIdx + 1) % 7];
  function parseTime(t: string): number | null {
    const m = t.trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!m) return null;
    let h = parseInt(m[1]); const min = parseInt(m[2]); const ampm = m[3].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }
  function dayMatches(pattern: string, dayName: string): boolean {
    if (pattern.includes('–') || pattern.includes('-')) {
      const allDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      const abbrevMap: Record<string, string> = { Mon:'Monday',Tue:'Tuesday',Wed:'Wednesday',Thu:'Thursday',Fri:'Friday',Sat:'Saturday',Sun:'Sunday' };
      const sep = pattern.includes('–') ? '–' : '-';
      const parts = pattern.split(sep).map(p => p.trim());
      const start = abbrevMap[parts[0]] || parts[0];
      const end = abbrevMap[parts[1]] || parts[1];
      const si = allDays.indexOf(start), ei = allDays.indexOf(end), di = allDays.indexOf(dayName);
      if (si < 0 || ei < 0 || di < 0) return false;
      return si <= ei ? (di >= si && di <= ei) : (di >= si || di <= ei);
    }
    return pattern.includes(dayName) || pattern.includes(dayName.slice(0, 3));
  }
  const nowMins = now.getHours() * 60 + now.getMinutes();
  for (const h of hours) {
    if (h.time.toLowerCase() === 'by appointment') { if (dayMatches(h.day, todayName)) return { open: true, label: 'By appt' }; continue; }
    if (h.time.toLowerCase().includes('closed')) { if (dayMatches(h.day, todayName)) return { open: false, label: 'Closed today' }; continue; }
    const rangeParts = h.time.split('–').map(p => p.trim());
    if (rangeParts.length < 2) continue;
    const openM = parseTime(rangeParts[0]); const closeM = parseTime(rangeParts[1]);
    if (openM == null || closeM == null) continue;
    if (dayMatches(h.day, todayName)) {
      if (closeM < openM) {
        if (nowMins >= openM || nowMins <= closeM) return { open: true, label: 'Open now' };
      } else if (nowMins >= openM && nowMins <= closeM) return { open: true, label: 'Open now' };
      return { open: false, label: `Opens ${rangeParts[0]}` };
    }
    if (dayMatches(h.day, tomorrowName)) {
      return { open: false, label: `Opens ${rangeParts[0]} tomorrow` };
    }
  }
  return { open: true, label: 'Open' };
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function isPreviewLocked(biz: Business): boolean {
  return (biz as any)?.preview_locked === true;
}

function displayNameForCard(biz: Business): string {
  return isPreviewLocked(biz) ? 'Student provider' : (biz.name || 'Provider');
}

function RatingStars({ rating, size = 12 }: { rating: number; size?: number }) {
  const safe = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <div className="flex items-center gap-0.5" aria-label={`${safe.toFixed(1)} stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, safe - i));
        return (
          <div key={i} className="relative" style={{ width: size, height: size }}>
            <svg className="absolute inset-0" width={size} height={size} viewBox="0 0 20 20" fill="#d1d5db">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <svg width={size} height={size} viewBox="0 0 20 20" fill="#facc15">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const MATCH_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'with', 'my', 'your', 'our', 'need', 'needs',
  'looking', 'look', 'find', 'someone', 'anyone', 'help', 'please', 'asap', 'soon', 'today', 'tomorrow', 'this',
  'that', 'it', 'is', 'are', 'be', 'do', 'does', 'done', 'fix', 'repair', 'service', 'services'
]);

const KEYWORD_EXPANSIONS: Record<string, string[]> = {
  plumbing: ['plumber', 'pipe', 'leak', 'leaking', 'drain', 'toilet', 'faucet', 'water', 'heater'],
  electrical: ['electric', 'electrician', 'breaker', 'outlet', 'wiring', 'light', 'lighting'],
  cleaning: ['clean', 'cleaner', 'deep', 'maid', 'housekeeping'],
  hvac: ['ac', 'air', 'conditioning', 'furnace', 'heater', 'heating'],
  painting: ['paint', 'repaint', 'wall', 'walls', 'primer'],
  handyman: ['handyman', 'repair', 'install', 'mount', 'assemble'],
  moving: ['move', 'moving'],
  landscaping: ['yard', 'lawn', 'grass', 'garden', 'weeds', 'mulch'],
  printing: ['print', 'printed', 'printing', '3d', 'model', 'prototype'],
};

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2 && !MATCH_STOPWORDS.has(w));
}

function expandKeywords(tokens: string[]): string[] {
  const expanded = new Set(tokens);
  for (const [cat, keys] of Object.entries(KEYWORD_EXPANSIONS)) {
    if (tokens.includes(cat) || keys.some(k => tokens.includes(k))) {
      expanded.add(cat);
      keys.forEach(k => expanded.add(k));
    }
  }
  return Array.from(expanded);
}

function matchBusinesses(query: string, pool: Business[]): Business[] {
  const baseTokens = tokenizeQuery(query);
  const tokens = expandKeywords(baseTokens);
  if (tokens.length === 0) return [];
  const scored = pool.map(biz => {
    const name = (biz.name || '').toLowerCase();
    const category = (biz.category || '').toLowerCase();
    const tagline = (biz.tagline || '').toLowerCase();
    const description = (biz.description || '').toLowerCase();
    const services = (biz.services || []).map(s => s.name).join(' ').toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (name.includes(t)) score += 3;
      if (category.includes(t)) score += 4;
      if (services.includes(t)) score += 2;
      if (tagline.includes(t) || description.includes(t)) score += 1;
    }
    return { biz, score };
  }).filter(r => r.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 6).map(r => r.biz);
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

function toTitleCase(value: string): string {
  return String(value || '')
    .split(/[\s_/-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function buildCampusPulse(list: Business[]) {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const safeList = Array.isArray(list) ? list : [];

  const categoryCounts = new Map<string, number>();
  for (const biz of safeList) {
    const cat = toTitleCase((biz as any)?.category || '');
    if (!cat) continue;
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }
  const topCategories = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]);
  const trendingPrimary = topCategories[0]?.[0] || 'No trend yet';
  const trendingSecondary = topCategories[1]?.[0] || '';
  const trendingValue = trendingSecondary ? `${trendingPrimary} + ${trendingSecondary}` : trendingPrimary;
  const trendingSub = topCategories[0] ? `${topCategories[0][1]} nearby listings` : 'Collecting activity';

  const rated = safeList.filter((b: any) => typeof b?.rating === 'number' && (b?.reviews || 0) > 0);
  const avgRating = rated.length > 0
    ? rated.reduce((sum: number, b: any) => sum + Number(b.rating || 0), 0) / rated.length
    : null;
  const avgRatingValue = avgRating != null ? `${avgRating.toFixed(1)}★ nearby` : 'No ratings yet';
  const avgRatingSub = rated.length > 0 ? `${rated.length} rated providers` : 'Waiting for reviews';

  const newProsThisWeek = safeList.filter((b: any) => {
    const created = b?.created_at ? new Date(b.created_at).getTime() : NaN;
    return Number.isFinite(created) && created >= weekAgo;
  }).length;
  const newProsValue = `${newProsThisWeek} this week`;
  const newProsSub = newProsThisWeek > 0 ? 'Newly joined providers' : 'No new providers yet';

  return [
    { title: 'Trending on campus', value: trendingValue, sub: trendingSub },
    { title: 'Avg rating nearby', value: avgRatingValue, sub: avgRatingSub },
    { title: 'New pros nearby', value: newProsValue, sub: newProsSub },
  ];
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
      <p className="text-[10px] font-black uppercase tracking-[0.14em] mb-3"
        style={{ color: dm ? 'rgba(255,255,255,0.7)' : '#0f0f0f' }}>
        Good {timeOfDay()}, {userName}
      </p>
      <h1 className="text-[2.6rem] font-black mb-5"
          style={{ color: dm ? 'white' : '#0f0f0f', letterSpacing: '-0.03em', lineHeight: 1.08 }}>
        What do you need<br />done today?
      </h1>

      <div className={`relative rounded-2xl border transition-all duration-200 ${focused ? 'border-accent shadow-[0_0_0_4px_rgba(0,126,109,0.12),0_10px_28px_rgba(0,0,0,0.10)]' : 'shadow-[0_6px_18px_rgba(0,0,0,0.08)]'}`}
        style={{ background: dm ? '#111111' : 'white', borderColor: focused ? undefined : (dm ? '#262626' : '#e5e5e5') }}>
        <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b" style={{ borderColor: dm ? '#262626' : '#f5f5f5' }}>
          <svg className="h-3.5 w-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <span className="text-[10px] font-black text-accent uppercase tracking-[0.14em]">Quick Match</span>
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
                ? 'bg-accent text-white shadow-[0_2px_10px_rgba(10,132,255,0.3)] hover:bg-accent-dark'
                : 'bg-neutral-100 text-neutral-400'
            }`}>
            {thinking
              ? <div className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              : <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
            }
            Get Matches
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
              style={{ background: dm ? 'rgb(17,17,17)' : 'rgba(255,255,255,0.88)', color: dm ? 'rgb(213, 225, 222)' : '#007e6d', border: dm ? '1px solid rgb(38,38,38)' : '1px solid rgba(255,255,255,0.95)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = dm ? 'rgb(17,17,17)' : 'rgba(255,255,255,0.88)'; }}>
              {label}
            </button>
          ))}
          <span className="shrink-0 w-4 block" />
        </div>
      </div>
    </div>
  );
}

// Card — matches Browse grid style
function BizCard({ biz, onClick, dm, index = 0, pinned, onTogglePin }: { biz: Business; onClick: () => void; dm?: boolean; index?: number; pinned?: boolean; onTogglePin?: (id: string) => void }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const cardBg = dm ? '#1c1c1e' : 'white';
  const locked = isPreviewLocked(biz);
  const status = getOpenStatus(biz.hours, (biz as any).availability_status, (biz as any).break_until);
  const cardLabel = biz.category || 'Provider';
  const cardName = displayNameForCard(biz);
  return (
    <button onClick={onClick} disabled={locked} className="biz-card group text-left flex-shrink-0 animate-fade-up flex flex-col disabled:cursor-not-allowed"
      style={{ width: 'clamp(180px, 22vw, 240px)', animationDelay: `${index * 0.06}s`, borderRadius: 18, overflow: 'hidden', background: cardBg, boxShadow: dm ? '0 0 0 1px #2c2c2e' : '0 2px 12px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)' }}>
      <div className="relative flex-shrink-0 w-full overflow-hidden" style={{ aspectRatio: '4/3', background: dm ? '#2c2c2e' : '#e5e7eb' }}>
        {biz.coverUrl && biz.coverUrl !== TRANSPARENT_PIXEL ? (
          <img src={biz.coverUrl} alt={cardLabel}
            onLoad={() => setImgLoaded(true)}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            style={{ objectPosition: 'center 25%', opacity: imgLoaded ? 1 : 0, filter: locked ? 'blur(14px) saturate(0.85)' : 'none' }} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ background: dm ? '#242426' : '#e5e7eb' }}>
            <span className="text-lg font-bold" style={{ color: dm ? '#d1d5db' : '#6b7280' }}>{initials(cardName || cardLabel)}</span>
            <span className="text-[11px] font-semibold" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>No photos yet</span>
          </div>
        )}
        {!locked && (
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePin?.(biz.id); }}
            className="absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center"
            style={{ background: pinned ? 'rgba(16,185,129,0.18)' : (dm ? 'rgba(255,255,255,0.08)' : '#f3f4f6'), border: '1px solid ' + (pinned ? 'rgba(16,185,129,0.45)' : (dm ? 'rgba(255,255,255,0.12)' : '#e5e7eb')) }}
            aria-label={pinned ? 'Unpin' : 'Pin'}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke={pinned ? '#10b981' : (dm ? '#9ca3af' : '#6b7280')} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 4l6 6-3 3 1 4-4-1-3 3-6-6 3-3-1-4 4 1 3-3z" />
              <path d="M9 15l-5 5" />
            </svg>
          </button>
        )}
        {locked && (
          <div className="absolute inset-x-0 bottom-0 px-2 pb-2">
            <div className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ background: 'rgba(0,0,0,0.58)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
              Private until student verification
            </div>
          </div>
        )}
        {(biz as any).founder50 && !['paused','revoked'].includes(String((biz as any).founder50_status || '')) && (
          <div
            className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{
              background: 'rgba(0,0,0,0.6)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.18)',
              backdropFilter: 'blur(6px)',
            }}
          >
            Founder50
          </div>
        )}
      </div>
      <div className="px-3 py-2.5 flex flex-col gap-1" style={{ background: cardBg }}>
        {cardName && (
          <p className="text-sm font-semibold leading-tight line-clamp-1" style={{ color: dm ? '#f3f4f6' : '#111827' }}>
            {cardName}
          </p>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(0,126,109,0.2)' : 'rgba(0,126,109,0.12)', color: '#007e6d' }}>{biz.category}</span>
          {biz.price_tier ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(0,126,109,0.2)' : 'rgba(0,126,109,0.12)', color: '#007e6d' }}>{'$'.repeat(biz.price_tier)}</span> : null}
          {shouldShowNewBadge({ createdAt: (biz as any).created_at, reviewCount: biz.reviews }) && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(251,191,36,0.18)' : '#fef3c7', color: dm ? '#f59e0b' : '#92400e' }}>New</span>
          )}
          {!locked ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: status.open ? (dm ? 'rgba(52,211,153,0.15)' : '#f0fdf4') : (dm ? 'rgba(255,255,255,0.07)' : '#f5f5f5'), color: status.open ? '#16a34a' : (dm ? '#6b7280' : '#9ca3af') }}>
              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${status.open ? 'bg-emerald-500' : 'bg-neutral-400'}`} />{status.label}
            </span>
          ) : (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: dm ? '#9ca3af' : '#6b7280' }}>Locked</span>
          )}
        </div>
        <p className="text-[11px]" style={{ color: dm ? '#8e8e93' : '#8e8e93' }}>{locked ? 'Visible to verified students' : biz.distance}</p>
          {!locked && (biz.reviews ?? 0) > 0 && biz.rating != null && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <RatingStars rating={Number(biz.rating)} size={12} />
              <span className="text-[12px] font-bold" style={{ color: dm ? '#d1d5db' : '#374151' }}>{biz.rating}</span>
              <span className="text-[11px]" style={{ color: dm ? '#6b7280' : '#9ca3af' }}>({biz.reviews})</span>
            </div>
          )}
      </div>
    </button>
  );
}

function ScrollSection({
  title,
  subtitle,
  href,
  businesses,
  onBizClick,
  dm,
  isLoading,
  bg,
  pinnedIds,
  onTogglePin,
}: {
  title: string; subtitle: string; href: string;
  businesses: Business[]; onBizClick: (b: Business) => void; dm?: boolean; isLoading?: boolean;
  bg: string;
  pinnedIds: Set<string>;
  onTogglePin: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [businesses]);

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

  function scrollByAmount(dir: 'left' | 'right') {
    if (!scrollRef.current) return;
    const amount = Math.round(scrollRef.current.clientWidth * 0.9);
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  }

  const edgePad = 'max(24px, calc((100vw - 1400px) / 2))';

  return (
    <section>
      <div className="flex items-center justify-between mb-4" style={{ paddingLeft: edgePad, paddingRight: edgePad }}>
        <div className="flex items-baseline gap-3">
          <h2 className="text-[1.2rem] font-black" style={{ letterSpacing: '-0.025em', color: dm ? '#f3f4f6' : '#171717' }}>{title}</h2>
          <span className="text-[11px] text-neutral-400 font-medium hidden sm:block">{subtitle}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => scrollByAmount('left')}
            className="h-7 w-7 rounded-full border flex items-center justify-center transition-colors"
            style={{ background: dm ? '#111111' : 'white', borderColor: dm ? '#2a2d3a' : '#e5e7eb', color: dm ? '#d1d5db' : '#525252' }}
            aria-label="Scroll left"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={() => scrollByAmount('right')}
            className="h-7 w-7 rounded-full border flex items-center justify-center transition-colors"
            style={{ background: dm ? '#111111' : 'white', borderColor: dm ? '#2a2d3a' : '#e5e7eb', color: dm ? '#d1d5db' : '#525252' }}
            aria-label="Scroll right"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          <Link href={href} scroll={false}
            className="ml-1 text-[11px] font-black uppercase tracking-widest hover:opacity-70 transition-opacity shrink-0"
            style={{ color: '#007e6d' }}>
            See all →
          </Link>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 z-10 pointer-events-none"
          style={{ width: edgePad, background: bg }} />
        <div className="absolute right-0 top-0 bottom-0 z-10 pointer-events-none"
          style={{ width: edgePad, background: bg }} />

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
                <BizCard key={biz.id} biz={biz} onClick={() => onBizClick(biz)} dm={dm} index={i} pinned={pinnedIds.has(biz.id)} onTogglePin={onTogglePin} />
              ))
          }
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
    <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-5 flex flex-col card-elevated sm:flex-row items-start sm:items-center gap-4" style={{ marginLeft: 'max(24px, calc((100vw - 1400px) / 2))', marginRight: 'max(24px, calc((100vw - 1400px) / 2))' }}>
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

type WelcomePhase = 'welcome' | 'transitioning' | 'done';

const HOME_ONBOARDING_STEPS = [
  {
    icon: 'shield',
    headline: 'Book confidently on ScheduleMe',
    body: 'You now pay when you book. Funds are held securely and providers are paid after completion, with protection fee coverage and dispute support.',
    cta: 'Next',
  },
  {
    icon: 'campus',
    headline: 'Campus mode is built in',
    body: 'Student providers can stay private until .edu verification. Public providers remain visible, so Home and Browse always feel alive.',
    cta: 'Next',
  },
  {
    icon: 'flow',
    headline: 'Everything in one flow',
    body: 'Search, compare, review booking details, pay securely, chat, cancel with fast refunds, and track status updates in one place.',
    cta: 'Start using ScheduleMe',
  },
];

function HomeOnboarding({ userName, fading, onDone }: { userName: string; fading: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const s = HOME_ONBOARDING_STEPS[step];

  function next() {
    if (step < HOME_ONBOARDING_STEPS.length - 1) setStep(step + 1);
    else onDone();
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-6 transition-opacity duration-300"
      style={{ opacity: fading ? 0 : 1, background: '#070b0a' }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(70% 50% at 50% 70%, rgba(0,126,109,0.16) 0%, rgba(0,126,109,0) 100%)' }} />

      <div className="absolute top-9 left-0 right-0 flex items-center justify-between px-6">
        <div className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Welcome{userName ? `, ${userName}` : ''}
        </div>
        <button onClick={onDone} className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Skip
        </button>
      </div>

      <div className="max-w-md w-full text-center rounded-3xl border px-7 py-8" style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(15,20,19,0.9)' }}>
        <div className="flex justify-center gap-2 mb-6">
          {HOME_ONBOARDING_STEPS.map((_, i) => (
            <div key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === step ? 22 : 8, background: i === step ? '#007e6d' : 'rgba(255,255,255,0.25)' }} />
          ))}
        </div>

        <div className="mx-auto mb-5 h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,126,109,0.2)', border: '1px solid rgba(0,126,109,0.35)' }}>
          {s.icon === 'shield' && (
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="#54d3b9" strokeWidth={1.9}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7.5 3v5.25c0 4.56-3.12 8.76-7.5 9.75-4.38-.99-7.5-5.19-7.5-9.75V6L12 3z" />
            </svg>
          )}
          {s.icon === 'campus' && (
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="#54d3b9" strokeWidth={1.9}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.25L12 4l9 4.25L12 12.5 3 8.25zm3 2.5v4.75l6 3 6-3v-4.75" />
            </svg>
          )}
          {s.icon === 'flow' && (
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="#54d3b9" strokeWidth={1.9}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 7.5h7.5m0 0L9.75 5.25M12 7.5L9.75 9.75M19.5 16.5H12m0 0 2.25-2.25M12 16.5l2.25 2.25" />
            </svg>
          )}
        </div>

        <h1 className="text-2xl font-black text-white mb-3" style={{ letterSpacing: '-0.02em' }}>{s.headline}</h1>
        <p className="text-sm leading-relaxed mb-7" style={{ color: 'rgba(255,255,255,0.72)' }}>{s.body}</p>

        <button onClick={next} className="w-full py-3.5 rounded-2xl font-bold text-white transition-all active:scale-[0.99]" style={{ background: '#007e6d' }}>
          {s.cta}
        </button>
      </div>
    </div>
  );
}

const HomePage: NextPage = () => {
  const router = useRouter();
  const { dm } = useDm();
  const [userName, setUserName] = useState('');
  const [welcomePhase, setWelcomePhase] = useState<WelcomePhase>('done');
  const [welcomeName, setWelcomeName] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<string>('All');
  const [realBizList, setRealBizList] = useState<Business[]>([]);
  const dynamicCategories = realBizList.length > 0
    ? ['All', 'Pinned', ...Array.from(new Set(realBizList.map(b => b.category).filter(Boolean))).sort()]
    : ['All', 'Pinned'];
  const hasNearbyRef = useRef(false);
  const [usingRealData, setUsingRealData] = useState(false);
  function setNearbySafe(list: Business[]) {
    hasNearbyRef.current = list.length > 0;
    setRealBizList(list);
  }
  const [dataLoading, setDataLoading] = useState(true); // true until real data or fallback loads
  const [eduVerified, setEduVerified] = useState<boolean | null>(null); // null = loading
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showReferModal, setShowReferModal] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [referName, setReferName] = useState('');
  const [referSent, setReferSent] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [matchQuery, setMatchQuery] = useState('');
  const [matchResults, setMatchResults] = useState<Business[]>([]);
  const [matching, setMatching] = useState(false);
  const [matchRan, setMatchRan] = useState(false);
  const sectionBg = dm ? '#0a0a0a' : '#FCFAF6';
  const matchPool = realBizList.length > 0 ? realBizList : [];
  const matchKeywords = useMemo(() => expandKeywords(tokenizeQuery(matchQuery)), [matchQuery]);
  const campusPulse = useMemo(() => buildCampusPulse(realBizList), [realBizList]);

  function runMatch(q: string) {
    const trimmed = q.trim();
    if (!trimmed || matching) return;
    setMatchQuery(trimmed);
    setMatchRan(true);
    setMatching(true);
    const pool = matchPool;
    setTimeout(() => {
      setMatchResults(matchBusinesses(trimmed, pool));
      setMatching(false);
    }, 520);
  }

const COORDS_KEY = 'sm_last_coords';
const COORDS_MAX_AGE_MS = 1000 * 60 * 60 * 24;
function readCoords(): { lat: number; lng: number; ts: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.lat !== 'number' || typeof v?.lng !== 'number') return null;
    if (typeof v?.ts !== 'number') return null;
    if (Date.now() - v.ts > COORDS_MAX_AGE_MS) return null;
    return v;
  } catch { return null; }
}
function writeCoords(lat: number, lng: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(COORDS_KEY, JSON.stringify({ lat, lng, ts: Date.now() }));
}

async function loadPinned(userId: string) {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('favorites')
      .select('business_id')
      .eq('user_id', userId);
    const ids = new Set((data || []).map((r: any) => r.business_id));
    setPinnedIds(ids);
  } catch {}
}

async function togglePinned(bizId: string) {
  try {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/signin'); return; }
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('business_id', bizId)
      .maybeSingle();
    if (existing?.id) {
      await supabase.from('favorites').delete().eq('id', existing.id);
      setPinnedIds(prev => { const next = new Set(prev); next.delete(bizId); return next; });
    } else {
      await supabase.from('favorites').insert({ user_id: session.user.id, business_id: bizId });
      setPinnedIds(prev => new Set(prev).add(bizId));
    }
  } catch {}
}

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/signin'); return; }
      const fullName =
        String(session.user.user_metadata?.full_name || '').trim() ||
        `${String(session.user.user_metadata?.first_name || '').trim()} ${String(session.user.user_metadata?.last_name || '').trim()}`.trim() ||
        session.user.email?.split('@')[0] ||
        'there';
      const firstName = fullName.split(' ')[0];
      setUserName(firstName);
      setWelcomeName(firstName);
      setCurrentUserId(session.user.id);
      setLoading(false);
      await loadPinned(session.user.id);
      // Check edu verification status
      const supabaseInst = getSupabase();
      const { data: profile } = await supabaseInst
        .from('profiles').select('edu_verified, has_seen_welcome').eq('id', session.user.id).maybeSingle();
      const isEdu = profile?.edu_verified ?? false;
      setEduVerified(isEdu);

      const seenCacheKey = `sm_seen_welcome_${session.user.id}`;
      const emailCacheKey = `sm_welcome_email_sent_${session.user.id}`;
      const cachedSeen = typeof window !== 'undefined' && localStorage.getItem(seenCacheKey) === 'true';
      const cachedEmailSent = typeof window !== 'undefined' && localStorage.getItem(emailCacheKey) === 'true';
      const isFirstVisit = (!profile || profile.has_seen_welcome === false) && !cachedSeen;
      if (isFirstVisit) {
        setWelcomePhase('welcome');
        if (session.user.email && !cachedEmailSent) {
          maybeSendWelcomeEmail(session.user.email, fullName, session.user.id, session.access_token);
          if (typeof window !== 'undefined') localStorage.setItem(emailCacheKey, 'true');
        }
      } else {
        setWelcomePhase('done');
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
      // Geo-first loading: precise location first, then recent cache, then IP fallback.
      const mod = await import('../lib/realBusinesses');
      let loaded = false;

      const geolocate = () =>
        new Promise<{ lat: number; lng: number } | null>((resolve) => {
          if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { timeout: 15000, maximumAge: 0, enableHighAccuracy: true }
          );
        });

      const geo = await geolocate();
      if (geo) {
        writeCoords(geo.lat, geo.lng);
        const real = await mod.fetchNearbyBusinesses(geo.lat, geo.lng, { limit: 20, radius: 25 });
        if (real.length > 0) {
          setNearbySafe(real);
          setUsingRealData(true);
          loaded = true;
        }
      }

      if (!loaded) {
        const cached = readCoords();
        if (cached?.lat && cached?.lng) {
          const real = await mod.fetchNearbyBusinesses(cached.lat, cached.lng, { limit: 20, radius: 25 });
          if (real.length > 0) {
            setNearbySafe(real);
            setUsingRealData(true);
            loaded = true;
          }
        }
      }

      if (!loaded) {
        try {
          const _ipRes = await fetch('https://ipapi.co/json/');
          const _ipData = await _ipRes.json();
          if (_ipData.latitude && _ipData.longitude) {
            const _ipBiz = await mod.fetchNearbyBusinesses(_ipData.latitude, _ipData.longitude, { limit: 20, radius: 25 });
            if (_ipBiz.length > 0) {
              setNearbySafe(_ipBiz);
              setUsingRealData(true);
              writeCoords(_ipData.latitude, _ipData.longitude);
              loaded = true;
            }
          }
        } catch (_e) {}
      }

      if (!loaded && !hasNearbyRef.current) setNearbySafe([]);
      setDataLoading(false);
    });
  }, [router]);

  async function completeWelcome() {
    if (currentUserId && typeof window !== 'undefined') {
      const seenCacheKey = `sm_seen_welcome_${currentUserId}`;
      localStorage.setItem(seenCacheKey, 'true');
      await getSupabase().from('profiles').update({ has_seen_welcome: true }).eq('id', currentUserId);
    }
    setWelcomePhase('transitioning');
    window.setTimeout(() => setWelcomePhase('done'), 320);
  }

  const showWelcomeOverlay = welcomePhase === 'welcome' || welcomePhase === 'transitioning';
  const welcomeFading = welcomePhase === 'transitioning';

  if (loading) return (
    <>
      <Head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" /><title>Home — ScheduleMe</title></Head>
      <Nav />
      <div className="min-h-screen pb-20 md:pb-0 page-fade-in" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))', background: dm ? '#0a0a0a' : '#FCFAF6' }}>
        <div className="border-b py-8" style={{ background: dm ? '#111' : '#007e6d' }}>
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
      {showWelcomeOverlay && (
        <HomeOnboarding
          userName={welcomeName}
          fading={welcomeFading}
          onDone={completeWelcome}
        />
      )}
      <Nav />
      <div className="min-h-screen pb-20 md:pb-0" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))', background: 'var(--page-bg, #FCFAF6)' }} data-page-bg="true">

        {/* Search hero — flat solid blue, clean */}
          <div className="border-b" style={{
          background: dm
            ? '#0c0c0c'
            : 'linear-gradient(180deg, #F7F1EA 0%, #FCFAF6 100%)',
            borderColor: 'rgba(0,0,0,0.06)'
          }}>
          <div className="relative mx-auto max-w-4xl px-6 pt-7 pb-7">
            <div className="flex items-center gap-10">
              {/* Search — constrained width */}
              <div className="flex-1 min-w-0 max-w-lg">
                <AISearchBar userName={userName} onSubmit={runMatch} />
              </div>
              {/* Right rail: swap utility tiles with match results */}
              <div className="hidden lg:block w-[320px] shrink-0">
                {matchRan ? (
                  <div className="rounded-3xl border overflow-hidden animate-fade-up"
                    style={{ background: dm ? '#0f0f0f' : 'white', borderColor: dm ? '#262626' : '#e5e7eb', boxShadow: dm ? 'none' : '0 20px 40px rgba(0,0,0,0.08)' }}>
                    <div className="px-5 pt-4 pb-3 border-b" style={{ borderColor: dm ? '#262626' : '#f1f5f9' }}>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: dm ? 'rgba(255,255,255,0.7)' : '#0f0f0f' }}>Match Results</p>
                        {matching && (
                          <div className="flex items-center gap-2 text-[10px] font-semibold" style={{ color: dm ? '#9ca3af' : '#94a3b8' }}>
                            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                            Matching
                          </div>
                        )}
                      </div>
                      {!matching && matchKeywords.length > 0 && (
                        <p className="text-[11px] mt-1" style={{ color: dm ? '#9ca3af' : '#94a3b8' }}>
                          Keywords: {matchKeywords.slice(0, 6).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      {matching && (
                        <>
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: dm ? '#1c1c1e' : '#f1f5f9' }} />
                          ))}
                        </>
                      )}
                      {!matching && matchResults.length > 0 && (
                        <>
                          {matchResults.map(biz => (
                            <button
                              key={biz.id}
                              onClick={() => { if (isPreviewLocked(biz)) return; window.location.href = '/biz/' + (biz.slug || biz.realId || biz.id); }}
                              disabled={isPreviewLocked(biz)}
                              className="w-full rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                              style={{ borderColor: dm ? '#262626' : '#e5e7eb', background: dm ? '#111111' : '#fafafa' }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-14 w-14 rounded-xl overflow-hidden bg-neutral-100 flex-shrink-0">
                                  {biz.coverUrl ? (
                                    <img src={biz.coverUrl} alt={biz.category || 'Provider'} className="h-full w-full object-cover" style={{ filter: isPreviewLocked(biz) ? 'blur(12px)' : 'none' }} />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center">
                                      <span className="text-xs font-bold" style={{ color: dm ? '#d1d5db' : '#6b7280' }}>{initials(biz.category || 'Provider')}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold truncate" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{displayNameForCard(biz)}</p>
                                  <p className="text-[11px] mt-0.5 truncate" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>{biz.category}{!isPreviewLocked(biz) && biz.distance ? ` · ${biz.distance}` : ''}</p>
                                  {!isPreviewLocked(biz) && biz.tagline && (
                                    <p className="text-[11px] mt-1 line-clamp-2" style={{ color: dm ? '#8e8e93' : '#94a3b8' }}>{biz.tagline}</p>
                                  )}
                                  {isPreviewLocked(biz) && (
                                    <p className="text-[11px] mt-1 line-clamp-2" style={{ color: dm ? '#8e8e93' : '#94a3b8' }}>Private listing available to verified students.</p>
                                  )}
                                </div>
                                <div className="text-[11px] font-semibold" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                                  {isPreviewLocked(biz) ? 'Locked' : ((biz.reviews ?? 0) > 0 && biz.rating != null ? `${biz.rating.toFixed(1)}★` : 'New')}
                                </div>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                      {!matching && matchResults.length === 0 && (
                        <div className="rounded-2xl border px-4 py-6 text-center" style={{ borderColor: dm ? '#262626' : '#e5e7eb', background: dm ? '#111111' : '#f8fafc' }}>
                          <p className="text-sm font-semibold" style={{ color: dm ? '#f3f4f6' : '#0f172a' }}>No results found</p>
                          <p className="text-[11px] mt-1" style={{ color: dm ? '#9ca3af' : '#94a3b8' }}>Try different keywords or browse all services.</p>
                          <Link href="/browse" scroll={false}
                            className="inline-flex mt-3 text-[11px] font-black uppercase tracking-[0.14em] text-accent hover:opacity-70 transition-opacity">
                            Browse all
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 grid-rows-2 gap-2.5">
                    {([
                      { label: 'My Bookings', sub: 'Track your jobs', href: '/bookings', d: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5' },
                      { label: 'Browse Services', sub: 'See all services', href: '/browse', d: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z' },
                      { label: 'How It Works', sub: 'Pricing & info', href: '/pricing', d: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z' },
                      { label: 'Refer a Pro', sub: 'Know someone good?', href: '#refer', isModal: true, d: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
                    ] as const).map((tile) => tile.label === 'Refer a Pro' ? (
                      <button key={tile.label} onClick={() => setShowReferModal(true)}
                        className="flex flex-col justify-between rounded-2xl px-3.5 py-3.5 transition-all hover:scale-[1.02] hover:shadow-md text-left"
                        style={{ background: dm ? '#111111' : 'white', border: dm ? '1px solid rgb(38, 38, 38)' : '1px solid #e5e5e5', aspectRatio: '1', boxShadow: dm ? 'none' : '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <div className="h-8 w-8 rounded-xl flex items-center justify-center mb-2" style={{ background: 'rgba(0, 126, 109, 0.18)' }}>
                          <svg className="h-4 w-4" style={{ color: '#007e6d' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={tile.d} />
                          </svg>
                        </div>
                        <div>
                          <p className="text-[12px] font-black leading-snug" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{tile.label}</p>
                          <p className="text-[10px] mt-0.5 font-medium" style={{ color: dm ? 'rgba(255,255,255,0.45)' : '#007e6d' }}>{tile.sub}</p>
                        </div>
                      </button>
                    ) : (
                      <Link key={tile.label} href={tile.href} scroll={false}
                        className="flex flex-col justify-between rounded-2xl px-3.5 py-3.5 transition-all hover:scale-[1.02] hover:shadow-md"
                        style={{ background: dm ? '#111111' : 'white', border: dm ? '1px solid rgb(38,38,38)' : '1px solid #e5e5e5', aspectRatio: '1', boxShadow: dm ? 'none' : '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <div className="h-8 w-8 rounded-xl flex items-center justify-center mb-2" style={{ background: 'rgba(0, 126, 109, 0.18)' }}>
                          <svg className="h-4 w-4" style={{ color: '#007e6d' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={tile.d} />
                          </svg>
                        </div>
                        <div>
                          <p className="text-[12px] font-black leading-snug" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{tile.label}</p>
                          <p className="text-[10px] mt-0.5 font-medium" style={{ color: dm ? 'rgba(255,255,255,0.45)' : '#007e6d' }}>{tile.sub}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Category quick-links */}
        <div className="border-b" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(0,0,0,0.06)' }}>
          <div className="flex justify-center gap-2 overflow-x-auto px-6 py-3" style={{ scrollbarWidth: 'none' }}>
            {dynamicCategories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all border"
                style={activeCategory === cat
                  ? { background: '#007e6d', color: 'white', borderColor: '#007e6d' }
                  : { background: dm ? 'rgba(0,126,109,0.18)' : 'rgba(0,126,109,0.10)', color: dm ? '#6ee7b7' : '#007e6d', borderColor: dm ? 'rgba(0,126,109,0.35)' : 'rgba(0,126,109,0.22)' }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Campus pulse strip */}
        <section className="border-b" style={{ background: dm ? '#0f0f0f' : 'rgb(252, 250, 246)', borderColor: dm ? '#262626' : 'rgba(0, 0, 0, 0.06)' }}>
          <div className="mx-auto max-w-6xl px-6 py-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: dm ? '#9ca3af' : '#6b5f55' }}>
                Campus Pulse
              </p>
              <span className="text-[11px]" style={{ color: dm ? '#6b7280' : '#8a7f74' }}>
                Updated live
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {campusPulse.map((p) => (
                <div
                  key={p.title}
                  className="rounded-2xl px-4 py-3"
                  style={{
                    background: dm ? '#141414' : 'white', 
                    border: dm ? '1px solid #262626' : '1px solid rgba(0,0,0,0.06)',
                    boxShadow: dm ? 'none' : '0 2px 8px rgba(0,0,0,0.04)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: dm ? 'rgba(0,126,109,0.18)' : 'rgba(0,126,109,0.12)' }}>
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                          style={{ color: '#007e6d' }}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                              d="M12 6v6l4 2M20.25 12A8.25 8.25 0 113 12a8.25 8.25 0 0117.25 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>{p.title}</p>
                      <p className="text-[16px] font-black mt-1" style={{ color: dm ? '#f3f4f6' : '#171717', letterSpacing: '-0.02em' }}>
                        {p.value}
                      </p>
                      <p className="text-[10px] mt-1" style={{ color: dm ? '#6b7280' : '#8a7f74' }}>{p.sub}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>


      {/* EDU Campus banner — only shown to non-verified users */}
      {eduVerified === false && (
        <div style={{ background: dm ? '#0a0a0a' : '#FCFAF6' }}>
          <div style={{ paddingLeft: 'max(24px, calc((100vw - 1400px) / 2))', paddingRight: 'max(24px, calc((100vw - 1400px) / 2))', paddingTop: 24, paddingBottom: 8 }}>
            <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl"
              style={{ background: dm ? 'rgba(0,126,109,0.10)' : '#ECF7F4', border: dm ? '1px solid rgba(0,126,109,0.25)' : '1px solid rgba(0,126,109,0.18)' }}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl shrink-0">🎓</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: dm ? '#d5e1de' : '#0f3f36' }}>Are you a student?</p>
                  <p className="text-xs" style={{ color: dm ? '#9ca3af' : '#1e554c' }}>Verify your .edu email to unlock your campus marketplace.</p>
                  <p className="text-[11px]" style={{ color: dm ? '#6b7280' : '#2f6b60' }}>Some student providers only show themselves to verified students on campus.</p>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => router.push('/account?edu=1')}
                  className="shrink-0 text-xs font-bold px-4 py-2 rounded-xl whitespace-nowrap transition-all hover:opacity-90"
                  style={{ background: '#007e6d', color: 'white', boxShadow: '0 4px 12px rgba(0,126,109,0.25)' }}>
                  Verify Now →
                </button>
                <button
                  onClick={() => setEduVerified(true)}
                  className="shrink-0 h-8 w-8 flex items-center justify-center rounded-xl"
                  style={{ background: dm ? '#1f2937' : '#e5e7eb', color: dm ? '#9ca3af' : '#6b7280' }}>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



        {/* Install app banner — mobile only, not shown if already installed */}
        {showInstallBanner && (
          <div style={{ paddingLeft: 'max(24px, calc((100vw - 1400px) / 2))', paddingRight: 'max(24px, calc((100vw - 1400px) / 2))', paddingTop: eduVerified === false ? 12 : 24 }}>
            <div className="rounded-2xl overflow-hidden"
              style={{ background: dm ? '#171717' : 'white', border: dm ? '1px solid #262626' : '1px solid rgba(0,0,0,0.08)', boxShadow: dm ? 'none' : '0 2px 12px rgba(0,0,0,0.06)' }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#007e6d' }}>
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
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(10,132,255,0.12)' }}>
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
        <div style={{ background: dm ? '#0a0a0a' : '#FCFAF6' }}>
          <div className="py-5 space-y-6">
            {(() => {
            const pool = realBizList.length > 0
              ? realBizList
              : [];
            const pinned = pool.filter(b => pinnedIds.has(b.id));
            const filtered = activeCategory === 'All' ? pool : activeCategory === 'Pinned' ? pinned : pool.filter(b => b.category === activeCategory);
            const rated = filtered.filter(b => (b.reviews ?? 0) > 0 && b.rating != null);
            const t1 = activeCategory === 'All'
              ? (rated.length > 0 ? rated.slice(0, 8) : pool.slice(0, 8))
              : (rated.length > 0 ? rated.slice(0, 8) : filtered.slice(0, 8));
            const localProviders = filtered.filter((b) => !(b as any).campus_provider);
            const t2 = activeCategory === 'All'
              ? (localProviders.length > 0 ? localProviders.slice(0, 8) : pool.slice(0, 8))
              : (localProviders.length > 0 ? localProviders : filtered);
            const t3 = activeCategory === 'All' ? pool.slice(0, 8) : filtered;
            return (
              <>
                <ScrollSection
                  key={`top-${activeCategory}-${dataLoading}`}
                  title="Top-rated near you"
                  subtitle="Available now — highly reviewed"
                  href="/browse"
                  businesses={t1.slice(0, 6)}
                  onBizClick={(biz) => { if (isPreviewLocked(biz)) return; window.location.href = '/biz/' + (biz.slug || biz.realId || biz.id); }}
                  dm={dm}
                  isLoading={dataLoading}
                  bg={sectionBg}
                  pinnedIds={pinnedIds}
                  onTogglePin={togglePinned}
                />
                <ScrollSection
                  key={`indie-${activeCategory}`}
                  title="Local providers"
                  subtitle="Trusted non-student local pros near you"
                  href="/browse"
                  businesses={t2.slice(0, 6)}
                  onBizClick={(biz) => { if (isPreviewLocked(biz)) return; window.location.href = '/biz/' + (biz.slug || biz.realId || biz.id); }}
                  dm={dm}
                  isLoading={dataLoading}
                  bg={sectionBg}
                  pinnedIds={pinnedIds}
                  onTogglePin={togglePinned}
                />
                <ScrollSection
                  key={`quick-${activeCategory}`}
                  title="Quick response"
                  subtitle="Pros that pick up jobs fast"
                  href="/browse"
                  businesses={t3.slice(0, 6)}
                  onBizClick={(biz) => { if (isPreviewLocked(biz)) return; window.location.href = '/biz/' + (biz.slug || biz.realId || biz.id); }}
                  dm={dm}
                  isLoading={dataLoading}
                  bg={sectionBg}
                  pinnedIds={pinnedIds}
                  onTogglePin={togglePinned}
                />
              </>
            );
            })()}
            <ReferCard />
          </div>
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
          <button onClick={() => { setShowReferModal(false); setReferSent(false); setReferName(''); }} className="w-full py-3 rounded-2xl font-bold text-white" style={{ background: '#007e6d' }}>Done</button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold" style={{ color: dm ? '#f2f2f7' : '#111', letterSpacing: '-0.02em' }}>Refer a Pro</h3>
              <p className="text-sm mt-0.5" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>Know a great local business? Tell us.</p>
            </div>
            <button onClick={() => setShowReferModal(false)} className="h-8 w-8 flex items-center justify-center rounded-full" style={{ background: dm ? '#2c2c2e' : '#f5f5f5' }}>
              <svg className="h-4 w-4" style={{ color: dm ? '#8e8e93' : '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <input type="text" value={referName} onChange={e => setReferName(e.target.value)} placeholder="Business or person's name" className="w-full px-4 py-3 rounded-2xl text-sm outline-none mb-4" style={{ background: dm ? '#2c2c2e' : '#f5f5f5', color: dm ? '#f2f2f7' : '#111', border: dm ? '1.5px solid #3a3a3c' : '1.5px solid #e5e7eb' }} />
          <button disabled={!referName.trim()} onClick={() => { if (referName.trim()) setReferSent(true); }} className="w-full py-3.5 rounded-2xl font-bold text-sm" style={{ background: referName.trim() ? '#007e6d' : (dm ? '#2c2c2e' : '#e5e7eb'), color: referName.trim() ? 'white' : (dm ? '#6b7280' : '#9ca3af') }}>Submit Referral</button>
        </>
      )}
    </div>
  </div>
)}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
      {/* Floating feedback button */}
      <button onClick={() => setShowFeedback(true)}
        className="fixed bottom-24 md:bottom-6 right-4 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
        style={{ background: '#007e6d', color: 'white' }}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
        <span className="text-sm font-bold">Feedback</span>
      </button>
    </>
  );
};

export default HomePage;
