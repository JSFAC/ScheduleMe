// @ts-nocheck
// pages/biz/[slug].tsx — DoorDash-style business profile
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';
import Nav from '../../components/Nav';
import { useDm } from '../../lib/DarkModeContext';

function getSB() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

const DEFAULT_TIME_SLOTS = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];

function parseSlotMinutes(slot: string): number {
  const m = slot.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!m) return 0;
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

function getHoursForDate(hoursInput: HourEntry[] | Record<string, string> | undefined, date: Date): { open: number; close: number } | null {
  const hours = normalizeHours(hoursInput);
  if (!hours.length) return null;
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dayName = dayNames[date.getDay()];
  const abbrev: Record<string, string> = { Mon:'Monday', Tue:'Tuesday', Wed:'Wednesday', Thu:'Thursday', Fri:'Friday', Sat:'Saturday', Sun:'Sunday' };
  function dayMatches(pattern: string): boolean {
    if (pattern.toLowerCase().includes('closed')) return false;
    if (pattern.includes('–') || pattern.includes('-')) {
      const all = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      const sep = pattern.includes('–') ? '–' : '-';
      const pts = pattern.split(sep).map(p => p.trim());
      const s = all.indexOf(abbrev[pts[0]] || pts[0]);
      const e = all.indexOf(abbrev[pts[1]] || pts[1]);
      const d = all.indexOf(dayName);
      if (s < 0 || e < 0 || d < 0) return false;
      return s <= e ? (d >= s && d <= e) : (d >= s || d <= e);
    }
    return pattern.includes(dayName) || pattern.includes(dayName.slice(0, 3));
  }
  function parseT(t: string): number | null {
    const mx = t.trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!mx) return null;
    let h = parseInt(mx[1]);
    const mn = parseInt(mx[2]);
    const ap = mx[3].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h * 60 + mn;
  }
  for (const h of hours) {
    if (dayMatches(h.day)) {
      const lower = h.time.toLowerCase();
      if (lower === 'by appointment') return { open: 8 * 60, close: 20 * 60 };
      if (lower === '24 hours') return { open: 0, close: 24 * 60 };
      const sep = h.time.includes('–') ? '–' : '-';
      const parts = h.time.split(sep).map(p => p.trim());
      if (parts.length < 2) continue;
      const open = parseT(parts[0]);
      const close = parseT(parts[1]);
      if (open !== null && close !== null) return { open, close };
    }
  }
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
          const dateKey = date.toISOString().split('T')[0];
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
  const [biz, setBiz] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSvc, setSelectedSvc] = useState(null);
  const isCustom = selectedSvc?.id === '__custom__';
  const { dm } = useDm();
  const [note, setNote] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [err, setErr] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editVideo, setEditVideo] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaErr, setMediaErr] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [svcDrafts, setSvcDrafts] = useState<Record<string, any>>({});
  const [newSvc, setNewSvc] = useState({ name: '', price: '', duration: '60', description: '' });
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const vidInputRef = useRef<HTMLInputElement | null>(null);


  useEffect(() => {
    if (!slug) return;
    getSB().from('businesses').select('*').eq('slug', slug).eq('is_onboarded', true).maybeSingle()
      .then(({ data }) => {
        if (!data) { router.replace('/browse'); return; }
        setBiz(data);
        setEditDesc(data.description || '');
        setEditImages([data.cover_url, ...(data.media_urls || [])].filter(Boolean));
        setEditVideo(data.video_url || null);
        (async () => {
          try {
            const { data: { session } } = await getSB().auth.getSession();
            if (!session) return;
            const { data: fav } = await getSB()
              .from('favorites')
              .select('id')
              .eq('user_id', session.user.id)
              .eq('business_id', data.id)
              .maybeSingle();
            setIsFavorited(!!fav);
            if (session.user?.email && data.owner_email && session.user.email === data.owner_email) {
              setCanEdit(true);
              if (router.query?.edit === '1') setEditMode(true);
            }
          } catch {}
        })();
        fetch('/api/services?business_id=' + data.id).then(r => r.json()).then(d => setServices(d.services || [])).catch(() => {});
        setLoading(false);
      });
  }, [slug]);

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
    if (!biz?.id) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    setLoadingSlots(true);
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    fetch(`${url}/rest/v1/bookings?business_id=eq.${biz.id}&status=in.(confirmed,paid,pending)&scheduled_start=gte.${from}&scheduled_start=lte.${to}&select=scheduled_start`,
      { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } }
    ).then(r => r.json()).then(rows => {
      const slots = new Set<string>();
      const dateCounts: Record<string, number> = {};
      for (const row of rows || []) {
        if (!row.scheduled_start) continue;
        const d = new Date(row.scheduled_start);
        const dk = d.toISOString().split('T')[0];
        const mins = d.getHours() * 60 + d.getMinutes();
        const slotsForDate = getSlotsForDate(biz.hours, d);
        const matched = slotsForDate.find(s => Math.abs(parseSlotMinutes(s) - mins) < 30);
        if (matched) slots.add(dk + '|' + matched);
        dateCounts[dk] = (dateCounts[dk] || 0) + 1;
      }
      setBookedSlots(slots);
      const full = new Set<string>();
      for (const [dk, cnt] of Object.entries(dateCounts)) {
        const slotsForDate = getSlotsForDate(biz.hours, new Date(dk));
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

  async function uploadMedia(file: File, type: 'image' | 'video') {
    if (!biz) return;
    setMediaErr('');
    setMediaUploading(true);
    try {
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
        await submitChangeRequest({ video_url: data.url }, 'media');
        setEditNotice('Video submitted for review.');
      } else if (data.url) {
        const next = [...editImages, data.url];
        setEditImages(next);
        await submitChangeRequest({ media_urls: next, cover_url: next[0] || null }, 'media');
        setEditNotice('Photos submitted for review.');
      }
    } catch (e: any) {
      setMediaErr(e?.message || 'Upload failed');
    } finally {
      setMediaUploading(false);
    }
  }

  async function persistImages(next: string[]) {
    if (!biz) return;
    setEditImages(next);
    try {
      await submitChangeRequest({ media_urls: next, cover_url: next[0] || null }, 'media');
      setEditNotice('Photos submitted for review.');
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
      await submitChangeRequest({ video_url: null }, 'media');
      setEditNotice('Video removal submitted for review.');
    } catch (e: any) {
      setMediaErr(e?.message || 'Failed to update video');
    }
  }

  async function saveDescription() {
    if (!biz) return;
    setEditSaving(true);
    try {
      await submitChangeRequest({ description: editDesc }, 'profile');
      setEditNotice('Description submitted for review.');
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
    const headers = await getAuthHeaders();
    if (!headers) return;
    const res = await fetch('/api/services', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        business_id: biz.id,
        name,
        description: newSvc.description || '',
        price_cents: priceCents,
        duration_min: Number(newSvc.duration || 60),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data.error || 'Failed to add service'); return; }
    setServices((prev: any[]) => [data.service, ...prev]);
    setNewSvc({ name: '', price: '', duration: '60', description: '' });
  }

  async function book() {
    if (editMode) { setErr('Exit edit mode to book'); return; }
    const { data: { session } } = await getSB().auth.getSession();
    if (!session) { router.push('/signin?next=/biz/' + slug); return; }
    if (!selectedSvc) { setErr('Select a service to continue.'); return; }
    if (!date || !slot) { setErr('Pick a date and time'); return; }
    if (isCustom && !note.trim()) { setErr('Please describe your custom request.'); return; }

    const isPaidService = !isCustom;
    if (isPaidService) {
      if (!biz?.stripe_onboarded || !biz?.stripe_account_id) { setErr('This business is not accepting online payments yet.'); return; }
      if (!selectedSvc?.price_cents) { setErr('Please select a priced service to book.'); return; }
    }

    setSubmitting(true); setErr('');
    const scheduled_start = buildScheduledStart(date, slot);
    let d: any = null;
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({
          business_id: biz.id,
          service: selectedSvc?.name || 'Custom Request',
          service_price_cents: isPaidService ? selectedSvc?.price_cents : null,
          note,
          scheduled_start,
          scheduled_slot: slot,
          user_id: session.user.id,
          user_email: session.user.email,
          user_name: session.user.user_metadata?.full_name,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error || 'Booking failed'); setSubmitting(false); return; }
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
    router.push(`/pay/${bookingId}`);
    return;
  }

  const bg = dm ? '#0a0a0a' : '#f9fafb';
  const accent = '#007e6d';
  const accentDark = '#1e554c';
  const accentWash = dm ? 'rgba(0,126,109,0.2)' : 'rgba(0,126,109,0.12)';
  const accentBorder = dm ? 'rgba(0,126,109,0.35)' : 'rgba(0,126,109,0.25)';
  const card = dm ? '#1c1c1e' : '#ffffff';
  const bdr = dm ? '#2c2c2e' : '#f0f0f0';
  const tx = dm ? '#f2f2f7' : '#111';
  const mu = dm ? '#8e8e93' : '#6b7280';

  if (loading) return <><Head><title>Loading — ScheduleMe</title></Head><div style={{background:bg,minHeight:'100vh'}}><Nav /></div></>;
  if (!biz) return null;

  const tags = biz.service_tags || [];
  const cat = tags.length > 0 ? tags[0].charAt(0).toUpperCase() + tags[0].slice(1).replace(/_/g,' ') : 'Service';
  const baseImgs = [biz.cover_url, ...(biz.media_urls || [])].filter(Boolean);
  const imgs = editMode ? (editImages.length ? editImages : baseImgs) : baseImgs;

  const availableSlots = date ? (() => {
    const dk = date.toISOString().split('T')[0];
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
    const title = biz?.name || 'ScheduleMe business';
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${biz?.name || 'ScheduleMe business'} on ScheduleMe`, url });
        return;
      }
    } catch {}
    setShareOpen(true);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
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
      <Head><title>{biz.name} — ScheduleMe</title><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" /></Head>
      <div style={{background:bg,minHeight:'100vh',paddingBottom:100}}>
        <Nav />
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
        <div className="relative overflow-hidden" style={{height:280,background:dm?'#1c1c1e':'#e5e7eb'}}>
          {imgs[0] && <img src={imgs[0]} alt={biz.name} className="absolute inset-0 w-full h-full object-cover" style={{objectPosition:'center 30%'}} />}
          <div className="absolute inset-0" style={{background:'linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.55))'}} />
          <button onClick={()=>router.back()} className="absolute top-4 left-4 flex items-center justify-center rounded-full" style={{width:36,height:36,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(8px)'}}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/></svg>
          </button>
        </div>
        <div className="mx-auto max-w-2xl px-4">
          <div className="rounded-2xl p-5 shadow-lg -mt-6 relative z-10 mb-5" style={{background:card,border:'1px solid '+bdr}}>
            {canEdit && (
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: mu }}>
                  {editMode ? 'Edit Mode' : 'Owner Tools'}
                </div>
                <button
                  onClick={() => setEditMode((v) => !v)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                  style={{ background: editMode ? (dm ? '#1f2937' : '#e5e7eb') : accentWash, border: '1px solid ' + accentBorder, color: editMode ? (dm ? '#e5e7eb' : '#374151') : accent }}
                >
                  {editMode ? 'Exit edit mode' : 'Edit listing'}
                </button>
              </div>
            )}
            <h1 className="text-xl font-bold mb-2" style={{color:tx,letterSpacing:'-0.02em'}}>{biz.name}</h1>
            <div className="flex gap-2 flex-wrap mb-3">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:accentWash,border:'1px solid '+accentBorder,color:accent}}>{cat}</span>
              {biz.price_tier ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:accentWash,border:'1px solid '+accentBorder,color:accent}}>{'$'.repeat(biz.price_tier)}</span>
              ) : null}
              {(biz.review_count ?? 0) === 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:dm ? 'rgba(251,191,36,0.18)' : '#fef3c7', color: dm ? '#f59e0b' : '#92400e' }}>New</span>
              )}
              {(biz.review_count ?? 0) > 0 && biz.rating && <span className="text-xs font-semibold" style={{color:mu}}>{parseFloat(biz.rating).toFixed(1)} stars</span>}
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
                  <button
                    onClick={saveDescription}
                    disabled={editSaving}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                    style={{ background: accentWash, border: '1px solid ' + accentBorder, color: accent, opacity: editSaving ? 0.6 : 1 }}
                  >
                    {editSaving ? 'Saving…' : 'Save description'}
                  </button>
                </div>
              </div>
            ) : (
              biz.description && <p className="text-sm leading-relaxed mb-4" style={{color:mu}}>{biz.description}</p>
            )}
            {editNotice && (
              <div className="mb-4 text-[11px] font-semibold" style={{ color: accent }}>{editNotice}</div>
            )}
            <div className="flex gap-2 flex-wrap">
              <a href={`/messages?business=${biz.id}`} className="text-sm font-medium px-3 py-1.5 rounded-xl" style={{background:accentWash,border:'1px solid '+accentBorder,color:accent}}>Message</a>
              <button onClick={shareBusiness} className="text-sm font-medium px-3 py-1.5 rounded-xl" style={{background:accentWash,border:'1px solid '+accentBorder,color:accent}}>Share</button>
              <button onClick={toggleFavorite} className="text-sm font-medium px-3 py-1.5 rounded-xl" style={{background: isFavorited ? (dm ? 'rgba(251,191,36,0.18)' : '#fef3c7') : accentWash, border:'1px solid '+accentBorder, color: isFavorited ? (dm ? '#f59e0b' : '#92400e') : accent}}>{isFavorited ? 'Pinned' : 'Pin'}</button>
              {biz.website && <a href={biz.website.startsWith('http')?biz.website:'https://'+biz.website} target="_blank" rel="noreferrer" className="text-sm font-medium px-3 py-1.5 rounded-xl" style={{background:accentWash,border:'1px solid '+accentBorder,color:accent}}>Website</a>}
            </div>
          </div>
          {editMode && (
            <div className="rounded-2xl p-4 mb-5" style={{ background: card, border: '1px solid ' + bdr }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-bold" style={{ color: tx }}>Photos & video</p>
                  <p className="text-xs" style={{ color: mu }}>Drag to reorder. First image becomes the cover.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => imgInputRef.current?.click()}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                    style={{ background: accentWash, border: '1px solid ' + accentBorder, color: accent }}>
                    Add photo
                  </button>
                  <button onClick={() => vidInputRef.current?.click()}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                    style={{ background: accentWash, border: '1px solid ' + accentBorder, color: accent }}>
                    Add video
                  </button>
                </div>
              </div>
              {mediaErr && <p className="text-xs text-red-500 mb-2">{mediaErr}</p>}
              {mediaUploading && <p className="text-xs mb-2" style={{ color: mu }}>Uploading…</p>}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {editImages.map((url, i) => (
                  <div key={url}
                    draggable
                    onDragStart={() => onDragStart(i)}
                    onDragOver={(e) => onDragOver(e, i)}
                    onDragEnd={onDragEnd}
                    className="relative flex-shrink-0 rounded-xl overflow-hidden"
                    style={{ width: 76, height: 76, opacity: dragIdx === i ? 0.5 : 1, border: i === 0 ? '2px solid #007e6d' : '1px solid ' + bdr, cursor: 'grab' }}>
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {i === 0 && (
                      <div className="absolute bottom-0 left-0 right-0 text-center text-[8px] font-bold py-0.5" style={{ background: 'rgba(0,126,109,0.85)', color: 'white' }}>COVER</div>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>
                      ×
                    </button>
                  </div>
                ))}
                {editImages.length === 0 && (
                  <div className="text-xs px-2 py-6" style={{ color: mu }}>No photos yet</div>
                )}
              </div>
              {editVideo && (
                <div className="mt-3 flex items-center justify-between rounded-xl px-3 py-2" style={{ border: '1px solid ' + bdr, background: dm ? '#0d0d0d' : '#f9fafb' }}>
                  <p className="text-xs font-semibold" style={{ color: tx }}>Video added</p>
                  <button onClick={removeVideo} className="text-xs font-semibold" style={{ color: '#ef4444' }}>Remove</button>
                </div>
              )}
              <input
                ref={imgInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadMedia(file, 'image');
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
            </div>
          )}
          <h2 className="text-lg font-bold mb-3" style={{color:tx}}>Services</h2>
          <div className="flex flex-col gap-3 mb-5">
            {services.length === 0 && <div className="rounded-2xl p-5 text-center" style={{background:card,border:'1px solid '+bdr}}><p className="text-sm" style={{color:mu}}>No services listed yet</p></div>}
            {services.map(s => {
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
                <p className="text-sm font-bold mb-2" style={{ color: tx }}>Add new service</p>
                <div className="grid grid-cols-1 gap-2">
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
                  <span className="text-[11px]" style={{ color: mu }}>This will appear immediately on your listing.</span>
                  <button onClick={addService}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                    style={{ background: accentWash, border: '1px solid ' + accentBorder, color: accent }}>
                    Add service
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={()=>{setSelectedSvc({ id: '__custom__', name: 'Custom Request' });}} className="w-full text-left rounded-2xl p-4" style={{background:isCustom?(dm?'rgba(0,126,109,0.2)':'rgba(0,126,109,0.08)'):card,border:'1.5px dashed '+(isCustom?'#007e6d':bdr)}}>
                <p className="font-semibold text-sm" style={{color:tx}}>Custom Request</p>
                <p className="text-xs mt-0.5" style={{color:mu}}>Describe what you need in the notes below</p>
              </button>
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
          {editMode && (
            <div className="mb-3 text-xs font-semibold px-3 py-2 rounded-xl" style={{ background: dm ? '#1f2937' : '#ecfeff', color: dm ? '#e5e7eb' : '#0f766e', border: '1px solid ' + bdr }}>
              Exit edit mode to book this service.
            </div>
          )}
          <div className="space-y-4" style={{ opacity: editMode ? 0.5 : 1, pointerEvents: editMode ? 'none' : 'auto' }}>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: dm ? 'rgba(255,255,255,0.4)' : '#737373' }}>Preferred date</p>
              <div className="rounded-2xl p-4" style={{ background: dm ? '#0d0d0d' : '#f9fafb', border: '1px solid '+bdr }}>
                <MiniCalendar selected={date} onSelect={d=>{setDate(d);setSlot(null);}} bookedDates={bookedDates} hours={biz.hours} dm={dm} />
              </div>
            </div>
            {date && (
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
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 z-40" style={{background:dm?'linear-gradient(to top,#0a0a0a 70%,transparent)':'linear-gradient(to top,#f9fafb 70%,transparent)'}}>
          <button onClick={book} disabled={!date || !slot || submitting || done || (isCustom && !note.trim())}
            className="w-full max-w-2xl mx-auto block rounded-2xl py-4 font-bold text-white text-lg shadow-lg transition-opacity"
            style={{background:(!date || !slot || submitting || done) ? '#9ca3af' : `linear-gradient(135deg,${accent} 0%,${accentDark} 100%)`}}>
            {submitting ? 'Booking…' : (selectedSvc ? (isCustom ? 'Request Custom Service' : 'Book '+selectedSvc.name+' — $'+(selectedSvc.price_cents/100).toFixed(2)) : 'Book Appointment')}
          </button>
        </div>
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
