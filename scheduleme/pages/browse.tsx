// @ts-nocheck
// pages/browse.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import { useDm } from '../lib/DarkModeContext';
import BusinessProfile from '../components/BusinessProfile';
import type { Business } from '../lib/mockBusinesses';
import { SkeletonCard, SkeletonBrowseCard } from '../components/SkeletonCard';
import { fetchAllBusinesses, fetchNearbyBusinesses } from '../lib/realBusinesses';
import { shouldShowNewBadge } from '../lib/newBadge';
import { formatPriceTierLabel } from '../lib/priceTierLabel';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);
}

// CATEGORIES is now dynamic — built from loaded businesses below
type SortMode = 'distance' | 'rating' | 'reviews';
const SORT_LABELS: Record<SortMode, string> = { distance: 'Nearest', rating: 'Top Rated', reviews: 'Most Reviewed' };

function parseDistanceMiles(value: string): number {
  const raw = String(value || '').toLowerCase();
  if (!raw) return Number.POSITIVE_INFINITY;
  if (raw.includes('nearby')) return 0;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

function getOpenStatus(hours: { day: string; time: string }[]): { open: boolean; label: string } {
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
    if (openM === null || closeM === null) continue;
    if (dayMatches(h.day, todayName)) {
      if (nowMins >= openM && nowMins < closeM) return { open: true, label: 'Open' };
      if (nowMins < openM) { const hh=Math.floor(openM/60),mm=openM%60,ampm=hh>=12?'PM':'AM',dh=hh>12?hh-12:hh===0?12:hh; return {open:false,label:`Opens ${dh}:${String(mm).padStart(2,'0')} ${ampm}`}; }
      for (const h2 of hours) { if (dayMatches(h2.day, tomorrowName)) { const rp2=h2.time.split('–').map(p=>p.trim()),om2=parseTime(rp2[0]); if(om2!==null){const hh2=Math.floor(om2/60),mm2=om2%60,ap2=hh2>=12?'PM':'AM',dh2=hh2>12?hh2-12:hh2===0?12:hh2; return{open:false,label:`Opens tomorrow ${dh2}:${String(mm2).padStart(2,'0')} ${ap2}`};}}} 
      return { open: false, label: 'Closed' };
    }
  }
  return { open: true, label: 'Open' };
}

