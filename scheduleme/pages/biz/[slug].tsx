// @ts-nocheck
// pages/biz/[slug].tsx — DoorDash-style business profile
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';
import Nav from '../../components/Nav';
import { useDm } from '../../lib/DarkModeContext';

function getSB() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

const TIME_SLOTS = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];

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

function buildScheduledStart(date: Date, slot: string): string | null {
  const mins = parseSlotMinutes(slot);
  if (Number.isNaN(mins)) return null;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toISOString();
}

type HourEntry = { day: string; time: string };

function getHoursForDate(hours: HourEntry[] | undefined, date: Date): { open: number; close: number } | null {
  if (!hours || !hours.length) return null;
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
      if (h.time.toLowerCase() === 'by appointment') return { open: 8 * 60, close: 20 * 60 };
      const parts = h.time.split('–').map(p => p.trim());
      if (parts.length < 2) continue;
      const open = parseT(parts[0]);
      const close = parseT(parts[1]);
      if (open !== null && close !== null) return { open, close };
    }
  }
  return null;
}

function MiniCalendar({ selected, onSelect, bookedDates, hours, dm }: { selected: Date | null; onSelect: (d: Date) => void; bookedDates?: Set<string>; hours?: {day:string;time:string}[]; dm: boolean; }) {
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
          const hasHours = hours && hours.length ? !!getHoursForDate(hours, date) : true;
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


  useEffect(() => {
    if (!slug) return;
    getSB().from('businesses').select('*').eq('slug', slug).eq('is_onboarded', true).maybeSingle()
      .then(({ data }) => {
        if (!data) { router.replace('/browse'); return; }
        setBiz(data);
        fetch('/api/services?business_id=' + data.id).then(r => r.json()).then(d => setServices(d.services || [])).catch(() => {});
        setLoading(false);
      });
  }, [slug]);

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
        const matched = TIME_SLOTS.find(s => Math.abs(parseSlotMinutes(s) - mins) < 30);
        if (matched) slots.add(dk + '|' + matched);
        dateCounts[dk] = (dateCounts[dk] || 0) + 1;
      }
      setBookedSlots(slots);
      const full = new Set<string>();
      for (const [dk, cnt] of Object.entries(dateCounts)) {
        const dh = getHoursForDate(biz.hours, new Date(dk));
        if (!dh) continue;
        const avail = TIME_SLOTS.filter(s => { const m = parseSlotMinutes(s); return m >= dh.open && m < dh.close; });
        if (cnt >= avail.length && avail.length > 0) full.add(dk);
      }
      setBookedDates(full);
    }).catch(() => {}).finally(() => setLoadingSlots(false));
  }, [biz?.id]);

  async function book() {
    const { data: { session } } = await getSB().auth.getSession();
    if (!session) { router.push('/signin?next=/biz/' + slug); return; }
    if (!biz?.stripe_onboarded || !biz?.stripe_account_id) { setErr('This business is not accepting online payments yet.'); return; }
    if (!selectedSvc || isCustom || !selectedSvc?.price_cents) { setErr('Please select a priced service to book.'); return; }
    if (!date || !slot) { setErr('Pick a date and time'); return; }
    setSubmitting(true); setErr('');
    const scheduled_start = buildScheduledStart(date, slot);
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({
        business_id: biz.id,
        service: selectedSvc?.name || 'Custom Request',
        service_price_cents: selectedSvc?.price_cents || null,
        note,
        scheduled_start,
        scheduled_slot: slot,
        user_id: session.user.id,
        user_email: session.user.email,
        user_name: session.user.user_metadata?.full_name,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    const d = await res.json();
    if (!res.ok) { setErr(d.error || 'Booking failed'); setSubmitting(false); return; }

    const bookingId = d?.booking?.id;
    if (!bookingId) { setErr('Booking created but payment could not start.'); setSubmitting(false); return; }

    const checkoutRes = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ booking_id: bookingId }),
    });
    const checkoutData = await checkoutRes.json();
    if (!checkoutRes.ok || !checkoutData?.url) { setErr(checkoutData?.error || 'Unable to start payment.'); setSubmitting(false); return; }

    window.location.href = checkoutData.url;
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
  const imgs = [biz.cover_url, ...(biz.media_urls||[])].filter(Boolean);

  const availableSlots = date ? (() => {
    const dk = date.toISOString().split('T')[0];
    const dh = getHoursForDate(biz.hours, date);
    const now = new Date();
    const isToday = now.toDateString() === date.toDateString();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return TIME_SLOTS.map(s => ({
      slot: s,
      booked: bookedSlots.has(dk + '|' + s),
      outside: dh ? (parseSlotMinutes(s) < dh.open || parseSlotMinutes(s) >= dh.close) : false,
      past: isToday && parseSlotMinutes(s) <= nowMins,
    }));
  })() : [];

  return (
    <>
      <Head><title>{biz.name} — ScheduleMe</title><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" /></Head>
      <div style={{background:bg,minHeight:'100vh',paddingBottom:100}}>
        <Nav />
        <div className="relative overflow-hidden" style={{height:280,background:dm?'#1c1c1e':'#e5e7eb'}}>
          {imgs[0] && <img src={imgs[0]} alt={biz.name} className="absolute inset-0 w-full h-full object-cover" style={{objectPosition:'center 30%'}} />}
          <div className="absolute inset-0" style={{background:'linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.55))'}} />
          <button onClick={()=>router.back()} className="absolute top-4 left-4 flex items-center justify-center rounded-full" style={{width:36,height:36,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(8px)'}}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/></svg>
          </button>
        </div>
        <div className="mx-auto max-w-2xl px-4">
          <div className="rounded-2xl p-5 shadow-lg -mt-6 relative z-10 mb-5" style={{background:card,border:'1px solid '+bdr}}>
            <h1 className="text-xl font-bold mb-2" style={{color:tx,letterSpacing:'-0.02em'}}>{biz.name}</h1>
            <div className="flex gap-2 flex-wrap mb-3">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:accentWash,border:'1px solid '+accentBorder,color:accent}}>{cat}</span>
              {biz.rating > 0 && <span className="text-xs font-semibold" style={{color:mu}}>{parseFloat(biz.rating).toFixed(1)} stars</span>}
            </div>
            {biz.description && <p className="text-sm leading-relaxed mb-4" style={{color:mu}}>{biz.description}</p>}
            <div className="flex gap-2 flex-wrap">
              {biz.phone && <a href={'tel:'+biz.phone} className="text-sm font-medium px-3 py-1.5 rounded-xl" style={{background:accentWash,border:'1px solid '+accentBorder,color:accent}}>Call</a>}
              {biz.address && <a href={'https://maps.google.com/?q='+encodeURIComponent(biz.address)} target="_blank" rel="noreferrer" className="text-sm font-medium px-3 py-1.5 rounded-xl" style={{background:accentWash,border:'1px solid '+accentBorder,color:accent}}>Directions</a>}
              {biz.website && <a href={biz.website.startsWith('http')?biz.website:'https://'+biz.website} target="_blank" rel="noreferrer" className="text-sm font-medium px-3 py-1.5 rounded-xl" style={{background:accentWash,border:'1px solid '+accentBorder,color:accent}}>Website</a>}
            </div>
          </div>
          <h2 className="text-lg font-bold mb-3" style={{color:tx}}>Services</h2>
          <div className="flex flex-col gap-3 mb-5">
            {services.length === 0 && <div className="rounded-2xl p-5 text-center" style={{background:card,border:'1px solid '+bdr}}><p className="text-sm" style={{color:mu}}>No services listed yet</p></div>}
            {services.map(s => (
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
            ))}
            <button onClick={()=>{setSelectedSvc({ id: '__custom__', name: 'Custom Request' });}} className="w-full text-left rounded-2xl p-4" style={{background:isCustom?(dm?'rgba(0,126,109,0.2)':'rgba(0,126,109,0.08)'):card,border:'1.5px dashed '+(isCustom?'#007e6d':bdr)}}>
              <p className="font-semibold text-sm" style={{color:tx}}>Custom Request</p>
              <p className="text-xs mt-0.5" style={{color:mu}}>Describe what you need in the notes below</p>
            </button>
          </div>
          {biz.hours?.length > 0 && <>
            <h2 className="text-lg font-bold mb-3" style={{color:tx}}>Hours</h2>
            <div className="rounded-2xl overflow-hidden mb-5" style={{background:card,border:'1px solid '+bdr}}>
              {biz.hours.map((h,i) => <div key={i} className="flex justify-between px-4 py-3" style={{borderBottom:i<biz.hours.length-1?'1px solid '+bdr:'none'}}><span className="text-sm font-medium" style={{color:tx}}>{h.day}</span><span className="text-sm" style={{color:mu}}>{h.time}</span></div>)}
            </div>
          </>}
        <div className="rounded-2xl p-5 mb-8" style={{background:card,border:'1px solid '+bdr}}>
          <h2 className="text-lg font-bold mb-3" style={{color:tx}}>Book Appointment</h2>
          <div className="space-y-4">
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
              <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: dm ? 'rgba(255,255,255,0.4)' : '#737373' }}>Note (optional)</label>
              <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder={isCustom ? 'Describe your custom request...' : 'Describe what you need...'} className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none" style={{background:dm?'#0d0d0d':'#f9fafb',color:tx,border:'1.5px solid '+bdr}} />
            </div>
            {err && <p className="text-red-500 text-sm">{err}</p>}
          </div>
        </div>

        </div>
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 z-40" style={{background:dm?'linear-gradient(to top,#0a0a0a 70%,transparent)':'linear-gradient(to top,#f9fafb 70%,transparent)'}}>
          <button onClick={book} disabled={!date || !slot || submitting || done}
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
