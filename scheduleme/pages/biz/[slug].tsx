// @ts-nocheck
// pages/biz/[slug].tsx — DoorDash-style business profile
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getSupabaseClient } from '../../lib/supabaseClient';
import Nav from '../../components/Nav';
import { useDm } from '../../lib/DarkModeContext';
import { averagePriceCents, computePriceTier } from '../../lib/priceTier';
import { issuePaymentAccessTicket } from '../../lib/paymentAccess';
import { shouldShowNewBadge } from '../../lib/newBadge';
import { isProviderPubliclyVisible } from '../../lib/providerTrust';

function getSB() {
  return getSupabaseClient();
}

const DEFAULT_TIME_SLOTS = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];

function parseSlotMinutes(slot: string): number {
  const m = slot.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!m) return Number.NaN;
  let h = parseInt(m[1]);
  const mn = parseInt(m[2]);
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + mn;
}

function formatSlotMinutes(mins: number): string {
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  if (h > 12) h -= 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ap}`;
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildScheduledStart(date: Date, slot: string): string | null {
  const mins = parseSlotMinutes(slot);
  if (Number.isNaN(mins)) return null;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toISOString();
}

type HourEntry = { day: string; time: string };

function normalizeHours(hours: HourEntry[] | Record<string, string> | undefined): HourEntry[] {
  if (!hours) return [];
  if (Array.isArray(hours)) return hours;
  const out: HourEntry[] = [];
  for (const [day, time] of Object.entries(hours)) {
    if (typeof time === 'string' && time.trim()) out.push({ day, time });
  }
  return out;
}

const FULL_DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_ABBREV_TO_FULL: Record<string, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  thur: 'Thursday',
  thurs: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

function normalizeDayNameToken(input: string): string {
  const raw = String(input || '').trim().toLowerCase().replace(/\./g, '');
  if (!raw) return '';
  if (DAY_ABBREV_TO_FULL[raw]) return DAY_ABBREV_TO_FULL[raw];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function dayPatternMatchesDate(pattern: string, date: Date): boolean {
  const dayName = FULL_DAY_NAMES[date.getDay()];
  const normalizedPattern = String(pattern || '').trim();
  if (!normalizedPattern) return false;

  const lower = normalizedPattern.toLowerCase();
  if (lower.includes('daily') || lower.includes('every day')) return true;

  const rangeMatch = normalizedPattern.match(/(.+?)\s*(?:–|—|-|\bto\b)\s*(.+)/i);
  if (rangeMatch) {
    const startName = normalizeDayNameToken(rangeMatch[1]);
    const endName = normalizeDayNameToken(rangeMatch[2]);
    const s = FULL_DAY_NAMES.indexOf(startName);
    const e = FULL_DAY_NAMES.indexOf(endName);
    const d = FULL_DAY_NAMES.indexOf(dayName);
    if (s >= 0 && e >= 0 && d >= 0) {
      return s <= e ? (d >= s && d <= e) : (d >= s || d <= e);
    }
  }

  const tokens = normalizedPattern.split(/[,&/]/).map((t) => normalizeDayNameToken(t)).filter(Boolean);
  if (tokens.some((t) => t === dayName)) return true;

  const patternLower = normalizedPattern.toLowerCase();
  const fullLower = dayName.toLowerCase();
  const shortLower = fullLower.slice(0, 3);
  return patternLower.includes(fullLower) || patternLower.includes(shortLower);
}

function parseTimeTokenToMinutes(token: string): number | null {
  const v = String(token || '').trim();
  if (!v) return null;

  // 12-hour with minutes: 8:30 AM
  let m = v.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const mins = parseInt(m[2], 10);
    const ap = m[3].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h * 60 + mins;
  }

  // 12-hour no minutes: 9 AM
  m = v.match(/^(\d{1,2})\s*(AM|PM)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const ap = m[2].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h * 60;
  }

  // 24-hour: 17:30
  m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = parseInt(m[1], 10);
    const mins = parseInt(m[2], 10);
    if (h >= 0 && h <= 23 && mins >= 0 && mins <= 59) return h * 60 + mins;
  }

  return null;
}

function getHoursForDate(hoursInput: HourEntry[] | Record<string, string> | undefined, date: Date): { open: number; close: number } | null {
  const hours = normalizeHours(hoursInput);
  if (!hours.length) return null;
  let sawNonClosedMatch = false;
  for (const h of hours) {
    if (!dayPatternMatchesDate(h.day, date)) continue;
    const timeRaw = String(h.time || '').trim();
    if (!timeRaw) continue;
    const lower = timeRaw.toLowerCase();
    if (lower.includes('closed')) continue;

    sawNonClosedMatch = true;
    if (lower === 'by appointment') return { open: 8 * 60, close: 20 * 60 };
    if (lower === '24 hours' || lower === '24hrs' || lower === '24 hr') return { open: 0, close: 24 * 60 };

    const parts = timeRaw.split(/\s*(?:–|—|-|\bto\b)\s*/i).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const open = parseTimeTokenToMinutes(parts[0]);
      const close = parseTimeTokenToMinutes(parts[1]);
      if (open !== null && close !== null && close > open) return { open, close };
    }
  }
  // Provider configured this day but used a non-standard format.
  // Keep booking flow available with sane daytime defaults instead of blocking all dates.
  if (sawNonClosedMatch) return { open: 8 * 60, close: 20 * 60 };
  return null;
}

function getSlotsForDate(hoursInput: HourEntry[] | Record<string, string> | undefined, date: Date): string[] {
  const dh = getHoursForDate(hoursInput, date);
  if (!dh) return DEFAULT_TIME_SLOTS;
  const slots: string[] = [];
  const interval = 60;
  for (let m = dh.open; m < dh.close; m += interval) {
    slots.push(formatSlotMinutes(m));
  }
  return slots.length ? slots : DEFAULT_TIME_SLOTS;
}

function MiniCalendar({ selected, onSelect, bookedDates, hours, dm }: { selected: Date | null; onSelect: (d: Date) => void; bookedDates?: Set<string>; hours?: HourEntry[] | Record<string, string>; dm: boolean; }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [vm, setVm] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const y = vm.getFullYear(), m = vm.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (Date | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7) cells.push(null);
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setVm(new Date(y, m - 1, 1))}
          className="h-7 w-7 rounded-full flex items-center justify-center transition-colors" style={{ color: dm ? '#9ca3af' : '#737373', background: dm ? 'transparent' : undefined }} type="button">
          <svg className="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/></svg>
        </button>
        <p className="text-sm font-bold" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{MONTHS[m]} {y}</p>
        <button onClick={() => setVm(new Date(y, m + 1, 1))}
          className="h-7 w-7 rounded-full flex items-center justify-center transition-colors" style={{ color: dm ? '#9ca3af' : '#737373', background: dm ? 'transparent' : undefined }} type="button">
          <svg className="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => <div key={d} className="text-center text-[10px] font-bold py-1" style={{ color: dm ? 'rgba(255,255,255,0.35)' : '#a3a3a3' }}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const isPast = date < today;
          const dateKey = localDateKey(date);
          const isFullyBooked = bookedDates?.has(dateKey);
          const norm = normalizeHours(hours);
          const hasHours = norm.length ? !!getHoursForDate(norm, date) : true;
          const isSelected = selected && date.toDateString() === selected.toDateString();
          const disabled = isPast || isFullyBooked || !hasHours;
          return (
            <button key={i} type="button" onClick={() => !disabled && onSelect(date)}
              className="h-8 w-8 rounded-full text-[11px] font-semibold transition-colors"
              style={isSelected
                ? { background: '#007e6d', color: 'white' }
                : disabled
                  ? { color: dm ? 'rgba(255,255,255,0.2)' : '#d1d5db' }
                  : { color: dm ? '#d1d5db' : '#404040' }}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-neutral-300"/><span className="text-[10px]" style={{color:dm?'#9ca3af':'#8e8e93'}}>Closed</span></div>
        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400"/><span className="text-[10px]" style={{color:dm?'#9ca3af':'#8e8e93'}}>Fully booked</span></div>
        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-neutral-300"/><span className="text-[10px]" style={{color:dm?'#9ca3af':'#8e8e93'}}>Past date</span></div>
      </div>
    </div>
  );
}

export default function BizPage() {
  const router = useRouter();
  const { slug } = router.query;
  const slugValue = Array.isArray(slug) ? slug[0] : slug;
  const bidQuery = router.query?.bid;
  const businessIdFromQuery = Array.isArray(bidQuery) ? bidQuery[0] : bidQuery;
  const fromQuery = router.query?.from;
  const fromParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('from') : null;
  const previewQuery = router.query?.preview;
  const previewParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('preview') : null;
  const embeddedQuery = router.query?.embedded;
  const embeddedParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('embedded') : null;
  const allowEditInBiz =
    fromQuery === 'dashboard' ||
    (Array.isArray(fromQuery) && fromQuery.includes('dashboard')) ||
    fromParam === 'dashboard';
  const isPreview =
    allowEditInBiz ||
    previewQuery === '1' ||
    (Array.isArray(previewQuery) && previewQuery.includes('1')) ||
    previewParam === '1';
  const isEmbedded =
    embeddedQuery === '1' ||
    (Array.isArray(embeddedQuery) && embeddedQuery.includes('1')) ||
    embeddedParam === '1';
  const isDashboardEmbed = allowEditInBiz && isEmbedded;
  const hideNav = isPreview;
  const [biz, setBiz] = useState(null);
  const [services, setServices] = useState([]);
  const [draftServices, setDraftServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSvc, setSelectedSvc] = useState(null);
  const isCustom = selectedSvc?.id === '__custom__';
  const { dm } = useDm();
  const [note, setNote] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [customServiceName, setCustomServiceName] = useState('');
  const [customProposedPrice, setCustomProposedPrice] = useState('');
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [eduGateModal, setEduGateModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [err, setErr] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [viewerEduVerified, setViewerEduVerified] = useState(false);
  const [viewerSchoolDomain, setViewerSchoolDomain] = useState<string | null>(null);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editVideo, setEditVideo] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [computedPriceTier, setComputedPriceTier] = useState<number | null>(null);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaErr, setMediaErr] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [svcDrafts, setSvcDrafts] = useState<Record<string, any>>({});
  const [newSvc, setNewSvc] = useState({ name: '', price: '', duration: '60', description: '' });
  const [showNewServiceComposer, setShowNewServiceComposer] = useState(false);
  const [savingAllEdits, setSavingAllEdits] = useState(false);
  const [deletedServiceIds, setDeletedServiceIds] = useState<string[]>([]);
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const vidInputRef = useRef<HTMLInputElement | null>(null);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const galleryTouchStart = useRef<{ x: number; y: number } | null>(null);
  const lightboxTouchStart = useRef<{ x: number; y: number } | null>(null);

  const bizSchoolDomain = biz?.school_domain ? String(biz.school_domain).toLowerCase() : null;
  const bizCampusKey = biz?.campus_key ? String(biz.campus_key).toLowerCase() : null;
  const normalizeDomain = (v?: string | null) => v ? String(v).toLowerCase().trim() : null;
  const viewerDomain = normalizeDomain(viewerSchoolDomain);
  const normalizedBizKey = bizCampusKey ? bizCampusKey.replace(/[^a-z0-9.]/g, '') : null;
  const normalizedViewer = viewerDomain ? viewerDomain.replace(/[^a-z0-9.]/g, '') : null;
  const sameCampus = !!(viewerDomain && (viewerDomain === bizSchoolDomain || viewerDomain === bizCampusKey || (normalizedBizKey && normalizedViewer && (normalizedViewer === normalizedBizKey || normalizedViewer.replace('.edu','') === normalizedBizKey))));
  const isOwnerViewing = !!(biz?.owner_email && viewerEmail && biz.owner_email === viewerEmail);
  const ownerDisplayName = biz
    ? (isOwnerViewing
        ? biz.owner_name
        : (viewerEduVerified && sameCampus
            ? (biz.campus_show_name ? biz.owner_name : '')
            : (biz.public_visibility && biz.public_show_name ? biz.owner_name : '')))
    : '';
  const titleName = biz?.name || 'ScheduleMe Provider';

  useEffect(() => {
    if (!router.isReady) return;

    const resolvedSlug = typeof slugValue === 'string' ? decodeURIComponent(slugValue) : '';
    const resolvedBusinessId = typeof businessIdFromQuery === 'string' ? businessIdFromQuery : '';
    if (!resolvedSlug && !resolvedBusinessId) {
      setLoading(false);
      return;
    }

    const loadBusiness = async () => {
      try {
        let data: any = null;
        if (resolvedSlug) {
          const { data: bySlug } = await getSB()
            .from('businesses')
            .select('*')
            .eq('slug', resolvedSlug)
            .eq('is_onboarded', true)
            .maybeSingle();
          data = bySlug;
        }

        if (!data && resolvedBusinessId) {
          const { data: byId } = await getSB()
            .from('businesses')
            .select('*')
            .eq('id', resolvedBusinessId)
            .eq('is_onboarded', true)
            .maybeSingle();
          data = byId;
        }

        if (data && !isPreview && !isProviderPubliclyVisible(data)) data = null;

        if (!data) {
          if (!isPreview) router.replace('/browse');
          setLoading(false);
          return;
        }

        setBiz(data);
        setEditDesc(data.description || '');
        const initialImages = [data.cover_url, ...(data.media_urls || [])].filter(Boolean) as string[];
        setEditImages(normalizeImageList(initialImages));
        setEditVideo(data.video_url || null);
        (async () => {
          try {
            const { data: { session } } = await getSB().auth.getSession();
            if (!session) return;
            const { data: profile } = await getSB()
              .from('profiles')
              .select('edu_verified, school_domain, school_email')
              .eq('id', session.user.id)
              .maybeSingle();
            setViewerUserId(session.user.id || null);
            setViewerEmail(session.user.email || null);
            setViewerEduVerified(profile?.edu_verified === true);
            const emailDomain = profile?.school_email?.includes('@') ? profile.school_email.split('@').pop() : null;
            setViewerSchoolDomain(profile?.school_domain ? String(profile.school_domain).toLowerCase() : (emailDomain ? String(emailDomain).toLowerCase() : null));
            const { data: fav } = await getSB()
              .from('favorites')
              .select('id')
              .eq('user_id', session.user.id)
              .eq('business_id', data.id)
              .maybeSingle();
            setIsFavorited(!!fav);
            if (session.user?.email && data.owner_email && session.user.email === data.owner_email) {
              setCanEdit(true);
              if (router.query?.edit === '1' && allowEditInBiz) {
                setEditMode(isDashboardEmbed ? false : true);
              } else if (router.query?.edit === '1' && !allowEditInBiz) {
                showToast('Edit your listing in the business dashboard.');
                setEditMode(false);
                router.replace('/business/dashboard#edit');
              }
            } else if (router.query?.edit === '1') {
              showToast('Edit your listing in the business dashboard.');
              router.replace('/business/dashboard#edit');
            }
          } catch {}
        })();
        fetch('/api/services?business_id=' + data.id)
          .then(r => r.json())
          .then(d => {
            const svc = d.services || [];
            setServices(svc);
            setDraftServices(svc.map((item: any) => ({ ...item })));
            const prices = svc.map((s: any) => Number(s.price_cents || s.price || 0));
            const avg = averagePriceCents(prices);
            const primaryTag = Array.isArray(data.service_tags) ? data.service_tags[0] : null;
            setComputedPriceTier(computePriceTier(avg, primaryTag));
          })
          .catch(() => {});
      } finally {
        setLoading(false);
      }
    };

    loadBusiness();
  }, [router.isReady, slugValue, businessIdFromQuery, isPreview, isDashboardEmbed]);

  useEffect(() => {
    if (!biz?.id) return;
    setReviewsLoading(true);
    fetch('/api/reviews?business_id=' + biz.id)
      .then(r => r.json())
      .then(d => setReviews(d.reviews || []))
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }, [biz?.id]);

  useEffect(() => {
    if (!canEdit && editMode) setEditMode(false);
  }, [canEdit]);

  useEffect(() => {
    if (!isDashboardEmbed || typeof window === 'undefined') return;
    function notifyParent() {
      window.parent?.postMessage(
        { type: 'scheduleme-dashboard-preview-state', editMode },
        window.location.origin
      );
    }
    notifyParent();
  }, [isDashboardEmbed, editMode]);

  useEffect(() => {
    if (!isDashboardEmbed || typeof window === 'undefined') return;
    async function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (typeof event.data !== 'object' || event.data === null) return;
      if (event.data?.type !== 'scheduleme-dashboard-preview-action') return;
      if (event.data.action === 'enter-edit') {
        resetEmbeddedDrafts();
        setEditMode(true);
        return;
      }
      if (event.data.action === 'cancel-edit') {
        await cancelEmbeddedEditing();
        return;
      }
      if (event.data.action === 'save-edit') {
        await saveEmbeddedEditing();
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [isDashboardEmbed, biz, services, editDesc, editImages, editVideo, draftServices, deletedServiceIds]);

  useEffect(() => {
    if (!biz?.id) return;
    setLoadingSlots(true);
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    fetch(`/api/business-booked-slots?business_id=${biz.id}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
    }).then(r => r.json()).then(payload => {
      const rows = payload?.rows || [];
      const slots = new Set<string>();
      const dateCounts: Record<string, number> = {};
      for (const row of rows || []) {
        const scheduledAt = row.scheduled_start || row.scheduled_end;
        if (!scheduledAt) continue;
        const d = new Date(scheduledAt);
        const dk = localDateKey(d);
        const mins = d.getHours() * 60 + d.getMinutes();
        const slotsForDate = getSlotsForDate(biz.hours, d);
        const matched = slotsForDate.find(s => Math.abs(parseSlotMinutes(s) - mins) < 30);
        if (matched) slots.add(dk + '|' + matched);
        dateCounts[dk] = (dateCounts[dk] || 0) + 1;
      }
      setBookedSlots(slots);
      const full = new Set<string>();
      for (const [dk, cnt] of Object.entries(dateCounts)) {
        const [yy, mm, dd] = dk.split('-').map((v) => Number(v));
        const slotsForDate = getSlotsForDate(biz.hours, new Date(yy, (mm || 1) - 1, dd || 1));
        if (cnt >= slotsForDate.length && slotsForDate.length > 0) full.add(dk);
      }
      setBookedDates(full);
    }).catch(() => {}).finally(() => setLoadingSlots(false));
  }, [biz?.id]);

  async function getAuthHeaders() {
    const { data: { session } } = await getSB().auth.getSession();
    if (!session) return null;
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
  }

  async function submitChangeRequest(changes: Record<string, any>, requestType?: string) {
    if (!biz) return;
    const headers = await getAuthHeaders();
    if (!headers) throw new Error('Sign in required');
    const res = await fetch('/api/business-change-requests', {
      method: 'POST',
      headers,
      body: JSON.stringify({ business_id: biz.id, changes, request_type: requestType || 'profile' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to submit changes');
    return data;
  }

  async function saveDashboardListing(changes: Record<string, any>) {
    if (!biz) return;
    const headers = await getAuthHeaders();
    if (!headers) throw new Error('Sign in required');
    const res = await fetch('/api/provider-live-edit', {
      method: 'POST',
      headers,
      body: JSON.stringify({ business_id: biz.id, changes }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to save listing');
    return data;
  }

  function normalizeImageList(images: string[]) {
    const next: string[] = [];
    for (const url of images) {
      if (!url || next.includes(url)) continue;
      next.push(url);
    }
    return next;
  }

  function resetEmbeddedDrafts(nextBiz: any = biz, nextServices: any[] = services) {
    if (!nextBiz) return;
    setEditDesc(nextBiz.description || '');
    const initialImages = [nextBiz.cover_url, ...(nextBiz.media_urls || [])].filter(Boolean) as string[];
    setEditImages(normalizeImageList(initialImages));
    setEditVideo(nextBiz.video_url || null);
    setDraftServices((nextServices || []).map((svc: any) => ({ ...svc })));
    setSvcDrafts({});
    setDeletedServiceIds([]);
    setNewSvc({ name: '', price: '', duration: '60', description: '' });
    setShowNewServiceComposer(false);
    setMediaErr('');
    setErr('');
    setEditNotice(null);
  }

  async function uploadMedia(file: File, type: 'image' | 'video') {
    if (!biz) return;
    setMediaErr('');
    setMediaUploading(true);
    try {
      if (type === 'image' && !file.type.startsWith('image/')) {
        setMediaErr('Please upload an image file.');
        return;
      }
      if (type === 'video' && !file.type.startsWith('video/')) {
        setMediaErr('Please upload a video file.');
        return;
      }
      const maxBytes = type === 'video' ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
      if (file.size > maxBytes) {
        setMediaErr(type === 'video' ? 'Video must be 50MB or less.' : 'Image must be 8MB or less.');
        return;
      }
      if (type === 'image' && editImages.length >= 8) {
        setMediaErr('Limit reached: 8 photos max.');
        return;
      }
      if (type === 'video' && editVideo) {
        setMediaErr('Limit reached: 1 video max.');
        return;
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const headers = await getAuthHeaders();
      if (!headers) { setMediaErr('Sign in required'); return; }
      const res = await fetch('/api/upload-media', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          business_id: biz.id,
          media_type: type,
          file_data: base64,
          file_type: file.type,
          file_name: file.name || (type === 'video' ? 'video.mp4' : 'photo.jpg'),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMediaErr(data.error || 'Upload failed'); return; }
      if (type === 'video') {
        setEditVideo(data.url);
        if (isDashboardEmbed) {
          await saveDashboardListing({ video_url: data.url });
          setBiz((prev: any) => prev ? { ...prev, video_url: data.url } : prev);
          setEditNotice('Video updated.');
        } else {
          await submitChangeRequest({ video_url: data.url }, 'media');
          setEditNotice('Video submitted for review.');
        }
      } else if (data.url) {
        const next = normalizeImageList([...editImages, data.url]);
        setEditImages(next);
        if (isDashboardEmbed) {
          await saveDashboardListing({ cover_url: next[0] || null, media_urls: next.slice(1) });
          setBiz((prev: any) => prev ? { ...prev, cover_url: next[0] || null, media_urls: next.slice(1) } : prev);
          setEditNotice('Photos updated.');
        } else {
          await submitChangeRequest({ cover_url: next[0] || null, media_urls: next.slice(1) }, 'media');
          setEditNotice('Photos submitted for review.');
        }
      }
    } catch (e: any) {
      setMediaErr(e?.message || 'Upload failed');
    } finally {
      setMediaUploading(false);
    }
  }

  async function persistImages(next: string[]) {
    if (!biz) return;
    const normalized = normalizeImageList(next);
    setEditImages(normalized);
    try {
      if (isDashboardEmbed) {
        await saveDashboardListing({ cover_url: normalized[0] || null, media_urls: normalized.slice(1) });
        setBiz((prev: any) => prev ? { ...prev, cover_url: normalized[0] || null, media_urls: normalized.slice(1) } : prev);
        setEditNotice('Photos updated.');
      } else {
        await submitChangeRequest({ cover_url: normalized[0] || null, media_urls: normalized.slice(1) }, 'media');
        setEditNotice('Photos submitted for review.');
      }
    } catch (e: any) {
      setMediaErr(e?.message || 'Failed to update photos');
    }
  }

  function onDragStart(i: number) { setDragIdx(i); }
  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const next = [...editImages];
    const [m] = next.splice(dragIdx, 1);
    next.splice(i, 0, m);
    setEditImages(next);
    setDragIdx(i);
  }
  async function onDragEnd() { setDragIdx(null); await persistImages(editImages); }

  async function removeImage(i: number) {
    const next = editImages.filter((_, idx) => idx !== i);
    await persistImages(next);
  }

  async function removeVideo() {
    if (!biz) return;
    setEditVideo(null);
    try {
      if (isDashboardEmbed) {
        await saveDashboardListing({ video_url: null });
        setBiz((prev: any) => prev ? { ...prev, video_url: null } : prev);
        setEditNotice('Video removed.');
      } else {
        await submitChangeRequest({ video_url: null }, 'media');
        setEditNotice('Video removal submitted for review.');
      }
    } catch (e: any) {
      setMediaErr(e?.message || 'Failed to update video');
    }
  }

  async function saveDescription() {
    if (!biz) return;
    setEditSaving(true);
    try {
      if (isDashboardEmbed) {
        await saveDashboardListing({ description: editDesc });
        setBiz((prev: any) => prev ? { ...prev, description: editDesc } : prev);
        setEditNotice('Description updated.');
      } else {
        await submitChangeRequest({ description: editDesc }, 'profile');
        setEditNotice('Description submitted for review.');
      }
    } catch (e: any) {
      setEditNotice(e?.message || 'Failed to submit description');
    } finally {
      setEditSaving(false);
      setTimeout(() => setEditNotice(null), 2500);
    }
  }

  function startEditService(s: any) {
    setSvcDrafts((prev) => ({
      ...prev,
      [s.id]: {
        id: s.id,
        name: s.name || '',
        description: s.description || '',
        price: s.price_cents ? (s.price_cents / 100).toFixed(2) : '',
        duration: s.duration_min ? String(s.duration_min) : '60',
      },
    }));
  }

  function updateSvcDraft(id: string, field: string, value: string) {
    setSvcDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function saveService(id: string) {
    const d = svcDrafts[id];
    if (!biz || !d) return;
    if (isDashboardEmbed && editMode) {
      const price = Math.round(parseFloat(d.price || '0') * 100);
      setDraftServices((prev: any[]) => prev.map((s) => (
        s.id === id
          ? { ...s, name: d.name, description: d.description, price_cents: price, duration_min: Number(d.duration || 60) }
          : s
      )));
      setSvcDrafts((prev) => { const copy = { ...prev }; delete copy[id]; return copy; });
      return;
    }
    const headers = await getAuthHeaders();
    if (!headers) return;
    const price = Math.round(parseFloat(d.price || '0') * 100);
    const res = await fetch('/api/services', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        id,
        business_id: biz.id,
        name: d.name,
        description: d.description,
        price_cents: price,
        duration_min: Number(d.duration || 60),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data.error || 'Failed to update service'); return; }
    setServices((prev: any[]) => prev.map((s) => (s.id === id ? data.service : s)));
    setSvcDrafts((prev) => { const copy = { ...prev }; delete copy[id]; return copy; });
  }

  async function deleteService(id: string) {
    if (!biz) return;
    if (isDashboardEmbed && editMode) {
      if (!String(id).startsWith('draft-')) {
        setDeletedServiceIds((prev) => prev.includes(id) ? prev : [...prev, id]);
      }
      setDraftServices((prev: any[]) => prev.filter((s) => s.id !== id));
      setSvcDrafts((prev) => { const copy = { ...prev }; delete copy[id]; return copy; });
      return;
    }
    const headers = await getAuthHeaders();
    if (!headers) return;
    await fetch('/api/services', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ id, business_id: biz.id }),
    });
    setServices((prev: any[]) => prev.filter((s) => s.id !== id));
    setSvcDrafts((prev) => { const copy = { ...prev }; delete copy[id]; return copy; });
  }

  async function addService() {
    if (!biz) return;
    const name = newSvc.name.trim();
    const priceCents = Math.round(parseFloat(newSvc.price || '0') * 100);
    if (!name || !priceCents) { setErr('Add a name and price'); return; }
    if (isDashboardEmbed && editMode) {
      setDraftServices((prev: any[]) => [
        ...prev,
        {
          id: `draft-${Date.now()}`,
          name,
          description: newSvc.description || '',
          price_cents: priceCents,
          duration_min: Number(newSvc.duration || 60),
          sort_order: prev.length,
          requires_time: true,
        },
      ]);
      setNewSvc({ name: '', price: '', duration: '60', description: '' });
      setShowNewServiceComposer(false);
      return;
    }
    const headers = await getAuthHeaders();
    if (!headers) return;
    const maxOrder = services.reduce((max: number, s: any) => Math.max(max, s.sort_order ?? 0), -1);
    const res = await fetch('/api/services', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        business_id: biz.id,
        name,
        description: newSvc.description || '',
        price_cents: priceCents,
        duration_min: Number(newSvc.duration || 60),
        sort_order: maxOrder + 1,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data.error || 'Failed to add service'); return; }
    setServices((prev: any[]) => [...prev, data.service]);
    setNewSvc({ name: '', price: '', duration: '60', description: '' });
  }

  async function book() {
    if (isPreview) { setErr('Preview mode — booking disabled.'); return; }
    if (editMode) { setErr('Exit edit mode to book'); return; }
    const { data: { session } } = await getSB().auth.getSession();
    if (!session) { router.push('/signin?next=/biz/' + slug); return; }
    if ((biz?.owner_id && biz.owner_id === session.user.id) || ((biz?.owner_email || '').toLowerCase().trim() === (session.user.email || '').toLowerCase().trim())) {
      setErr('You cannot book your own business.');
      return;
    }
    if (!selectedSvc) { setErr('Select a service to continue.'); return; }
    if (!date || (requiresTime && !slot)) { setErr(requiresTime ? 'Pick a date and time' : 'Pick a due date'); return; }
    if (isCustom && !customServiceName.trim()) { setErr('Name the service you need.'); return; }
    if (isCustom && !note.trim()) { setErr('Please describe your custom request.'); return; }
    if (requiresTime && date && slot) {
      const dateKey = localDateKey(date);
      if (bookedSlots.has(dateKey + '|' + slot)) {
        setErr('That time slot was just booked. Please choose another time.');
        return;
      }
    }
    const proposedRaw = customProposedPrice.trim();
    let proposedPriceCents: number | null = null;
    if (isCustom && proposedRaw.length > 0) {
      const parsedCents = parseInt(proposedRaw, 10);
      if (!Number.isFinite(parsedCents) || parsedCents < 500) { setErr('Minimum proposed price is $5.00 or leave blank.'); return; }
      proposedPriceCents = parsedCents;
    }

    if (!biz?.stripe_onboarded || !biz?.stripe_account_id) { setErr('This provider can’t accept payments yet.'); return; }
    const isPaidService = !isCustom;
    if (isPaidService && !selectedSvc?.price_cents) { setErr('Please select a priced service to book.'); return; }

    setSubmitting(true); setErr('');
    const scheduled_start = requiresTime ? buildScheduledStart(date, slot) : null;
    const scheduled_end = requiresTime
      ? null
      : (() => { const due = new Date(date); due.setHours(12, 0, 0, 0); return due.toISOString(); })();
    const metaFirst = String(session.user.user_metadata?.first_name || '').trim();
    const metaLast = String(session.user.user_metadata?.last_name || '').trim();
    const metaName =
      String(session.user.user_metadata?.full_name || '').trim() ||
      String(session.user.user_metadata?.name || '').trim() ||
      `${metaFirst} ${metaLast}`.trim();
    let d: any = null;
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({
          business_id: biz.id,
          service: isCustom ? customServiceName.trim() : (selectedSvc?.name || 'Service'),
          service_price_cents: isPaidService ? selectedSvc?.price_cents : null,
          customer_proposed_price_cents: isCustom ? proposedPriceCents : null,
          note,
          scheduled_start,
          scheduled_end,
          user_id: session.user.id,
          user_email: session.user.email,
          user_name: metaName || null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (d?.code === 'edu_verification_required' || d?.code === 'campus_match_required') {
          setEduGateModal({ open: true, message: d.error || 'Verify your .edu email to continue.' });
        } else {
          setErr(d.error || 'Booking failed');
        }
        setSubmitting(false);
        return;
      }
    } catch (e) {
      setErr('Booking failed. Please try again.');
      setSubmitting(false);
      return;
    }

    const bookingId = d?.booking?.id;
    if (!bookingId) { setErr('Booking created but payment could not start.'); setSubmitting(false); return; }

    if (!isPaidService) {
      setSubmitting(false);
      setDone(true);
      setShowConfirm(true);
      return;
    }

    setSubmitting(false);
    issuePaymentAccessTicket(bookingId);
    router.push(`/pay/${bookingId}`);
    return;
  }

  const bg = dm ? '#0a0a0a' : '#f6f2e9';
  const accent = '#007e6d';
  const accentDark = '#1e554c';
  const accentWash = dm ? 'rgba(0,126,109,0.2)' : 'rgba(0,126,109,0.12)';
  const accentBorder = dm ? 'rgba(0,126,109,0.35)' : 'rgba(0,126,109,0.25)';
  const card = dm ? '#1c1c1e' : '#fcfbf8';
  const bdr = dm ? '#2c2c2e' : '#e6ded2';
  const tx = dm ? '#f2f2f7' : '#111';
  const mu = dm ? '#8e8e93' : '#6b7280';

  useEffect(() => {
    if (!biz) return;
    const baseImgs = [biz.cover_url, ...(biz.media_urls || [])].filter(Boolean);
    const activeImgs = editMode ? (editImages.length ? editImages : baseImgs) : baseImgs;
    if (galleryIdx >= activeImgs.length) setGalleryIdx(0);
  }, [biz, editMode, editImages, galleryIdx]);

  if (loading) return (
    <>
      <Head><title>Loading — ScheduleMe</title></Head>
      <div style={{ background: bg, minHeight: '100vh' }}>
        {!hideNav && <Nav />}
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 rounded-full border-2 border-accent/25 border-t-accent animate-spin" />
            <p className="mt-3 text-sm" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
              {isPreview ? 'Loading live preview…' : 'Loading provider page…'}
            </p>
          </div>
        </div>
      </div>
    </>
  );
  if (!biz) return (
    <>
      <Head><title>Preview Unavailable — ScheduleMe</title></Head>
      <div style={{ background: bg, minHeight: '100vh' }}>
        {!hideNav && <Nav />}
        <div className="min-h-[60vh] flex items-center justify-center px-6">
          <div className="max-w-md w-full rounded-2xl border p-5 text-center" style={{ borderColor: dm ? '#2c2c2e' : '#e5e7eb', background: dm ? '#111111' : '#ffffff' }}>
            <p className="text-sm font-bold" style={{ color: dm ? '#f3f4f6' : '#111827' }}>Preview unavailable</p>
            <p className="text-xs mt-1" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
              We could not load this provider listing. Refresh the dashboard and try again.
            </p>
          </div>
        </div>
      </div>
    </>
  );

  const tags = biz.service_tags || [];
  const cat = tags.length > 0 ? tags[0].charAt(0).toUpperCase() + tags[0].slice(1).replace(/_/g,' ') : 'Service';
  const baseImgs = Array.from(new Set([biz.cover_url, ...(biz.media_urls || [])].filter(Boolean)))
    .filter((u) => !String(u).match(/\.(mp4|mov|webm|m4v)$/i));
  const imgs = editMode ? (editImages.length ? editImages : baseImgs) : baseImgs;

  const requiresTime = isCustom ? (biz?.custom_requires_time !== false) : (selectedSvc?.requires_time !== false);
  const customProposedCents = isCustom && customProposedPrice
    ? Number.parseInt(customProposedPrice, 10)
    : 0;
  const customPriceTooLow = isCustom && customProposedPrice.length > 0 && (!Number.isFinite(customProposedCents) || customProposedCents < 500);
  const providerCannotAcceptPayments = !biz?.stripe_onboarded || !biz?.stripe_account_id;
  const isSelfOwnedBusiness = !!(
    (biz?.owner_id && viewerUserId && biz.owner_id === viewerUserId) ||
    (biz?.owner_email && viewerEmail && String(biz.owner_email).toLowerCase().trim() === String(viewerEmail).toLowerCase().trim())
  );
  const guestNeedsAuth = !isPreview && !viewerUserId;
  const authRedirect = '/signin?next=' + encodeURIComponent('/biz/' + slug);
  const bookingDisabled =
    !date
    || (requiresTime && !slot)
    || submitting
    || done
    || (isCustom && (!customServiceName.trim() || !note.trim() || customPriceTooLow))
    || isPreview
    || guestNeedsAuth
    || isSelfOwnedBusiness
    || providerCannotAcceptPayments;
  const bookingCtaLabel = submitting
    ? 'Booking…'
    : guestNeedsAuth
      ? 'Confirm booking'
      : (selectedSvc
        ? (isCustom
            ? (requiresTime ? 'Request Custom Service' : 'Request by date')
            : (requiresTime ? 'Book ' + selectedSvc.name + ' — $' + (selectedSvc.price_cents / 100).toFixed(2) : 'Book by date'))
        : 'Confirm booking');

  const availableSlots = date && requiresTime ? (() => {
    const dk = localDateKey(date);
    const dh = getHoursForDate(biz.hours, date);
    const now = new Date();
    const isToday = now.toDateString() === date.toDateString();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const slotsForDate = getSlotsForDate(biz.hours, date);
    return slotsForDate.map(s => ({
      slot: s,
      booked: bookedSlots.has(dk + '|' + s),
      outside: dh ? (parseSlotMinutes(s) < dh.open || parseSlotMinutes(s) >= dh.close) : false,
      past: isToday && parseSlotMinutes(s) <= nowMins,
    }));
  })() : [];

  async function shareBusiness() {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    setShareUrl(url);
    setShareCopied(false);
    const title = titleName;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${titleName} on ScheduleMe`, url });
        return;
      }
    } catch {}
    setShareOpen(true);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  function goPrevImage() {
    setGalleryIdx((i) => (i - 1 + imgs.length) % imgs.length);
  }

  function goNextImage() {
    setGalleryIdx((i) => (i + 1) % imgs.length);
  }

  const servicesForDisplay = editMode && isDashboardEmbed ? draftServices : services;
  const orderedServices = [...servicesForDisplay].sort((a: any, b: any) => {
    const ao = a.sort_order ?? 0;
    const bo = b.sort_order ?? 0;
    if (ao !== bo) return ao - bo;
    const an = a.name || '';
    const bn = b.name || '';
    return an.localeCompare(bn);
  });

  async function moveService(id: string, dir: -1 | 1) {
    const idx = orderedServices.findIndex((s: any) => s.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= orderedServices.length) return;
    const a = orderedServices[idx];
    const b = orderedServices[swapIdx];
    if (isDashboardEmbed && editMode) {
      const next = [...orderedServices];
      const [moved] = next.splice(idx, 1);
      next.splice(swapIdx, 0, moved);
      setDraftServices(next.map((svc: any, order: number) => ({ ...svc, sort_order: order })));
      return;
    }
    const headers = await getAuthHeaders();
    if (!headers) return;
    const aOrder = a.sort_order ?? idx;
    const bOrder = b.sort_order ?? swapIdx;
    await fetch('/api/services', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ id: a.id, business_id: biz.id, sort_order: bOrder }),
    });
    await fetch('/api/services', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ id: b.id, business_id: biz.id, sort_order: aOrder }),
    });
    setServices((prev: any[]) =>
      prev.map((s) =>
        s.id === a.id ? { ...s, sort_order: bOrder } :
        s.id === b.id ? { ...s, sort_order: aOrder } : s
      )
    );
  }

  async function cancelEmbeddedEditing() {
    if (!biz) return;
    resetEmbeddedDrafts();
    setEditMode(false);
  }

  async function saveEmbeddedEditing() {
    if (!biz) return;
    setSavingAllEdits(true);
    setErr('');
    setMediaErr('');
    try {
      if ((editDesc || '') !== (biz.description || '')) {
        if (isDashboardEmbed) {
          await saveDashboardListing({ description: editDesc });
        } else {
          await submitChangeRequest({ description: editDesc }, 'profile');
        }
      }

      const originalImages = normalizeImageList([biz.cover_url, ...(biz.media_urls || [])].filter(Boolean) as string[]);
      const nextImages = normalizeImageList(editImages);
      const mediaChanged =
        JSON.stringify(originalImages) !== JSON.stringify(nextImages) ||
        (biz.video_url || null) !== (editVideo || null);
      if (mediaChanged) {
        if (isDashboardEmbed) {
          await saveDashboardListing({
            cover_url: nextImages[0] || null,
            media_urls: nextImages.slice(1),
            video_url: editVideo || null,
          });
        } else {
          await submitChangeRequest({
            cover_url: nextImages[0] || null,
            media_urls: nextImages.slice(1),
            video_url: editVideo || null,
          }, 'media');
        }
      }

      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Sign in required');

      for (const id of deletedServiceIds) {
        await fetch('/api/services', {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ id, business_id: biz.id }),
        });
      }

      const originalMap = new Map((services || []).map((svc: any) => [svc.id, svc]));
      for (let index = 0; index < draftServices.length; index += 1) {
        const svc: any = draftServices[index];
        const payload = {
          business_id: biz.id,
          name: svc.name,
          description: svc.description || '',
          price_cents: Number(svc.price_cents || 0),
          duration_min: Number(svc.duration_min || 60),
          sort_order: index,
        };
        if (String(svc.id).startsWith('draft-')) {
          await fetch('/api/services', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          });
          continue;
        }
        const original = originalMap.get(svc.id);
        const changed =
          !original ||
          original.name !== payload.name ||
          (original.description || '') !== payload.description ||
          Number(original.price_cents || 0) !== payload.price_cents ||
          Number(original.duration_min || 60) !== payload.duration_min ||
          Number(original.sort_order || 0) !== payload.sort_order;
        if (changed) {
          await fetch('/api/services', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ id: svc.id, ...payload }),
          });
        }
      }

      const refreshed = await fetch('/api/services?business_id=' + biz.id).then((r) => r.json()).catch(() => null);
      const nextServices = refreshed?.services || draftServices;
      setServices(nextServices);
      setDraftServices(nextServices.map((svc: any) => ({ ...svc })));
      setBiz((prev: any) => prev ? {
        ...prev,
        description: editDesc,
        cover_url: nextImages[0] || null,
        media_urls: nextImages.slice(1),
        video_url: editVideo || null,
      } : prev);
      setEditMode(false);
      setDeletedServiceIds([]);
      setShowNewServiceComposer(false);
      setEditNotice('Listing updates saved.');
      setTimeout(() => setEditNotice(null), 2500);
    } catch (e: any) {
      setErr(e?.message || 'Failed to save changes');
    } finally {
      setSavingAllEdits(false);
    }
  }

  async function toggleFavorite() {
    if (!biz?.id) return;
    const { data: { session } } = await getSB().auth.getSession();
    if (!session) {
      router.push('/signin?next=/biz/' + slug);
      return;
    }
    try {
      const supabase = getSB();
      const { data: existing } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('business_id', biz.id)
        .maybeSingle();
      if (existing?.id) {
        await supabase.from('favorites').delete().eq('id', existing.id);
        setIsFavorited(false);
        showToast('Removed from pinned');
      } else {
        await supabase.from('favorites').insert({ user_id: session.user.id, business_id: biz.id });
        setIsFavorited(true);
        showToast('Pinned for later');
      }
    } catch {}
  }

  return (
    <>
      <Head><title>{titleName} — ScheduleMe</title><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" /></Head>
      <div style={{background:bg,minHeight:'100vh',paddingBottom: hideNav ? (isEmbedded ? 40 : 100) : 136}}>
        {!hideNav && <Nav />}
        {shareOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={() => setShareOpen(false)}>
            <div className="w-full max-w-md rounded-2xl p-5" style={{ background: card, border: '1px solid '+bdr }} onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-bold" style={{ color: tx }}>Share this business</p>
                  <p className="text-xs" style={{ color: mu }}>Copy the link below.</p>
                </div>
                <button onClick={() => setShareOpen(false)} className="text-xs font-semibold" style={{ color: mu }}>Close</button>
              </div>
              <div className="flex items-center gap-2">
                <input readOnly value={shareUrl} className="flex-1 text-xs px-3 py-2 rounded-xl" style={{ background: dm ? '#0d0d0d' : '#f9fafb', border: '1px solid '+bdr, color: tx }} />
                <button
                  onClick={async () => {
                    try {
                      if (navigator.clipboard && shareUrl) {
                        await navigator.clipboard.writeText(shareUrl);
                        setShareCopied(true);
                        showToast('Link copied');
                      }
                    } catch {}
                  }}
                  className="text-xs font-semibold px-3 py-2 rounded-xl" style={{ background: accentWash, border: '1px solid '+accentBorder, color: accent }}
                >
                  {shareCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        )}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] px-4 py-2 rounded-full text-xs font-semibold" style={{ background: dm ? '#0f172a' : '#111827', color: 'white', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            {toast}
          </div>
        )}
        {eduGateModal.open && (
          <div className="fixed inset-0 z-[10002] flex items-center justify-center px-5" style={{ background: 'rgba(0,0,0,0.55)' }}>
            <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: card, border: '1px solid ' + bdr }}>
              <h2 className="text-base font-bold" style={{ color: tx }}>Action requires .edu verification</h2>
              <p className="text-sm mt-2" style={{ color: mu }}>{eduGateModal.message}</p>
              <div className="mt-4 flex gap-2">
                <button
                  className="flex-1 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: dm ? '#262626' : '#f3f4f6', color: dm ? '#d1d5db' : '#374151' }}
                  onClick={() => setEduGateModal({ open: false, message: '' })}
                >
                  Close
                </button>
                <button
                  className="flex-1 py-2 rounded-xl text-sm font-bold"
                  style={{ background: accent, color: 'white' }}
                  onClick={() => router.push('/account')}
                >
                  Verify .edu
                </button>
              </div>
            </div>
          </div>
        )}
        {galleryOpen && imgs.length > 0 && (
          <div className="fixed inset-0 z-[10001] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }}>
            <button className="absolute top-6 right-6 h-10 w-10 rounded-full flex items-center justify-center text-white" onClick={() => setGalleryOpen(false)} style={{ background: 'rgba(0,0,0,0.4)' }}>×</button>
            {imgs.length > 1 && (
              <button className="absolute left-6 h-10 w-10 rounded-full flex items-center justify-center text-white" onClick={goPrevImage} style={{ background: 'rgba(0,0,0,0.4)' }}>
                ‹
              </button>
            )}
            <img
              src={imgs[galleryIdx]}
              alt="Gallery"
              className="max-h-[80vh] max-w-[90vw] rounded-2xl object-contain"
              onTouchStart={(e) => {
                const t = e.touches[0];
                lightboxTouchStart.current = { x: t.clientX, y: t.clientY };
              }}
              onTouchEnd={(e) => {
                if (!lightboxTouchStart.current || imgs.length <= 1) return;
                const t = e.changedTouches[0];
                const dx = t.clientX - lightboxTouchStart.current.x;
                const dy = t.clientY - lightboxTouchStart.current.y;
                lightboxTouchStart.current = null;
                if (Math.abs(dx) < 36 || Math.abs(dx) <= Math.abs(dy)) return;
                if (dx < 0) goNextImage();
                else goPrevImage();
              }}
            />
            {imgs.length > 1 && (
              <button className="absolute right-6 h-10 w-10 rounded-full flex items-center justify-center text-white" onClick={goNextImage} style={{ background: 'rgba(0,0,0,0.4)' }}>
                ›
              </button>
            )}
          </div>
        )}
        {!isEmbedded && (
          <div className="relative" style={{ height: 450, background: bg }}>
            <div className="relative h-full w-full mx-auto flex items-center justify-center" style={{ maxWidth: 980, paddingTop: 26, paddingBottom: 6 }}>
              <div className="relative flex items-center justify-center w-full" style={{ maxWidth: 800 }}>
                {imgs[galleryIdx] && (
                  <img
                    src={imgs[galleryIdx]}
                    alt={biz?.name || 'Provider'}
                    className="object-contain rounded-2xl"
                    style={{ maxHeight: 320, maxWidth: '100%' }}
                    onClick={() => imgs.length > 0 && setGalleryOpen(true)}
                    onTouchStart={(e) => {
                      const t = e.touches[0];
                      galleryTouchStart.current = { x: t.clientX, y: t.clientY };
                    }}
                    onTouchEnd={(e) => {
                      if (!galleryTouchStart.current || imgs.length <= 1) return;
                      const t = e.changedTouches[0];
                      const dx = t.clientX - galleryTouchStart.current.x;
                      const dy = t.clientY - galleryTouchStart.current.y;
                      galleryTouchStart.current = null;
                      if (Math.abs(dx) < 30 || Math.abs(dx) <= Math.abs(dy)) return;
                      if (dx < 0) goNextImage();
                      else goPrevImage();
                    }}
                  />
                )}
                {(biz as any).founder50 && !['paused','revoked'].includes(String((biz as any).founder50_status || '')) && (
                  <div
                    className="absolute right-4 top-4 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
                    style={{
                      background: 'rgba(0,0,0,0.55)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.18)',
                      backdropFilter: 'blur(6px)',
                    }}
                  >
                    Founder50
                  </div>
                )}
                {imgs.length > 1 && (
                  <>
                    <button
                      onClick={goPrevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full flex items-center justify-center text-white leading-none"
                      style={{ background: 'rgba(0,0,0,0.35)' }}
                    >
                      <svg className="h-8 w-8 block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                    <button
                      onClick={goNextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full flex items-center justify-center text-white leading-none"
                      style={{ background: 'rgba(0,0,0,0.35)' }}
                    >
                      <svg className="h-8 w-8 block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
            {!isPreview && (
              <button onClick={()=>router.back()} className="absolute top-4 left-4 flex items-center justify-center rounded-full" style={{width:36,height:36,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(8px)'}}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/></svg>
              </button>
            )}
          </div>
        )}
        <div className="mx-auto max-w-2xl px-4" style={{ paddingTop: isEmbedded ? 20 : 0 }}>
          {isEmbedded && (
            <div className="rounded-2xl p-4 shadow-lg mb-4" style={{ background: card, border: '1px solid ' + bdr }}>
              <div className="flex items-start gap-4">
                <div className="h-24 w-24 rounded-2xl overflow-hidden shrink-0" style={{ background: dm ? '#111' : '#f3f4f6', border: '1px solid ' + bdr }}>
                  {imgs[galleryIdx] ? (
                    <img src={imgs[galleryIdx]} alt={biz?.name || 'Provider'} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs font-semibold" style={{ color: mu }}>No photo</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-1" style={{ color: mu }}>Live Preview</p>
                  <h1 className="text-xl font-bold" style={{ color: tx }}>{biz.name}</h1>
                  {ownerDisplayName ? (
                    <p className="text-sm mt-1" style={{ color: mu }}>{ownerDisplayName}</p>
                  ) : null}
                  <div className="flex gap-2 flex-wrap mt-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:accentWash,border:'1px solid '+accentBorder,color:accent}}>{cat}</span>
                    {(computedPriceTier ?? biz.price_tier) ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:accentWash,border:'1px solid '+accentBorder,color:accent}}>
                        {'$'.repeat(computedPriceTier ?? biz.price_tier)}
                      </span>
                    ) : null}
                    {(biz.review_count ?? 0) > 0 && biz.rating && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: mu }}>
                        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.19 3.66a1 1 0 00.95.69h3.848c.969 0 1.371 1.24.588 1.81l-3.113 2.262a1 1 0 00-.364 1.118l1.19 3.66c.3.922-.755 1.688-1.539 1.118L10 14.347l-3.111 2.26c-.784.57-1.838-.196-1.539-1.118l1.19-3.66a1 1 0 00-.364-1.118L3.063 9.087c-.783-.57-.38-1.81.588-1.81h3.848a1 1 0 00.95-.69l1.19-3.66z" />
                        </svg>
                        {parseFloat(biz.rating).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {isEmbedded && (
            <div className="rounded-2xl p-4 shadow-lg mb-5 relative z-20" style={{ background: card, border: '1px solid ' + bdr }}>
              <div
                className="relative overflow-hidden rounded-2xl"
                style={{ background: dm ? '#101010' : '#f6f2e9', minHeight: 240 }}
                onDragOver={(e) => {
                  if (!editMode) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!editMode) return;
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) uploadMedia(file, file.type.startsWith('video/') ? 'video' : 'image');
                }}
              >
                {imgs[galleryIdx] ? (
                  <img
                    src={imgs[galleryIdx]}
                    alt={biz?.name || 'Provider'}
                    className="w-full object-cover"
                    style={{ minHeight: 240, maxHeight: 320 }}
                  />
                ) : (
                  <div className="flex items-center justify-center text-sm font-semibold" style={{ minHeight: 240, color: mu }}>
                    No photos yet
                  </div>
                )}
                {imgs.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={goPrevImage}
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full flex items-center justify-center text-white"
                      style={{ background: 'rgba(0,0,0,0.38)' }}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={goNextImage}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full flex items-center justify-center text-white"
                      style={{ background: 'rgba(0,0,0,0.38)' }}
                    >
                      ›
                    </button>
                  </>
                )}
              </div>
              {(imgs.length > 1 || editMode) && (
                <div className="flex gap-2 overflow-x-auto pt-3">
                  {imgs.map((url, i) => (
                    <div
                      key={url}
                      draggable={editMode}
                      onDragStart={() => editMode && onDragStart(i)}
                      onDragOver={(e) => editMode && onDragOver(e, i)}
                      onDragEnd={() => editMode && onDragEnd()}
                      className="relative h-16 w-16 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 border p-1"
                      style={{ borderColor: i === galleryIdx ? '#10b981' : (dm ? '#2c2c2e' : '#e5e7eb'), background: dm ? '#121212' : '#f8fafc', opacity: dragIdx === i ? 0.5 : 1, cursor: editMode ? 'grab' : 'pointer' }}
                    >
                      <button
                        type="button"
                        onClick={() => setGalleryIdx(i)}
                        className="absolute inset-0"
                        aria-label={`Open media ${i + 1}`}
                      />
                      <img src={url} alt="" className="max-h-full max-w-full object-contain pointer-events-none" />
                      {editMode && i === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 text-center text-[8px] font-bold py-0.5" style={{ background: 'rgba(0,126,109,0.85)', color: 'white' }}>COVER</div>
                      )}
                      {editMode && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                          className="absolute top-1 right-1 h-6 w-6 rounded-lg flex items-center justify-center text-[14px] font-bold shadow-sm"
                          style={{ background: 'rgba(15,23,42,0.86)', color: 'white', border: '1px solid rgba(255,255,255,0.16)' }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {editMode && (
                    <button
                      type="button"
                      onClick={() => imgInputRef.current?.click()}
                      className="relative h-16 w-16 rounded-xl flex-shrink-0 border border-dashed flex items-center justify-center text-center p-2"
                      style={{ borderColor: dm ? '#2d2d2f' : '#b8ddd4', background: dm ? '#0c0c0d' : '#f5fbf8', color: tx }}
                      aria-label="Add photos or videos"
                    >
                      <span className="text-[28px] font-medium leading-none" style={{ color: '#007e6d' }}>+</span>
                    </button>
                  )}
                </div>
              )}
              {editMode && (
                <>
                  <div className="mt-4">
                    <div className="mb-2">
                      <p className="text-sm font-bold" style={{ color: tx }}>Photos & video</p>
                      <p className="text-xs" style={{ color: mu }}>Click the add-media tile or drag files anywhere in this media section. Reorder photos below to change the cover.</p>
                    </div>
                    {mediaErr && <p className="text-xs text-red-500 mb-2">{mediaErr}</p>}
                    {mediaUploading && <p className="text-xs mb-2" style={{ color: mu }}>Uploading…</p>}
                    {editVideo && (
                      <div className="mt-3 flex items-center justify-between rounded-xl px-3 py-2" style={{ border: '1px solid ' + bdr, background: dm ? '#0d0d0d' : '#f9fafb' }}>
                        <p className="text-xs font-semibold" style={{ color: tx }}>Video added</p>
                        <button onClick={removeVideo} className="text-xs font-semibold" style={{ color: '#ef4444' }}>Remove</button>
                      </div>
                    )}
                  </div>
                  <input
                    ref={imgInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadMedia(file, file.type.startsWith('video/') ? 'video' : 'image');
                      if (e.target) e.target.value = '';
                    }}
                  />
                  <input
                    ref={vidInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadMedia(file, 'video');
                      if (e.target) e.target.value = '';
                    }}
                  />
                </>
              )}
            </div>
          )}
          <div className="rounded-2xl p-5 shadow-lg mt-0.5 relative z-10 mb-5" style={{background:card,border:'1px solid '+bdr}}>
            <button
              onClick={toggleFavorite}
              className="absolute top-3 right-3 h-9 w-9 rounded-full flex items-center justify-center"
              style={{ background: isFavorited ? 'rgba(16,185,129,0.18)' : (dm ? 'rgba(255,255,255,0.08)' : '#f3f4f6'), border: '1px solid ' + (isFavorited ? 'rgba(16,185,129,0.45)' : bdr) }}
              title={isFavorited ? 'Pinned' : 'Pin'}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke={isFavorited ? '#10b981' : (dm ? '#d1d5db' : '#6b7280')} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 4l6 6-3 3 1 4-4-1-3 3-6-6 3-3-1-4 4 1 3-3z" />
                <path d="M9 15l-5 5" />
              </svg>
            </button>
            <div className="flex items-start justify-between gap-4 mb-2 pr-12">
              <div>
                <h1 className="text-xl font-bold" style={{color:tx,letterSpacing:'-0.02em'}}>{biz.name}</h1>
              </div>
            </div>
            {ownerDisplayName ? (
              <p className="text-sm font-semibold mb-2" style={{ color: dm ? '#d1d5db' : '#4b5563' }}>
                {ownerDisplayName}
              </p>
            ) : null}
            <div className="flex gap-2 flex-wrap mb-3">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:accentWash,border:'1px solid '+accentBorder,color:accent}}>{cat}</span>
              {(computedPriceTier ?? biz.price_tier) ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:accentWash,border:'1px solid '+accentBorder,color:accent}}>
                  {'$'.repeat(computedPriceTier ?? biz.price_tier)}
                </span>
              ) : null}
              {shouldShowNewBadge({ createdAt: biz.created_at, reviewCount: biz.review_count }) && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:dm ? 'rgba(251,191,36,0.18)' : '#fef3c7', color: dm ? '#f59e0b' : '#92400e' }}>New</span>
              )}
              {(biz.review_count ?? 0) > 0 && biz.rating && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: mu }}>
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.19 3.66a1 1 0 00.95.69h3.848c.969 0 1.371 1.24.588 1.81l-3.113 2.262a1 1 0 00-.364 1.118l1.19 3.66c.3.922-.755 1.688-1.539 1.118L10 14.347l-3.111 2.26c-.784.57-1.838-.196-1.539-1.118l1.19-3.66a1 1 0 00-.364-1.118L3.063 9.087c-.783-.57-.38-1.81.588-1.81h3.848a1 1 0 00.95-.69l1.19-3.66z" />
                  </svg>
                  {parseFloat(biz.rating).toFixed(1)}
                </span>
              )}
            </div>
            {editMode ? (
              <div className="mb-4">
                <label className="block text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: mu }}>Description</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{ border: '1px solid ' + bdr, background: dm ? '#0d0d0d' : '#f9fafb', color: tx }}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px]" style={{ color: mu }}>{editDesc.length}/1000</span>
                  {isDashboardEmbed && <span className="text-[11px]" style={{ color: mu }}>Saved when you click Save changes.</span>}
                </div>
              </div>
            ) : (
              biz.description && <p className="text-sm leading-relaxed mb-4" style={{color:mu}}>{biz.description}</p>
            )}
            {editNotice && (
              <div className="mb-4 text-[11px] font-semibold" style={{ color: accent }}>{editNotice}</div>
            )}
            <div className="flex gap-2 flex-wrap">
              <button onClick={isPreview ? undefined : shareBusiness} className="text-sm font-medium px-3 py-1.5 rounded-xl" style={{background:accentWash,border:'1px solid '+accentBorder,color:accent,opacity:isPreview?0.6:1}} disabled={isPreview}>Share</button>
              {biz.website && (
                isPreview ? (
                  <span className="text-sm font-medium px-3 py-1.5 rounded-xl" style={{background:accentWash,border:'1px solid '+accentBorder,color:accent,opacity:0.6}}>Website</span>
                ) : (
                  <a href={biz.website.startsWith('http')?biz.website:'https://'+biz.website} target="_blank" rel="noreferrer" className="text-sm font-medium px-3 py-1.5 rounded-xl" style={{background:accentWash,border:'1px solid '+accentBorder,color:accent}}>Website</a>
                )
              )}
            </div>
          </div>
          <h2 className="text-lg font-bold mb-3" style={{color:tx}}>Services</h2>
          <div className="flex flex-col gap-3 mb-5">
            {orderedServices.length === 0 && <div className="rounded-2xl p-5 text-center" style={{background:card,border:'1px solid '+bdr}}><p className="text-sm" style={{color:mu}}>No services listed yet</p></div>}
            {orderedServices.map(s => {
              const draft = svcDrafts[s.id];
              if (editMode) {
                return (
                  <div key={s.id} className="w-full rounded-2xl p-4" style={{ background: card, border: '1.5px solid ' + bdr }}>
                    {draft ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 gap-2">
                          <input value={draft.name} onChange={(e) => updateSvcDraft(s.id, 'name', e.target.value)} placeholder="Service name"
                            className="w-full rounded-xl px-3 py-2 text-sm" style={{ border: '1px solid ' + bdr, background: dm ? '#0d0d0d' : '#f9fafb', color: tx }} />
                          <textarea value={draft.description} onChange={(e) => updateSvcDraft(s.id, 'description', e.target.value)} rows={2} placeholder="Description"
                            className="w-full rounded-xl px-3 py-2 text-sm" style={{ border: '1px solid ' + bdr, background: dm ? '#0d0d0d' : '#f9fafb', color: tx }} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input value={draft.price} onChange={(e) => updateSvcDraft(s.id, 'price', e.target.value)} placeholder="Price (e.g. 25)"
                            className="w-full rounded-xl px-3 py-2 text-sm" style={{ border: '1px solid ' + bdr, background: dm ? '#0d0d0d' : '#f9fafb', color: tx }} />
                          <input value={draft.duration} onChange={(e) => updateSvcDraft(s.id, 'duration', e.target.value)} placeholder="Minutes"
                            className="w-full rounded-xl px-3 py-2 text-sm" style={{ border: '1px solid ' + bdr, background: dm ? '#0d0d0d' : '#f9fafb', color: tx }} />
                        </div>
                        <div className="flex items-center justify-between">
                          <button onClick={() => saveService(s.id)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                            style={{ background: accentWash, border: '1px solid ' + accentBorder, color: accent }}>
                            Save
                          </button>
                          <button onClick={() => setSvcDrafts((prev) => { const copy = { ...prev }; delete copy[s.id]; return copy; })}
                            className="text-xs font-semibold" style={{ color: mu }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold" style={{ color: tx }}>{s.name}</p>
                          {s.description && <p className="text-sm mt-0.5" style={{ color: mu }}>{s.description}</p>}
                          <p className="text-xs mt-1" style={{ color: mu }}>{s.duration_min} min</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg" style={{ color: accent }}>{'$' + (s.price_cents / 100).toFixed(2)}</p>
                          <div className="flex items-center gap-2 mt-2 justify-end">
                            <button onClick={() => moveService(s.id, -1)} className="text-xs font-semibold" style={{ color: mu }}>Up</button>
                            <button onClick={() => moveService(s.id, 1)} className="text-xs font-semibold" style={{ color: mu }}>Down</button>
                            <button onClick={() => startEditService(s)} className="text-xs font-semibold" style={{ color: accent }}>Edit</button>
                            <button onClick={() => deleteService(s.id)} className="text-xs font-semibold" style={{ color: '#ef4444' }}>Delete</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <button key={s.id} onClick={()=>{setSelectedSvc(s);}} className="w-full text-left rounded-2xl p-4" style={{background:selectedSvc?.id===s.id?(dm?'rgba(0,126,109,0.2)':'rgba(0,126,109,0.08)'):card,border:'1.5px solid '+(selectedSvc?.id===s.id?'#007e6d':bdr)}}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold" style={{color:tx}}>{s.name}</p>
                      {s.description && <p className="text-sm mt-0.5" style={{color:mu}}>{s.description}</p>}
                      <p className="text-xs mt-1" style={{color:mu}}>{s.duration_min} min</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold text-lg" style={{color:accent}}>{'$'+(s.price_cents/100).toFixed(2)}</p>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{background:accent}}>Book</span>
                    </div>
                  </div>
                </button>
              );
            })}
            {editMode ? (
              <div className="w-full rounded-2xl p-4" style={{ background: card, border: '1.5px dashed ' + bdr }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold" style={{ color: tx }}>Add new service</p>
                    <p className="text-xs mt-1" style={{ color: mu }}>Start collapsed so the live preview stays clean until you need it.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewServiceComposer((prev) => !prev)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                    style={{ background: accentWash, border: '1px solid ' + accentBorder, color: accent }}
                  >
                    {showNewServiceComposer ? 'Close' : 'Add service'}
                  </button>
                </div>
                {showNewServiceComposer && (
                  <>
                    <div className="grid grid-cols-1 gap-2 mt-3">
                      <input value={newSvc.name} onChange={(e) => setNewSvc((p) => ({ ...p, name: e.target.value }))} placeholder="Service name"
                        className="w-full rounded-xl px-3 py-2 text-sm" style={{ border: '1px solid ' + bdr, background: dm ? '#0d0d0d' : '#f9fafb', color: tx }} />
                      <textarea value={newSvc.description} onChange={(e) => setNewSvc((p) => ({ ...p, description: e.target.value }))} rows={2} placeholder="Description"
                        className="w-full rounded-xl px-3 py-2 text-sm" style={{ border: '1px solid ' + bdr, background: dm ? '#0d0d0d' : '#f9fafb', color: tx }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <input value={newSvc.price} onChange={(e) => setNewSvc((p) => ({ ...p, price: e.target.value }))} placeholder="Price (e.g. 25)"
                        className="w-full rounded-xl px-3 py-2 text-sm" style={{ border: '1px solid ' + bdr, background: dm ? '#0d0d0d' : '#f9fafb', color: tx }} />
                      <input value={newSvc.duration} onChange={(e) => setNewSvc((p) => ({ ...p, duration: e.target.value }))} placeholder="Minutes"
                        className="w-full rounded-xl px-3 py-2 text-sm" style={{ border: '1px solid ' + bdr, background: dm ? '#0d0d0d' : '#f9fafb', color: tx }} />
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-[11px]" style={{ color: mu }}>
                        {isDashboardEmbed ? 'This saves when you click Save changes.' : 'This will appear immediately on your listing.'}
                      </span>
                      <button onClick={addService}
                        className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                        style={{ background: accentWash, border: '1px solid ' + accentBorder, color: accent }}>
                        Add service
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <button onClick={()=>{setSelectedSvc({ id: '__custom__', name: 'Custom Request' });}} className="w-full text-left rounded-2xl p-4" style={{background:isCustom?(dm?'rgba(0,126,109,0.2)':'rgba(0,126,109,0.08)'):card,border:'1.5px dashed '+(isCustom?'#007e6d':bdr)}}>
                  <p className="font-semibold text-sm" style={{color:tx}}>Custom Request</p>
                  <p className="text-xs mt-0.5" style={{color:mu}}>Name the service you need — it will show up in bookings and messages.</p>
                </button>
                {isCustom && (
                  <div className="rounded-2xl p-4" style={{background:card,border:'1px solid '+bdr}}>
                    <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: dm ? 'rgba(255,255,255,0.4)' : '#737373' }}>Name the service you need</label>
                    <div className="relative">
                      <input value={customServiceName} maxLength={40} onChange={e => setCustomServiceName(e.target.value)} placeholder="e.g. 3D printed dragon model" className="w-full rounded-xl px-4 py-3 text-sm outline-none" style={{background:dm?'#0d0d0d':'#f9fafb',color:tx,border:'1.5px solid '+bdr}} />
                      <span className="absolute bottom-2 right-3 text-[10px]" style={{ color: dm ? '#9ca3af' : '#9ca3af' }}>{customServiceName.length}/40</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <div className="flex items-center rounded-xl border overflow-hidden" style={{ borderColor: bdr, background: dm ? '#0d0d0d' : '#f9fafb' }}>
                        <span className="px-3 text-sm font-semibold" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>$</span>
                        <input
                          value={customProposedPrice ? (Number(customProposedPrice) / 100).toFixed(2) : ''}
                          onChange={(e) => {
                            const digits = (e.target.value || '').replace(/[^\d]/g, '').slice(0, 7);
                            setCustomProposedPrice(digits);
                          }}
                          placeholder="0.00"
                          inputMode="numeric"
                          type="text"
                          className="py-2 pr-3 text-sm outline-none bg-transparent"
                          style={{ color: tx }}
                        />
                      </div>
                      <span className="text-[11px]" style={{ color: mu }}>Leave blank to let the provider set the price.</span>
                    </div>
                    {customPriceTooLow && (
                      <p className="text-[11px] mt-2 text-red-500 font-semibold">
                        Minimum custom proposed price is $5.00.
                      </p>
                    )}
                    <p className="text-[11px] mt-2" style={{color:mu}}>This name appears in your messages and bookings.</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <h2 className="text-lg font-bold mb-3" style={{color:tx}}>Reviews</h2>
          <div className="flex flex-col gap-3 mb-5">
            {reviewsLoading && (
              <div className="rounded-2xl p-5 text-center" style={{background:card,border:'1px solid '+bdr}}>
                <p className="text-sm" style={{color:mu}}>Loading reviews…</p>
              </div>
            )}
            {!reviewsLoading && reviews.length === 0 && (
              <div className="rounded-2xl p-5 text-center" style={{background:card,border:'1px solid '+bdr}}>
                <p className="text-sm" style={{color:mu}}>No reviews yet</p>
              </div>
            )}
            {reviews.map((r: any) => (
              <div key={r.id} className="rounded-2xl p-4" style={{background:card,border:'1px solid '+bdr}}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full overflow-hidden border" style={{borderColor:bdr}}>
                      {r.profiles?.avatar_url
                        ? <img src={r.profiles.avatar_url} alt={r.profiles?.name || 'User'} className="h-full w-full object-cover" />
                        : <div className="h-full w-full flex items-center justify-center text-xs font-bold" style={{background:accentWash,color:accent}}>{(r.profiles?.name || 'U').charAt(0).toUpperCase()}</div>}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{color:tx}}>{r.profiles?.name || 'Customer'}</p>
                      <p className="text-[11px]" style={{color:mu}}>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="text-xs font-bold" style={{color:accent}}>{'★'.repeat(r.rating || 0)}</div>
                </div>
                {r.comment && <p className="text-sm leading-relaxed mb-2" style={{color:mu}}>{r.comment}</p>}
                {Array.isArray(r.image_urls) && r.image_urls.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {r.image_urls.map((u: string) => (
                      <img key={u} src={u} alt="Review" className="h-20 w-20 rounded-xl object-cover border" style={{borderColor:bdr}} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {normalizeHours(biz.hours).length > 0 && <>
            <h2 className="text-lg font-bold mb-3" style={{color:tx}}>Hours</h2>
            <div className="rounded-2xl overflow-hidden mb-5" style={{background:card,border:'1px solid '+bdr}}>
              {normalizeHours(biz.hours).map((h,i,arr) => <div key={i} className="flex justify-between px-4 py-3" style={{borderBottom:i<arr.length-1?'1px solid '+bdr:'none'}}><span className="text-sm font-medium" style={{color:tx}}>{h.day}</span><span className="text-sm" style={{color:mu}}>{h.time}</span></div>)}
            </div>
          </>}
        <div className="rounded-2xl p-5 mb-8" style={{background:card,border:'1px solid '+bdr}}>
          <h2 className="text-lg font-bold mb-3" style={{color:tx}}>Book Appointment</h2>
          {isPreview && (
            <div className="mb-3 text-xs font-semibold px-3 py-2 rounded-xl" style={{ background: dm ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: dm ? '#e5e7eb' : '#4b5563', border: '1px solid ' + bdr }}>
              Preview mode — booking is disabled in the live preview.
            </div>
          )}
          {!requiresTime && (
            <div className="mb-3 text-xs font-semibold px-3 py-2 rounded-xl" style={{ background: dm ? '#0f172a' : '#ecfeff', color: dm ? '#e5e7eb' : '#0f766e', border: '1px solid ' + bdr }}>
              No exact time needed — just choose a due date.
            </div>
          )}
          {editMode && (
            <div className="mb-3 text-xs font-semibold px-3 py-2 rounded-xl" style={{ background: dm ? '#1f2937' : '#ecfeff', color: dm ? '#e5e7eb' : '#0f766e', border: '1px solid ' + bdr }}>
              Exit edit mode to book this service.
            </div>
          )}
          {providerCannotAcceptPayments && !guestNeedsAuth && (
            <div className="mb-3 text-xs font-semibold px-3 py-2 rounded-xl" style={{ background: dm ? 'rgba(156,163,175,0.18)' : 'rgba(156,163,175,0.16)', color: dm ? '#d1d5db' : '#4b5563', border: '1px solid ' + (dm ? '#4b5563' : '#d1d5db') }}>
              This provider can&apos;t accept payments yet, so booking is temporarily unavailable.
            </div>
          )}
          {isSelfOwnedBusiness && (
            <div className="mb-3 text-xs font-semibold px-3 py-2 rounded-xl" style={{ background: dm ? 'rgba(156,163,175,0.18)' : 'rgba(156,163,175,0.16)', color: dm ? '#d1d5db' : '#4b5563', border: '1px solid ' + (dm ? '#4b5563' : '#d1d5db') }}>
              You can&apos;t book your own business listing from this account.
            </div>
          )}
          {guestNeedsAuth && (
            <div className="mb-3 text-xs font-semibold px-3 py-2 rounded-xl" style={{ background: dm ? 'rgba(15,118,110,0.16)' : '#ecfeff', color: dm ? '#d1fae5' : '#0f766e', border: '1px solid ' + (dm ? '#0f766e' : '#99f6e4') }}>
              To book this provider, please log in or create an account first.
              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => router.push(authRedirect)} className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: dm ? '#0f766e' : '#0f766e', color: 'white' }}>Log in</button>
                <button onClick={() => router.push('/signup?next=' + encodeURIComponent('/biz/' + slug))} className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: dm ? '#1f2937' : '#e5e7eb', color: dm ? '#e5e7eb' : '#374151' }}>Create account</button>
              </div>
            </div>
          )}
          <div className="space-y-4" style={{ opacity: (editMode || isPreview) ? 0.5 : 1, pointerEvents: (editMode || isPreview) ? 'none' : 'auto' }}>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: dm ? 'rgba(255,255,255,0.4)' : '#737373' }}>{requiresTime ? 'Preferred date' : 'Due date'}</p>
              <div className="rounded-2xl p-4" style={{ background: dm ? '#0d0d0d' : '#f9fafb', border: '1px solid '+bdr }}>
                <MiniCalendar selected={date} onSelect={d=>{setDate(d);setSlot(null);}} bookedDates={bookedDates} hours={biz.hours} dm={dm} />
              </div>
            </div>
            {date && requiresTime && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{color:dm?'rgba(255,255,255,0.4)':'#737373'}}>
                    {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                  {loadingSlots && <div className="h-3 w-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />}
                </div>
                {availableSlots.every(s=>s.booked||s.outside) ? (
                  <div className="rounded-xl px-4 py-3 text-center" style={{background:dm?'#1a1a1a':'#fef2f2',border:'1px solid #fecaca'}}>
                    <p className="text-sm font-semibold text-red-600">Fully booked this day</p>
                    <p className="text-xs text-red-400 mt-0.5">Please pick another date</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {availableSlots.map(({slot:s,booked,outside,past}) => {
                      const unavail = booked || outside || past;
                      return (
                        <button key={s} type="button" onClick={()=>!unavail&&setSlot(s)} disabled={unavail}
                          className={`py-2.5 rounded-xl text-xs font-semibold text-center border transition-colors relative ${slot===s?'bg-accent text-white border-accent':unavail?'cursor-not-allowed':''}`}
                          style={slot===s?{}:unavail?{background:dm?'#111':'#f9fafb',color:dm?'rgba(255,255,255,0.2)':'#d1d5db',borderColor:dm?'#1f2937':'#f1f5f9',textDecoration:booked?'line-through':undefined}:{background:dm?'#0d0d0d':'white',color:dm?'#d1d5db':'#404040',borderColor:dm?'#262626':'#e5e5e5'}}>
                          {s}
                          {booked&&<span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-400 border border-white"/>}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-[10px] mt-1.5" style={{color:dm?'rgba(255,255,255,0.25)':'#d1d5db'}}>
                  <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-400 inline-block"/>Booked</span> · Greyed out = outside hours or past time
                </p>
              </div>
            )}
            <div>
              <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: dm ? 'rgba(255,255,255,0.4)' : '#737373' }}>Note (required for custom)</label>
              <div className="relative">
                <textarea value={note} maxLength={500} onChange={e=>setNote(e.target.value)} rows={3} placeholder={isCustom ? 'Describe your custom request...' : 'Describe what you need...'} className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none" style={{background:dm?'#0d0d0d':'#f9fafb',color:tx,border:'1.5px solid '+bdr}} />
                <span className="absolute bottom-2 right-3 text-[10px]" style={{ color: dm ? '#9ca3af' : '#9ca3af' }}>{note.length}/500</span>
              </div>
            </div>
            {err && <p className="text-red-500 text-sm">{err}</p>}
          </div>
        </div>

        </div>
        {!isEmbedded && <div className="fixed md:hidden left-0 right-0 px-4 pt-3 z-[60]" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)', paddingBottom: 8, background:dm?'linear-gradient(to top,#0a0a0a 70%,transparent)':'linear-gradient(to top,#f6f2e9 70%,transparent)' }}>
          <button onClick={book} disabled={bookingDisabled}
            className="w-full max-w-2xl mx-auto block rounded-2xl py-4 font-bold text-white text-lg shadow-lg transition-opacity"
            style={{background: bookingDisabled ? 'rgba(156,163,175,0.45)' : `linear-gradient(135deg,${accent} 0%,${accentDark} 100%)`}}>
            {bookingCtaLabel}
          </button>
          {guestNeedsAuth && (
            <p className="text-center mt-2 text-xs font-semibold" style={{ color: dm ? 'rgba(209,213,219,0.85)' : '#6b7280' }}>
              Booking is available after you log in and create your account.
            </p>
          )}
          {providerCannotAcceptPayments && !guestNeedsAuth && (
            <p className="text-center mt-2 text-xs font-semibold" style={{ color: dm ? 'rgba(209,213,219,0.85)' : '#6b7280' }}>
              Provider can&apos;t accept payments yet.
            </p>
          )}
          {isSelfOwnedBusiness && (
            <p className="text-center mt-2 text-xs font-semibold" style={{ color: dm ? 'rgba(209,213,219,0.85)' : '#6b7280' }}>
              You can&apos;t book your own business.
            </p>
          )}
        </div>}
        {!isEmbedded && <div className="hidden md:block fixed bottom-0 left-0 right-0 px-4 pb-4 pt-2 z-40" style={{background:dm?'linear-gradient(to top,#0a0a0a 70%,transparent)':'linear-gradient(to top,#f6f2e9 70%,transparent)'}}>
          <button onClick={book} disabled={bookingDisabled}
            className="w-full max-w-2xl mx-auto block rounded-2xl py-4 font-bold text-white text-lg shadow-lg transition-opacity"
            style={{background: bookingDisabled ? 'rgba(156,163,175,0.45)' : `linear-gradient(135deg,${accent} 0%,${accentDark} 100%)`}}>
            {bookingCtaLabel}
          </button>
          {guestNeedsAuth && (
            <p className="text-center mt-2 text-xs font-semibold" style={{ color: dm ? 'rgba(209,213,219,0.85)' : '#6b7280' }}>
              Booking is available after you log in and create your account.
            </p>
          )}
          {providerCannotAcceptPayments && !guestNeedsAuth && (
            <p className="text-center mt-2 text-xs font-semibold" style={{ color: dm ? 'rgba(209,213,219,0.85)' : '#6b7280' }}>
              Provider can&apos;t accept payments yet.
            </p>
          )}
          {isSelfOwnedBusiness && (
            <p className="text-center mt-2 text-xs font-semibold" style={{ color: dm ? 'rgba(209,213,219,0.85)' : '#6b7280' }}>
              You can&apos;t book your own business.
            </p>
          )}
        </div>}
        {showConfirm && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
            <div className="w-full max-w-xl mx-4 rounded-3xl p-6 relative" style={{ background: dm ? '#0f0f10' : 'white', border: '1px solid ' + (dm ? '#1f2937' : '#e5e7eb') }}>
              <button onClick={() => { setShowConfirm(false); router.push('/bookings'); }} className="absolute top-4 right-4 h-9 w-9 rounded-full flex items-center justify-center" style={{ background: dm ? '#1f2937' : '#f3f4f6', color: dm ? '#d1d5db' : '#374151' }} aria-label="Close">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-11 w-11 rounded-full flex items-center justify-center" style={{ background: dm ? 'rgba(16,185,129,0.2)' : '#d1fae5' }}>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: dm ? '#a7f3d0' : '#047857' }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: dm ? '#f3f4f6' : '#111' }}>Booking requested</p>
                  <p className="text-sm" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>Waiting for business acceptance</p>
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: dm ? 'rgba(255,255,255,0.08)' : '#e5e7eb' }}>
                <div className="h-full" style={{ width: '50%', background: dm ? '#10b981' : '#059669' }} />
              </div>
              <div className="flex items-center justify-between text-xs mb-4" style={{ color: dm ? '#a7f3d0' : '#047857' }}>
                <span className="font-semibold">Request sent</span>
                <span>Awaiting acceptance</span>
              </div>
              <div className="rounded-2xl p-4" style={{ background: dm ? '#111827' : '#f9fafb', border: '1px solid ' + (dm ? '#1f2937' : '#e5e7eb') }}>
                <p className="text-xs font-semibold mb-1" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>Details</p>
                <p className="text-sm font-semibold" style={{ color: dm ? '#f3f4f6' : '#111' }}>{selectedSvc ? (isCustom ? 'Custom Request' : selectedSvc.name) : 'Service'}</p>
                {date && slot && <p className="text-sm" style={{ color: dm ? '#d1d5db' : '#374151' }}>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {slot}</p>}
                {note && <p className="text-xs mt-2" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>Note: {note}</p>}
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => { setShowConfirm(false); router.push('/bookings'); }} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#007e6d' }}>View bookings</button>
                <button onClick={() => { setShowConfirm(false); router.push('/bookings'); }} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: dm ? '#1f2937' : '#f3f4f6', color: dm ? '#d1d5db' : '#374151' }}>Close</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