function MapPlaceholder({ businesses, selected, onSelect, dm, userLat, userLng }: {
  businesses: Business[]; selected: string | null; onSelect: (id: string) => void; dm?: boolean; userLat?: number | null; userLng?: number | null;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const businessesKey = businesses
    .map((b) => `${b.id}:${b.lat ?? ''}:${b.lng ?? ''}:${b.coverUrl ?? ''}:${b.preview_locked ? '1' : '0'}`)
    .join('|');

  function markerHtml(biz: Business, isSel: boolean) {
    if (biz.preview_locked === true) {
      return `<div style="width:44px;height:44px;border-radius:9999px;overflow:hidden;border:2px solid ${isSel ? '#0F766E' : (dm ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)')};box-shadow:${isSel ? '0 0 0 2px rgba(15,118,110,0.35), 0 8px 16px rgba(0,0,0,0.22)' : '0 6px 14px rgba(0,0,0,0.18)'};background:${dm ? '#30333f' : '#d1d5db'};display:flex;align-items:center;justify-content:center;font:900 13px -apple-system,BlinkMacSystemFont,sans-serif;color:${dm ? '#d1d5db' : '#4b5563'};letter-spacing:-0.02em;">ST</div>`;
    }
    const hasCover = !!biz.coverUrl && biz.coverUrl !== TRANSPARENT_PIXEL;
    const border = isSel ? '#0F766E' : (dm ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)');
    const ring = isSel ? '0 0 0 2px rgba(15,118,110,0.35), 0 8px 16px rgba(0,0,0,0.22)' : '0 6px 14px rgba(0,0,0,0.18)';
    return `<div style="width:44px;height:44px;border-radius:9999px;overflow:hidden;border:2px solid ${border};box-shadow:${ring};background:${dm ? '#171717' : '#ffffff'};display:flex;align-items:center;justify-content:center;transform:${isSel ? 'scale(1.06)' : 'scale(1)'};transition:transform 150ms ease;">${
      hasCover
        ? `<img src="${biz.coverUrl}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center;" />`
        : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="${dm ? '#9ca3af' : '#6b7280'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0L15 15m-1.5-1.5l1.159-1.159a2.25 2.25 0 013.182 0L21.75 16.5m-1.5-13.5h-15A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21h15a2.25 2.25 0 002.25-2.25V5.25A2.25 2.25 0 0020.25 3z"/></svg>`
    }</div>`;
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;
    import('leaflet').then(L => {
      if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; }
      const validBiz = businesses.find(b => b.lat && b.lng && b.lat !== 0);
      const hasUserCenter = Number.isFinite(userLat) && Number.isFinite(userLng);
      const center: [number, number] = hasUserCenter
        ? [userLat as number, userLng as number]
        : validBiz
          ? [validBiz.lat!, validBiz.lng!]
          : [39.8283, -98.5795]; // continental US fallback (never hard-default to SF)
      const map = L.map(mapRef.current!, { zoomControl: true, scrollWheelZoom: true, maxZoom: 22, zoomSnap: 0.25 });
      leafletMapRef.current = map;
      const tileUrl = dm
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      L.tileLayer(tileUrl, {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 22,
      }).addTo(map);
      map.setView(center, hasUserCenter ? 12 : 13);

      if (hasUserCenter) {
        L.circleMarker([userLat as number, userLng as number], {
          radius: 7,
          weight: 2,
          color: '#ffffff',
          fillColor: '#0F766E',
          fillOpacity: 1,
        }).addTo(map);
      }

      const overlapCounts = new Map<string, number>();
      markersRef.current = businesses.filter(b => b.lat && b.lng && b.lat !== 0).map(biz => {
        const isSel = selected === biz.id;
        const lat = Number(biz.lat);
        const lng = Number(biz.lng);
        const key = `${lat.toFixed(5)}:${lng.toFixed(5)}`;
        const overlapIndex = overlapCounts.get(key) || 0;
        overlapCounts.set(key, overlapIndex + 1);
        const ring = Math.floor(overlapIndex / 8) + 1;
        const angle = ((overlapIndex % 8) / 8) * Math.PI * 2;
        const jitter = overlapIndex === 0 ? 0 : 0.00006 * ring;
        const markerLat = lat + Math.sin(angle) * jitter;
        const markerLng = lng + Math.cos(angle) * jitter;
        const icon = L.divIcon({
          className: '',
          html: markerHtml(biz, isSel),
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });
        const marker = L.marker([markerLat, markerLng], { icon }).addTo(map).on('click', () => {
          if (biz.preview_locked) return;
          onSelect(biz.id);
        });
        return { id: biz.id, marker };
      });
      if (markersRef.current.length > 0) {
        const pts = markersRef.current.map(({ marker }) => marker.getLatLng());
        if (hasUserCenter) pts.push(L.latLng(userLat as number, userLng as number));
        try {
          map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 19 });
        } catch {
          map.setView(center, hasUserCenter ? 12 : 13);
        }
      }
      map.whenReady(() => map.invalidateSize(true));
      window.setTimeout(() => map.invalidateSize(true), 120);
      window.setTimeout(() => map.invalidateSize(true), 420);
      const onResize = () => map.invalidateSize(true);
      window.addEventListener('resize', onResize);
      (map as any).__onResize = onResize;
    });
    return () => {
      if (leafletMapRef.current) {
        const onResize = (leafletMapRef.current as any).__onResize;
        if (onResize) window.removeEventListener('resize', onResize);
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [businessesKey, dm, userLat, userLng]);

  useEffect(() => {
    if (!leafletMapRef.current) return;
    import('leaflet').then(L => {
      markersRef.current.forEach(({ id, marker }) => {
        const biz = businesses.find(b => b.id === id);
        if (!biz) return;
        const isSel = selected === id;
        const icon = L.divIcon({ className: '', html: markerHtml(biz, isSel), iconSize: [44, 44], iconAnchor: [22, 22] });
        marker.setIcon(icon);
      });
    });
  }, [selected]);

  return (
    <>
      <style>{`
        .leaflet-container { background: ${dm ? '#101418' : '#F4EFE6'} !important; position: relative; }
        .leaflet-container img,
        .leaflet-container .leaflet-tile { max-width: none !important; max-height: none !important; }
        .leaflet-container .leaflet-tile {
          filter: ${dm ? 'grayscale(0.12) saturate(0.72) brightness(0.72) contrast(1.08)' : 'saturate(0.92) brightness(1.02) contrast(1.02)'} !important;
        }
        .leaflet-tile-pane { opacity: ${dm ? '0.95' : '1'}; }
        .leaflet-container::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: ${dm ? 'rgba(6,22,28,0.06)' : 'rgba(15,118,110,0.02)'};
        }
        .leaflet-control-zoom a { font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif!important;font-weight:700!important;color:${dm?'#f3f4f6':'#171717'}!important;background:${dm?'#171717':'white'}!important;border-color:${dm?'#404040':'#e5e7eb'}!important; }
        .leaflet-control-zoom { border:none!important;box-shadow:0 2px 8px rgba(0,0,0,0.15)!important;border-radius:10px!important;overflow:hidden!important; }
        .leaflet-popup-content-wrapper { border-radius:12px!important;box-shadow:0 4px 20px rgba(0,0,0,0.15)!important; }
      `}</style>
      <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 'inherit' }} />
    </>
  );
}

// Same card design as home — full-bleed image, gradient overlay, pill + arrow row below
// Standard card — square image on mobile, clean vertical layout
function BizCard({ biz, onClick, dm, index = 0, href }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const cardBg = dm ? '#1c1c1e' : 'white';
  const status = getOpenStatus(biz.hours);
  const isLocked = biz.preview_locked === true;
  const hasCover = !!biz.coverUrl && biz.coverUrl !== TRANSPARENT_PIXEL;
  const displayName = biz.name || biz.category || 'Provider';
  const initials = isLocked ? 'ST' : (displayName.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || 'PR');
  return (
    <button
      onClick={isLocked ? undefined : (href ? () => window.location.href = href : onClick)}
      disabled={isLocked}
      className="biz-card group w-full text-left flex flex-col animate-fade-up"
      style={{ animationDelay: `${index * 0.05}s`, borderRadius: 18, overflow: 'hidden', background: cardBg, boxShadow: dm ? '0 0 0 1px #2c2c2e' : '0 2px 12px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)', cursor: isLocked ? 'not-allowed' : 'pointer' }}>
      <div className="relative flex-shrink-0 w-full overflow-hidden" style={{ aspectRatio: '4/3', background: dm ? '#2c2c2e' : '#e5e7eb' }}>
        {isLocked ? (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: dm ? '#30333f' : '#d1d5db' }}>
            <span className="text-[34px] font-black" style={{ color: dm ? '#d1d5db' : '#6b7280', letterSpacing: '-0.04em' }}>{initials}</span>
          </div>
        ) : hasCover ? (
          <img src={biz.coverUrl} alt={displayName} onLoad={() => setImgLoaded(true)}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            style={{ objectPosition: 'center 25%', opacity: imgLoaded ? 1 : 0 }} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0L15 15m-1.5-1.5l1.159-1.159a2.25 2.25 0 013.182 0L21.75 16.5m-1.5-13.5h-15A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21h15a2.25 2.25 0 002.25-2.25V5.25A2.25 2.25 0 0020.25 3z" />
            </svg>
            <span className="text-[11px] font-semibold">No photos added</span>
          </div>
        )}
        {isLocked && (
          <div className="absolute left-2 bottom-2 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.08em]" style={{ background: dm ? 'rgba(23,23,23,0.94)' : 'rgba(31,41,55,0.92)', color: '#f3f4f6', border: '1px solid rgba(255,255,255,0.18)' }}>
            Private until student verification
          </div>
        )}
      </div>
      <div className="px-4 py-3.5 flex flex-col gap-1.5" style={{ background: cardBg }}>
        <p className="font-bold text-[15px] leading-snug group-hover:text-accent transition-colors" style={{ color: dm ? '#f2f2f7' : '#1c1c1e', letterSpacing: '-0.02em' }}>{displayName}</p>
        {isLocked && <p className="text-[12px] leading-snug" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>Private until student verification</p>}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(15,118,110,0.24)' : 'rgba(15,118,110,0.12)', color: dm ? '#6ee7b7' : '#0F766E' }}>{biz.category}</span>
          {formatPriceTierLabel(biz.price_tier) ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(15,118,110,0.24)' : 'rgba(15,118,110,0.12)', color: dm ? '#6ee7b7' : '#0F766E' }}>{formatPriceTierLabel(biz.price_tier)}</span> : null}
          {shouldShowNewBadge({ createdAt: (biz as any).created_at, reviewCount: biz.reviews }) && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(251,191,36,0.18)' : '#fef3c7', color: dm ? '#f59e0b' : '#92400e' }}>New</span>
          )}
          <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: status.open ? (dm ? 'rgba(52,211,153,0.15)' : '#f0fdf4') : (dm ? 'rgba(255,255,255,0.07)' : '#f5f5f5'), color: status.open ? '#16a34a' : (dm ? '#6b7280' : '#9ca3af') }}>
            <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${status.open ? 'bg-emerald-500' : 'bg-neutral-400'}`} />{status.label}
          </span>
        </div>
        <p className="text-[12px]" style={{ color: dm ? '#8e8e93' : '#8e8e93' }}>{biz.distance}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="flex items-center gap-0.5">
            {[1,2,3,4,5].map(i => (
              <svg key={i} className={`h-3 w-3 ${i <= Math.round(biz.rating) ? 'text-amber-400' : (dm ? 'text-neutral-600' : 'text-neutral-200')}`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-[13px] font-bold" style={{ color: dm ? '#d1d5db' : '#374151' }}>{biz.rating}</span>
          <span className="text-[12px]" style={{ color: dm ? '#6b7280' : '#9ca3af' }}>({biz.reviews})</span>
        </div>
      </div>
    </button>
  );
}


function ReferInline() {
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
    <div className="rounded-2xl border border-green-100 bg-green-50 px-5 py-4 text-center">
      <p className="text-sm font-semibold text-green-800">Referral received — we'll reach out to {bizName}.</p>
    </div>
  );

  if (!open) return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 flex items-center gap-3.5">
      <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
        <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
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
    <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 space-y-3">
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

const BrowsePage: NextPage = () => {
  const router = useRouter();
  const { dm } = useDm();
  const [sortMode, setSortMode] = useState<SortMode>('distance');
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMapBiz, setSelectedMapBiz] = useState<string | null>(null);
  const [activeBiz, setActiveBiz] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'map'>('grid');
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 12;
  const [mapPage, setMapPage] = useState(1);
  const MAP_ITEMS_PER_PAGE_DESKTOP = 10;
  const MAP_ITEMS_PER_PAGE_MOBILE = 6;
  const [bizList, setBizList] = useState<Business[]>([]);
  const [bizLoading, setBizLoading] = useState(true);
  const [radius, setRadius] = useState(25);
  const [userLat, setUserLat] = useState(null);
  const [userLng, setUserLng] = useState(null);
  const [usingRealData, setUsingRealData] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const [mapListMobile, setMapListMobile] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showMapLoginPrompt, setShowMapLoginPrompt] = useState(false);
  const mapListRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const dynamicCategories = bizLoading ? ['All'] : ['All', ...Array.from(new Set(bizList.map(b => b.category).filter(Boolean))).sort()];
  const mobileViewLabel = viewMode === 'grid' ? 'Grid' : viewMode === 'list' ? 'List' : 'Map';
  const cycleMobileViewMode = () => {
    setViewMode((prev) => {
      if (prev === 'grid') return 'list';
      if (prev === 'list') {
        if (!isLoggedIn) {
          setShowMapLoginPrompt(true);
          return 'list';
        }
        return 'map';
      }
      return 'grid';
    });
  };

  async function loadNearbyFromCoords(lat: number, lng: number, currentRadius: number) {
    setUserLat(lat);
    setUserLng(lng);
    const real = await fetchNearbyBusinesses(lat, lng, { limit: 40, radius: currentRadius });
    if (real.length > 0) {
      setBizList(real);
      setUsingRealData(true);
      return true;
    }
    const fallback = await fetchAllBusinesses({ limit: 40 });
    setBizList(fallback);
    if (fallback.length > 0) setUsingRealData(true);
    return fallback.length > 0;
  }

  async function tryIpFallback(currentRadius: number) {
    const ipSources = ['https://ipapi.co/json/', 'https://ipwho.is/'];
    for (const src of ipSources) {
      try {
        const res = await fetch(src);
        const json = await res.json();
        const lat = Number(json.latitude ?? json.lat);
        const lng = Number(json.longitude ?? json.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const ok = await loadNearbyFromCoords(lat, lng, currentRadius);
        if (ok) return true;
      } catch {
        // Try the next IP source.
      }
    }
    return false;
  }


  useEffect(() => {
    if (!sortOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-sort-dropdown]')) setSortOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sortOpen]);

  useEffect(() => {
    let alive = true;
    const init = async () => {
      try {
        // We intentionally allow guest browsing for better top-of-funnel UX.
        // Session check is still read here so logged-in behavior can evolve safely.
        const supabase = getSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        setIsLoggedIn(!!session);
        if (!alive) return;
        setLoading(false);

        // Fast seed load so UI can render quickly before location resolves.
        const seeded = await fetchAllBusinesses({ limit: 40 });
        if (!alive) return;
        setBizList(seeded);
        if (seeded.length > 0) setUsingRealData(true);
        setBizLoading(false);

        // Then refine in background with geolocation/IP-based nearby fetch.
        let loaded = false;
        // Always try precise device location first so map defaults to current area.
        if (navigator.geolocation) {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                loaded = await loadNearbyFromCoords(pos.coords.latitude, pos.coords.longitude, radius);
                resolve();
              },
              () => resolve(),
              { timeout: 10000, enableHighAccuracy: false, maximumAge: 60000 }
            );
          });
        }
        if (!loaded) {
          loaded = await tryIpFallback(radius);
        }
        if (!alive) return;
        if (!loaded) {
          // Keep seeded list instead of forcing blank state when geo lookup fails.
          setGeoError(seeded.length === 0);
        } else {
          setGeoError(false);
        }
      } finally {
        if (alive) setBizLoading(false);
      }
    };
    init();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (router.query.category) setActiveCategory(router.query.category as string);
    if (router.query.q) setSearchQuery(router.query.q as string);
  }, [router.query]);

  useEffect(() => {
    if (router.query.biz) {
      const biz = bizList.find(b => b.id === router.query.biz);
      if (biz) setActiveBiz(biz);
    }
  }, [router.query.biz]);

  const filtered = bizList.filter(b => {
    const matchCat = activeCategory === 'All'
      || (activeCategory === 'Independent' ? b.independent === true : b.category === activeCategory);
    const matchSearch = !searchQuery
      || b.name.toLowerCase().includes(searchQuery.toLowerCase())
      || b.category.toLowerCase().includes(searchQuery.toLowerCase())
      || b.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  }).sort((a, b) => {
    if (sortMode === 'rating') return b.rating - a.rating;
    if (sortMode === 'reviews') return b.reviews - a.reviews;
    return parseDistanceMiles(a.distance) - parseDistanceMiles(b.distance);
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const mapItemsPerPage = mapListMobile ? MAP_ITEMS_PER_PAGE_MOBILE : MAP_ITEMS_PER_PAGE_DESKTOP;
  const mapTotalPages = Math.max(1, Math.ceil(filtered.length / mapItemsPerPage));
  const mapPaginated = filtered.slice((mapPage - 1) * mapItemsPerPage, mapPage * mapItemsPerPage);
  const pillStyle = dm
    ? { background: 'rgba(15,118,110,0.24)', color: '#6ee7b7' }
    : { background: 'rgba(15,118,110,0.12)', color: '#0F766E' };
  useEffect(() => { setPage(1); setMapPage(1); }, [activeCategory, searchQuery, sortMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setMapListMobile(window.innerWidth < 768);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  // Re-fetch when radius changes if we have coords
  useEffect(() => {
    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return;
    setBizLoading(true);
    fetchNearbyBusinesses(userLat as number, userLng as number, { limit: 40, radius })
      .then(async (real) => {
        if (real.length > 0) {
          setBizList(real);
          setUsingRealData(true);
          return;
        }
        const fallback = await fetchAllBusinesses({ limit: 40 });
        setBizList(fallback);
        if (fallback.length > 0) setUsingRealData(true);
      })
      .catch(async () => {
        const fallback = await fetchAllBusinesses({ limit: 40 });
        setBizList(fallback);
      })
      .finally(() => setBizLoading(false));
  }, [radius]);
  const selectedMapBizData = bizList.find(b => b.id === selectedMapBiz) ?? null;
  useEffect(() => {
    if (viewMode !== 'map' || !selectedMapBiz) return;
    const selectedIndex = filtered.findIndex((b) => b.id === selectedMapBiz);
    if (selectedIndex < 0) return;
    const nextMapPage = Math.floor(selectedIndex / mapItemsPerPage) + 1;
    if (nextMapPage !== mapPage) {
      setMapPage(nextMapPage);
      return;
    }
    const node = mapListRefs.current[selectedMapBiz];
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedMapBiz, viewMode, filtered, mapItemsPerPage, mapPage]);

  if (loading) return (
    <>
      <Head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" /><title>Browse — ScheduleMe</title></Head>
      <Nav />
      <div className="min-h-screen pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-0" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))', background: dm ? '#0a0a0a' : '#F4EFE6' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => <SkeletonBrowseCard key={i} />)}
        </div>
      </div>
    </>
  );

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <title>Browse — ScheduleMe</title></Head>

      <div className="min-h-screen pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-0" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))', background: dm ? '#0a0a0a' : '#F4EFE6' }}>
        <Nav />

        <div className="border-b" style={{ background: 'linear-gradient(145deg,#0F766E 0%, #156F68 100%)', borderColor: 'rgba(0,0,0,0.08)' }}>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-7 pb-6">
            <div className="md:hidden flex items-center justify-between gap-3 mb-5">
              <div>
                <h1 className="text-[2.1rem] font-black text-white leading-none" style={{ letterSpacing: '-0.03em' }}>Browse Pros</h1>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] mt-1.5" style={{ color: 'rgba(255,255,255,0.62)' }}>Explore</p>
              </div>
              <button
                onClick={cycleMobileViewMode}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,255,255,0.92)', color: '#0F766E' }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                {mobileViewLabel}
              </button>
            </div>
            <div className="hidden md:flex items-center justify-between gap-4 mb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Explore</p>
                <h1 className="text-[1.9rem] font-black text-white" style={{ letterSpacing: '-0.03em', lineHeight: 1.1 }}>Browse Pros</h1>
              </div>
              <div className="flex items-center rounded-xl p-1 flex-shrink-0" style={{ background: dm ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)' }}>
                {([
                  ['list', 'List', 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z'],
                  ['grid', 'Grid', 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z'],
                  ['map', 'Map', 'M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z'],
                ] as const).map(([mode, label, d]) => (
                  <button key={mode} onClick={() => {
                    if (mode === 'map' && !isLoggedIn) {
                      setShowMapLoginPrompt(true);
                      return;
                    }
                    setViewMode(mode as 'list' | 'grid' | 'map');
                  }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={viewMode === mode
                      ? { background: dm ? '#111111' : 'white', color: dm ? '#f3f4f6' : '#0F766E', border: dm ? '1px solid #262626' : 'none' }
                      : { color: 'white', background: 'transparent' }}>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
                    </svg>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: dm ? 'rgba(255,255,255,0.4)' : '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input type="text" placeholder="Search businesses or services…"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all placeholder:text-neutral-400"
                  style={{ background: dm ? '#111111' : 'rgba(244,239,230,0.98)', color: dm ? '#f3f4f6' : '#171717', border: dm ? '1px solid #2a2d3a' : '1px solid rgba(15,118,110,0.22)' }}
                />
              </div>
              <div className="relative flex-shrink-0" data-sort-dropdown>
                <button onClick={() => setSortOpen(o => !o)}
                  className="w-full sm:w-auto flex items-center gap-2 pl-3.5 pr-3 py-2.5 rounded-xl text-sm font-semibold focus:outline-none" style={{ background: dm ? '#111111' : 'rgba(244,239,230,0.98)', color: dm ? '#f3f4f6' : '#171717', border: dm ? '1px solid #2a2d3a' : '1px solid rgba(15,118,110,0.22)', minWidth: 130 }}>
                  <span className="flex-1 text-left">{SORT_LABELS[sortMode]}</span>
                  <svg className={`h-3.5 w-3.5 text-neutral-400 transition-transform duration-150 ${sortOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {sortOpen && (
                  <div className="absolute right-0 top-full mt-1.5 rounded-xl shadow-lg overflow-hidden z-50"
                    style={{ minWidth: 150, background: dm ? '#171717' : 'white', border: dm ? '1px solid #2a2d3a' : '1px solid rgba(0,0,0,0.07)' }}>
                    {(['distance', 'rating', 'reviews'] as const).map(mode => (
                      <button key={mode} onClick={() => { setSortMode(mode); setSortOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent-wash flex items-center justify-between gap-3"
                        style={{ color: sortMode === mode ? '#0F766E' : (dm ? '#d1d5db' : '#374151') }}>
                        {SORT_LABELS[mode]}
                        {sortMode === mode && (
                          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-b" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : 'rgba(0,0,0,0.06)' }}>
          <div className="flex justify-start sm:justify-center gap-2 overflow-x-auto px-4 sm:px-6 py-3" style={{ scrollbarWidth: 'none' }}>
            {dynamicCategories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all border"
                style={activeCategory === cat
                  ? { background: '#0F766E', color: 'white', borderColor: '#0F766E' }
                  : { background: dm ? 'rgba(15,118,110,0.15)' : '#FFFFFF', color: dm ? '#6ee7b7' : '#0F766E', borderColor: dm ? 'rgba(15,118,110,0.3)' : 'rgba(15,118,110,0.28)' }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: dm ? '#0f0f0f' : '#F4EFE6', borderBottom: dm ? '1px solid #1f2937' : '1px solid rgba(15,118,110,0.08)' }}>
          <div className="flex items-center justify-start sm:justify-center gap-2 px-4 sm:px-6 py-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <span className="text-[11px] font-semibold shrink-0" style={{ color: dm ? '#6b7280' : '#9ca3af' }}>Within</span>
            {[5, 10, 25, 50, 100].map(r => (
              <button key={r} onClick={() => setRadius(r)} className="shrink-0 px-3 py-1 rounded-full text-[11px] font-bold border transition-all" style={radius === r ? { background: '#0F766E', color: 'white', borderColor: '#0F766E' } : { background: 'transparent', color: dm ? '#9ca3af' : '#6b7280', borderColor: dm ? '#2a2d3a' : '#e5e5e5' }}>{r} mi</button>
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-7">
          {viewMode !== 'map' ? (
            <>
              <p className="text-[10px] font-black text-accent/50 uppercase tracking-[0.14em] mb-5">
                {bizLoading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'business' : 'businesses'}`}
                {!bizLoading && totalPages > 1 && <span className="ml-2 text-neutral-300">· Page {page} of {totalPages}</span>}
              </p>
              {bizLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 9 }).map((_, i) => <SkeletonBrowseCard key={i} />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-24 px-6">
                  <div className="text-4xl mb-4">📍</div>
                  <p className="font-semibold text-lg" style={{ color: dm ? '#f3f4f6' : '#171717' }}>
                    {searchQuery || activeCategory !== 'All' ? 'No results found' : 'No businesses found nearby'}
                  </p>
                  <p className="text-sm mt-2 max-w-xs mx-auto" style={{ color: dm ? '#6b7280' : '#9ca3af' }}>
                    {searchQuery || activeCategory !== 'All'
                      ? 'Try a different search or category'
                      : 'Enable location access and click the button below to see local pros near you'}
                  </p>
                  {geoError && (
                    <button onClick={() => {
                      setGeoError(false);
                      setBizLoading(true);
                      navigator.geolocation.getCurrentPosition(
                        async (pos) => {
                          const loaded = await loadNearbyFromCoords(pos.coords.latitude, pos.coords.longitude, radius);
                          if (!loaded) setGeoError(true);
                          setBizLoading(false);
                        },
                        () => {
                          setBizList([]);
                          setGeoError(true);
                          setBizLoading(false);
                        },
                        { timeout: 15000, maximumAge: 0 }
                      );
                    }} className="mt-4 px-5 py-2.5 rounded-2xl font-bold text-white text-sm" style={{ background: '#0F766E' }}>📍 Use My Location</button>
                  )}
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up" style={{ alignItems: 'stretch', animationDuration: '0.3s' }}>
                  {paginated.map((biz, i) => (
                    <BizCard key={biz.id} biz={biz} onClick={() => { if(biz.slug||biz.realId||biz.id) window.location.href='/biz/'+(biz.slug||biz.realId||biz.id); else setActiveBiz(biz); }} dm={dm} index={i} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5 animate-fade-up" style={{ animationDuration: '0.3s' }}>
                  {paginated.map(biz => {
                    const listStatus = getOpenStatus(biz.hours);
                    return (
                    <button key={biz.id} onClick={() => { if (biz.preview_locked) return; if(biz.slug||biz.realId||biz.id) window.location.href='/biz/'+(biz.slug||biz.realId||biz.id); else setActiveBiz(biz); }}
                      className="group w-full text-left flex gap-4 p-3.5 rounded-2xl border transition-all hover:-translate-y-0.5 animate-fade-up"
                      style={{ background: dm ? '#1c1c1e' : 'white', borderColor: dm ? '#2c2c2e' : 'rgba(0,0,0,0.06)', boxShadow: dm ? 'none' : '0 1px 6px rgba(0,0,0,0.05)', animationDelay: `${paginated.indexOf(biz) * 0.04}s`, cursor: biz.preview_locked ? 'not-allowed' : 'pointer' }}>
                      <div className="relative flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100" style={{ width: 120, height: 140 }}>
                        {biz.preview_locked ? (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: dm ? '#30333f' : '#d1d5db' }}>
                            <span className="text-xl font-black" style={{ color: dm ? '#d1d5db' : '#6b7280', letterSpacing: '-0.03em' }}>ST</span>
                          </div>
                        ) : biz.coverUrl && biz.coverUrl !== TRANSPARENT_PIXEL ? (
                          <img src={biz.coverUrl} alt={biz.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                            style={{ objectPosition: 'center 25%' }} />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0L15 15m-1.5-1.5l1.159-1.159a2.25 2.25 0 013.182 0L21.75 16.5m-1.5-13.5h-15A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21h15a2.25 2.25 0 002.25-2.25V5.25A2.25 2.25 0 0020.25 3z" />
                            </svg>
                            <span className="text-[10px] font-semibold">No photos added</span>
                          </div>
                        )}
                        <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
                          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${listStatus.open ? 'bg-emerald-400' : 'bg-neutral-400'}`} />
                          <span className="text-[9px] font-bold text-white">{listStatus.label}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 py-1 flex flex-col gap-1.5">
                        <h3 className="font-bold text-[16px] leading-snug group-hover:text-accent transition-colors line-clamp-2" style={{ letterSpacing: '-0.02em', color: dm ? '#f3f4f6' : '#171717' }}>{biz.name || biz.category || 'Provider'}</h3>
                        {biz.preview_locked && <p className="text-[12px] font-medium -mt-0.5" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>Private until student verification</p>}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" data-pill style={pillStyle}>{biz.category}</span>
                          {formatPriceTierLabel(biz.price_tier) ? <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" data-pill style={pillStyle}>{formatPriceTierLabel(biz.price_tier)}</span> : null}
                          {shouldShowNewBadge({ createdAt: (biz as any).created_at, reviewCount: biz.reviews }) ? <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: dm ? 'rgba(251,191,36,0.18)' : '#fef3c7', color: dm ? '#f59e0b' : '#92400e' }}>New</span> : null}
                          <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: listStatus.open ? (dm ? 'rgba(52,211,153,0.15)' : '#f0fdf4') : (dm ? 'rgba(255,255,255,0.07)' : '#f5f5f5'), color: listStatus.open ? '#16a34a' : (dm ? '#6b7280' : '#9ca3af') }}>
                            <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${listStatus.open ? 'bg-emerald-500' : 'bg-neutral-400'}`} />{listStatus.label}
                          </span>
                        </div>
                        <p className="text-[13px]" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>{biz.distance}</p>
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-0.5">
                            {[1,2,3,4,5].map(i => (
                              <svg key={i} className={`h-3 w-3 ${i <= Math.round(biz.rating) ? 'text-amber-400' : (dm ? 'text-neutral-600' : 'text-neutral-200')}`} fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                          <span className="text-[13px] font-bold" style={{ color: dm ? '#d1d5db' : '#374151' }}>{biz.rating}</span>
                          <span className="text-[12px]" style={{ color: dm ? '#6b7280' : '#9ca3af' }}>({biz.reviews} reviews)</span>
                        </div>
                        {biz.tagline && (
                          <p className="text-[12px] leading-snug line-clamp-2" style={{ color: dm ? '#6b7280' : '#8e8e93' }}>{biz.tagline}</p>
                        )}
                      </div>
                    </button>
                    );
                  })}
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-8 mb-2">
                  <button onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={page === 1}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-30 disabled:cursor-not-allowed" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#e5e5e5', color: dm ? '#9ca3af' : '#525252' }}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="w-9 h-9 rounded-xl text-sm font-bold transition-all"
                      style={page === p ? { background: '#0F766E', color: 'white' } : { background: dm ? '#171717' : 'white', color: dm ? '#9ca3af' : '#6b7280', border: dm ? '1px solid #2a2d3a' : '1px solid #e5e7eb' }}>
                      {p}
                    </button>
                  ))}
                  <button onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={page === totalPages}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-30 disabled:cursor-not-allowed" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#e5e5e5', color: dm ? '#9ca3af' : '#525252' }}>
                    Next
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>
              )}
              {filtered.length > 0 && <div className="mt-5"><ReferInline /></div>}
            </>
          ) : !isLoggedIn ? (
            <div className="rounded-2xl border p-8 text-center" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#e5e7eb' }}>
              <p className="text-lg font-bold" style={{ color: dm ? '#f3f4f6' : '#111827' }}>Map view is locked</p>
              <p className="text-sm mt-2" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                Sign in to unlock exact map locations.
              </p>
              <button
                onClick={() => window.location.href = '/signin?next=/browse'}
                className="mt-4 px-4 py-2 rounded-xl text-sm font-bold"
                style={{ background: '#0F766E', color: 'white' }}
              >
                Sign in to view map
              </button>
            </div>
          ) : (
            <div className="flex flex-col animate-fade-up" style={{ animationDuration: '0.3s' }}>
              <div className="md:hidden relative rounded-2xl overflow-hidden border border-neutral-200 shadow-sm mb-4" style={{ height: 260 }}>
                <MapPlaceholder businesses={filtered} selected={selectedMapBiz} onSelect={(id) => setSelectedMapBiz(id)} dm={dm} userLat={userLat} userLng={userLng} />
              </div>
              <div className="md:hidden space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-accent/50 uppercase tracking-[0.14em]">{filtered.length} {filtered.length === 1 ? 'result' : 'results'}</p>
                  <p className="text-[11px] font-semibold" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>Nearby providers</p>
                </div>
                {mapPaginated.map((biz, i) => (
                  <button key={biz.id} ref={(el) => { mapListRefs.current[biz.id] = el; }} onClick={() => {
                    if (biz.preview_locked) return;
                    if (selectedMapBiz !== biz.id) { setSelectedMapBiz(biz.id); return; }
                    if (biz.slug || biz.realId || biz.id) window.location.href = '/biz/' + (biz.slug || biz.realId || biz.id);
                  }}
                    className="w-full text-left rounded-2xl border p-2.5 flex items-center gap-3 animate-fade-up"
                    style={{ animationDelay: `${i * 0.04}s`, background: dm ? '#171717' : 'white', borderColor: selectedMapBiz === biz.id ? '#0F766E' : (dm ? '#2a2d3a' : 'rgba(15,118,110,0.18)'), cursor: biz.preview_locked ? 'not-allowed' : 'pointer' }}>
                    <div className="relative overflow-hidden rounded-xl bg-neutral-100 flex-shrink-0" style={{ width: 80, height: 80 }}>
                      {biz.preview_locked ? (
                        <div className="absolute inset-0 flex items-center justify-center" style={{ background: dm ? '#30333f' : '#d1d5db' }}>
                          <span className="text-xl font-black" style={{ color: dm ? '#d1d5db' : '#6b7280', letterSpacing: '-0.03em' }}>ST</span>
                        </div>
                      ) : biz.coverUrl && biz.coverUrl !== TRANSPARENT_PIXEL ? (
                        <img src={biz.coverUrl} alt={biz.name} className="w-full h-full object-cover" style={{ objectPosition: 'center 25%' }} />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0L15 15m-1.5-1.5l1.159-1.159a2.25 2.25 0 013.182 0L21.75 16.5m-1.5-13.5h-15A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21h15a2.25 2.25 0 002.25-2.25V5.25A2.25 2.25 0 0020.25 3z" />
                          </svg>
                            <span className="text-[10px] font-semibold text-center leading-tight px-1">No photos added</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold leading-tight line-clamp-2" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{biz.name || biz.category || 'Provider'}</p>
                      {biz.preview_locked && <p className="text-[12px] font-medium mt-0.5" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>Private until student verification</p>}
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" data-pill style={pillStyle}>{biz.category}</span>
                        {formatPriceTierLabel(biz.price_tier) ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" data-pill style={pillStyle}>{formatPriceTierLabel(biz.price_tier)}</span> : null}
                        {shouldShowNewBadge({ createdAt: (biz as any).created_at, reviewCount: biz.reviews }) ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(251,191,36,0.18)' : '#fef3c7', color: dm ? '#f59e0b' : '#92400e' }}>New</span> : null}
                      </div>
                      <p className="text-[12px] mt-1" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>{biz.distance} · {biz.reviews} review{biz.reviews === 1 ? '' : 's'}</p>
                    </div>
                  </button>
                ))}
                {mapTotalPages > 1 && (
                  <div className="pt-1.5 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setMapPage((p) => Math.max(1, p - 1))}
                      disabled={mapPage === 1}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-40"
                      style={{ borderColor: dm ? '#2a2d3a' : '#d1d5db', color: dm ? '#d1d5db' : '#4b5563' }}
                    >
                      Prev
                    </button>
                    <p className="text-xs font-semibold" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                      Page {mapPage} / {mapTotalPages}
                    </p>
                    <button
                      onClick={() => setMapPage((p) => Math.min(mapTotalPages, p + 1))}
                      disabled={mapPage === mapTotalPages}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-40"
                      style={{ borderColor: dm ? '#2a2d3a' : '#d1d5db', color: dm ? '#d1d5db' : '#4b5563' }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
              <div className="hidden md:flex gap-4" style={{ height: 560 }}>
                <div className="w-72 flex-shrink-0 flex flex-col gap-2">
                  <div className="overflow-y-auto space-y-2 pr-1" style={{ scrollbarWidth: 'none', maxHeight: 560 }}>
                  {mapPaginated.map((biz, i) => (
                    <button key={biz.id} ref={(el) => { mapListRefs.current[biz.id] = el; }} onClick={() => { if (biz.preview_locked) return; setSelectedMapBiz(biz.id === selectedMapBiz ? null : biz.id); }}
                      className="w-full text-left flex gap-3 p-3 rounded-2xl border transition-all group"
                      style={{ opacity: selectedMapBiz && selectedMapBiz !== biz.id ? 0.35 : 1, transition: 'opacity 0.2s ease', borderColor: selectedMapBiz === biz.id ? '#0F766E' : (dm ? '#262626' : 'rgba(15,118,110,0.1)'), background: dm ? '#171717' : 'white', cursor: biz.preview_locked ? 'not-allowed' : 'pointer' }}>
                      <div className="relative flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 56, height: 56 }}>
                        {biz.preview_locked ? (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: dm ? '#30333f' : '#d1d5db' }}>
                            <span className="text-sm font-black" style={{ color: dm ? '#d1d5db' : '#6b7280', letterSpacing: '-0.03em' }}>ST</span>
                          </div>
                        ) : biz.coverUrl && biz.coverUrl !== TRANSPARENT_PIXEL ? (
                          <img src={biz.coverUrl} alt={biz.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1.5 gap-1" style={{ background: dm ? '#2c2c2e' : '#e5e7eb', color: dm ? '#9ca3af' : '#6b7280' }}>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0L15 15m-1.5-1.5l1.159-1.159a2.25 2.25 0 013.182 0L21.75 16.5m-1.5-13.5h-15A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21h15a2.25 2.25 0 002.25-2.25V5.25A2.25 2.25 0 0020.25 3z" />
                            </svg>
                            <span className="text-[9px] font-semibold leading-tight">No photos added</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{biz.name || biz.category || 'Provider'}</p>
                        <p className="text-xs" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>{biz.preview_locked ? 'Private until student verification' : biz.category}</p>
                        <p className="text-xs" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>{biz.distance}</p>
                      </div>
                    </button>
                  ))}
                  </div>
                  {mapTotalPages > 1 && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        onClick={() => setMapPage((p) => Math.max(1, p - 1))}
                        disabled={mapPage === 1}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-40"
                        style={{ borderColor: dm ? '#2a2d3a' : '#d1d5db', color: dm ? '#d1d5db' : '#4b5563' }}
                      >
                        Prev
                      </button>
                      <p className="text-xs font-semibold" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                        {mapPage} / {mapTotalPages}
                      </p>
                      <button
                        onClick={() => setMapPage((p) => Math.min(mapTotalPages, p + 1))}
                        disabled={mapPage === mapTotalPages}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-40"
                        style={{ borderColor: dm ? '#2a2d3a' : '#d1d5db', color: dm ? '#d1d5db' : '#4b5563' }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-3" style={{ flex: '1 1 0', minWidth: 0 }}>
                  <div className="relative rounded-2xl overflow-hidden border flex-1" style={{ borderColor: dm ? '#262626' : '#e5e7eb' }}>
                    <MapPlaceholder businesses={filtered} selected={selectedMapBiz} onSelect={(id) => setSelectedMapBiz(id)} dm={dm} userLat={userLat} userLng={userLng} />
                  </div>
                  {selectedMapBizData && (
                    <div className="rounded-2xl border p-3 flex items-center gap-3 animate-fade-up flex-shrink-0" style={{ background: dm ? '#171717' : 'white', borderColor: '#0F766E' }}>
                      {selectedMapBizData.coverUrl && selectedMapBizData.coverUrl !== TRANSPARENT_PIXEL ? (
                        <img src={selectedMapBizData.coverUrl} alt="" className="h-12 w-12 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: dm ? '#2c2c2e' : '#e5e7eb', color: dm ? '#9ca3af' : '#6b7280' }}>
                          <span className="text-[8px] font-semibold text-center leading-tight">No photos</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{selectedMapBizData.name || selectedMapBizData.category || 'Provider'}</p>
                        <p className="text-xs" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>{selectedMapBizData.category} · {selectedMapBizData.distance}</p>
                      </div>
                      <button onClick={() => setActiveBiz(selectedMapBizData)} className="text-sm font-bold px-4 py-2 rounded-xl flex-shrink-0" style={{ background: '#0F766E', color: 'white' }}>View</button>
                      <button onClick={() => setSelectedMapBiz(null)} className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: dm ? '#262626' : '#f5f5f5' }}>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: dm ? '#9ca3af' : '#6b7280' }}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showMapLoginPrompt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-5" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: dm ? '#171717' : 'white', border: dm ? '1px solid #262626' : '1px solid #e5e7eb' }}>
            <h2 className="text-base font-bold" style={{ color: dm ? '#f3f4f6' : '#111827' }}>Map view requires sign in</h2>
            <p className="text-sm mt-2" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
              Browse cards as a guest, then sign in for exact map locations and booking.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 py-2 rounded-xl text-sm font-semibold"
                style={{ background: dm ? '#262626' : '#f3f4f6', color: dm ? '#d1d5db' : '#374151' }}
                onClick={() => setShowMapLoginPrompt(false)}
              >
                Not now
              </button>
              <button
                className="flex-1 py-2 rounded-xl text-sm font-bold"
                style={{ background: '#0F766E', color: 'white' }}
                onClick={() => { window.location.href = '/signin?next=/browse'; }}
              >
                Sign in
              </button>
            </div>
          </div>
        </div>
      )}
      {activeBiz && <BusinessProfile biz={activeBiz} onClose={() => setActiveBiz(null)} />}
    </>
  );
};

export default BrowsePage;
