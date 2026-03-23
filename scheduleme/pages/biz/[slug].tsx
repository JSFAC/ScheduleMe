// @ts-nocheck
// pages/biz/[slug].tsx — Full-page business profile (DoorDash-style)
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';
import Nav from '../../components/Nav';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

function getOpenStatus(hours) {
  if (!hours || !hours.length) return { open: true, label: 'Open' };
  const now = new Date(), dn = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const tn = dn[now.getDay()];
  const ab = {Mon:'Monday',Tue:'Tuesday',Wed:'Wednesday',Thu:'Thursday',Fri:'Friday',Sat:'Saturday',Sun:'Sunday'};
  function pT(t) { const m=t.trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i); if(!m)return null; let hh=parseInt(m[1]); const mn=parseInt(m[2]),ap=m[3].toUpperCase(); if(ap==='PM'&&hh!==12)hh+=12; if(ap==='AM'&&hh===12)hh=0; return hh*60+mn; }
  function dM(p,n) { if(p.includes('–')||p.includes('-')){const all=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],sep=p.includes('–')?'–':'-',pts=p.split(sep).map(x=>x.trim()),s=all.indexOf(ab[pts[0]]||pts[0]),e=all.indexOf(ab[pts[1]]||pts[1]),d=all.indexOf(n);if(s<0||e<0||d<0)return false;return s<=e?(d>=s&&d<=e):(d>=s||d<=e);}return p.includes(n)||p.includes(n.slice(0,3)); }
  const nM=now.getHours()*60+now.getMinutes();
  for(const h of hours){
    if(h.time.toLowerCase().includes('closed')&&dM(h.day,tn))return{open:false,label:'Closed today'};
    const rp=h.time.split('–').map(p=>p.trim());if(rp.length<2)continue;
    const oM=pT(rp[0]),cM=pT(rp[1]);if(oM===null||cM===null)continue;
    if(dM(h.day,tn)){if(nM>=oM&&nM<cM)return{open:true,label:'Open'};if(nM<oM){const hh=Math.floor(oM/60),mm=oM%60,ap=hh>=12?'PM':'AM',dh=hh>12?hh-12:hh===0?12:hh;return{open:false,label:'Opens '+dh+':'+String(mm).padStart(2,'0')+' '+ap};}return{open:false,label:'Closed'};}
  }
  return{open:true,label:'Open'};
}

export default function BizPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [biz, setBiz] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [showBooking, setShowBooking] = useState(false);
  const [dm, setDm] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') setDm(localStorage.getItem('sm_dark_mode') === 'true');
    getSupabase().auth.getSession().then(({ data: { session } }) => setUser(session?.user || null));
  }, []);

  useEffect(() => {
    if (!slug) return;
    const supabase = getSupabase();
    supabase.from('businesses')
      .select('*')
      .eq('slug', slug)
      .eq('is_onboarded', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) { router.replace('/browse'); return; }
        setBiz(data);
        // Load services
        fetch('/api/services?business_id=' + data.id)
          .then(r => r.json())
          .then(d => setServices(d.services || []))
          .catch(() => {});
        setLoading(false);
      });
  }, [slug]);

  if (loading) return (
    <div style={{ background: dm ? '#000' : '#fff', minHeight: '100vh' }}>
      <Nav />
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    </div>
  );

  if (!biz) return null;

  const status = getOpenStatus(biz.hours || []);
  const images = [biz.cover_url, ...(biz.media_urls || [])].filter(Boolean);
  const currentImg = images[imgIdx] || biz.cover_url;
  const bg = dm ? '#0a0a0a' : '#f9fafb';
  const card = dm ? '#1c1c1e' : '#ffffff';
  const border = dm ? '#2c2c2e' : '#f0f0f0';
  const text = dm ? '#f2f2f7' : '#111';
  const muted = dm ? '#8e8e93' : '#6b7280';

  return (
    <>
      <Head>
        <title>{biz.name} — ScheduleMe</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="description" content={biz.description || biz.name + ' on ScheduleMe'} />
      </Head>
      <div style={{ background: bg, minHeight: '100vh' }}>
        <Nav />

        {/* ── HERO IMAGE ── */}
        <div className="relative w-full overflow-hidden" style={{ height: 'clamp(200px, 40vw, 360px)', background: dm ? '#1c1c1e' : '#e5e7eb' }}>
          {currentImg && <img src={currentImg} alt={biz.name} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: 'center 30%' }} />}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.6) 100%)' }} />
          {/* Image dots */}
          {images.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={() => setImgIdx(i)} className="rounded-full transition-all" style={{ width: i === imgIdx ? 18 : 6, height: 6, background: i === imgIdx ? 'white' : 'rgba(255,255,255,0.5)' }} />
              ))}
            </div>
          )}
          {/* Back button */}
          <button onClick={() => router.back()} className="absolute top-4 left-4 flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="mx-auto max-w-2xl">

          {/* ── BIZ INFO CARD ── */}
          <div className="mx-4 -mt-6 relative z-10 rounded-2xl p-5 shadow-lg" style={{ background: card, border: '1px solid ' + border }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold leading-tight" style={{ color: text, letterSpacing: '-0.02em' }}>{biz.name}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(10,132,255,0.2)' : '#e8f0fe', color: '#0A84FF' }}>
                    {(biz.service_tags?.[0] || 'Service').charAt(0).toUpperCase() + (biz.service_tags?.[0] || 'Service').slice(1).replace(/_/g,' ')}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: status.open ? (dm ? 'rgba(52,211,153,0.15)' : '#f0fdf4') : (dm ? 'rgba(255,255,255,0.07)' : '#f5f5f5'), color: status.open ? '#16a34a' : muted }}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status.open ? 'bg-emerald-500' : 'bg-neutral-400'}`} />{status.label}
                  </span>
                  {biz.price_tier && <span className="text-xs font-semibold" style={{ color: muted }}>{'$'.repeat(biz.price_tier)}</span>}
                </div>
              </div>
              {/* Rating */}
              <div className="flex flex-col items-center shrink-0">
                <div className="text-xl font-bold" style={{ color: text }}>{parseFloat(biz.rating || 0).toFixed(1)}</div>
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} className={`w-3 h-3 ${i <= Math.round(biz.rating||0) ? 'text-amber-400' : (dm ? 'text-neutral-700' : 'text-neutral-200')}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  ))}
                </div>
                <div className="text-xs" style={{ color: muted }}>{biz.review_count || 0} reviews</div>
              </div>
            </div>

            {/* Description */}
            {biz.description && <p className="mt-3 text-sm leading-relaxed" style={{ color: muted }}>{biz.description}</p>}

            {/* Contact row */}
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              {biz.phone && (
                <a href={"tel:" + biz.phone} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl" style={{ background: dm ? '#2c2c2e' : '#f5f5f5', color: text }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" /></svg>
                  Call
                </a>
              )}
              {biz.address && (
                <a href={"https://maps.google.com/?q=" + encodeURIComponent(biz.address)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl" style={{ background: dm ? '#2c2c2e' : '#f5f5f5', color: text }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Directions
                </a>
              )}
              {biz.website && (
                <a href={biz.website.startsWith('http') ? biz.website : 'https://' + biz.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl" style={{ background: dm ? '#2c2c2e' : '#f5f5f5', color: text }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" /></svg>
                  Website
                </a>
              )}
            </div>
          </div>

          {/* ── SERVICES MENU ── */}
          <div className="mx-4 mt-5">
            <h2 className="text-lg font-bold mb-3" style={{ color: text }}>Services</h2>
            {services.length === 0 ? (
              <div className="rounded-2xl p-6 text-center" style={{ background: card, border: '1px solid ' + border }}>
                <p className="text-sm" style={{ color: muted }}>No services listed yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {services.map(svc => (
                  <button key={svc.id} onClick={() => { setSelectedService(svc); setShowBooking(true); }}
                    className="w-full text-left rounded-2xl p-4 transition-all active:scale-[0.98]"
                    style={{ background: selectedService?.id === svc.id ? (dm ? 'rgba(10,132,255,0.15)' : '#eff6ff') : card, border: '1.5px solid ' + (selectedService?.id === svc.id ? '#0A84FF' : border) }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[15px]" style={{ color: text }}>{svc.name}</p>
                        {svc.description && <p className="text-sm mt-0.5 leading-snug" style={{ color: muted }}>{svc.description}</p>}
                        <p className="text-xs mt-1.5 font-medium" style={{ color: muted }}>⏱ {svc.duration_min} min</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-bold text-[17px]" style={{ color: '#0A84FF' }}>{'$'}{(svc.price_cents / 100).toFixed(2)}</p>
                        <div className="mt-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: '#0A84FF', color: 'white' }}>Book</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Custom request option */}
            <button onClick={() => { setSelectedService(null); setShowBooking(true); }}
              className="w-full mt-3 rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
              style={{ background: card, border: '1.5px dashed ' + border }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[15px]" style={{ color: text }}>Custom Request</p>
                  <p className="text-sm mt-0.5" style={{ color: muted }}>Describe what you need — business will quote you</p>
                </div>
                <svg className="w-5 h-5 shrink-0" style={{ color: muted }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          </div>

          {/* ── HOURS ── */}
          {biz.hours?.length > 0 && (
            <div className="mx-4 mt-5">
              <h2 className="text-lg font-bold mb-3" style={{ color: text }}>Hours</h2>
              <div className="rounded-2xl overflow-hidden" style={{ background: card, border: '1px solid ' + border }}>
                {biz.hours.map((h, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: i < biz.hours.length - 1 ? '1px solid ' + border : 'none' }}>
                    <span className="text-sm font-medium" style={{ color: text }}>{h.day}</span>
                    <span className="text-sm" style={{ color: muted }}>{h.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="h-36" />
        </div>

        {/* ── STICKY BOOK BUTTON ── */}
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-3" style={{ background: dm ? 'linear-gradient(to top, #0a0a0a 70%, transparent)' : 'linear-gradient(to top, #f9fafb 70%, transparent)' }}>
          <button onClick={() => setShowBooking(true)}
            className="w-full max-w-2xl mx-auto flex items-center justify-center gap-2 rounded-2xl py-4 font-bold text-[17px] shadow-lg active:scale-[0.97] transition-all"
            style={{ background: 'linear-gradient(135deg, #0A84FF 0%, #5B5CFF 100%)', color: 'white' }}>
            {selectedService ? ('Book ${selectedService.name} — ' + '$' + String((selectedService.price_cents / 100).toFixed(2)) + '') : 'Book Appointment'}
          </button>
        </div>

        {/* ── BOOKING SHEET ── */}
        {showBooking && (
          <BookingSheet biz={biz} service={selectedService} dm={dm} user={user} onClose={() => setShowBooking(false)} siteUrl={''} />
        )}
      </div>
    </>
  );
}

function BookingSheet({ biz, service, dm, user, onClose }) {
  const router = useRouter();
  const [step, setStep] = useState('confirm'); // confirm | datetime | done
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const bg = dm ? '#1c1c1e' : '#ffffff';
  const text = dm ? '#f2f2f7' : '#111';
  const muted = dm ? '#8e8e93' : '#6b7280';
  const border = dm ? '#2c2c2e' : '#f0f0f0';

  async function handleBook() {
    if (!user) { router.push('/signin?next=' + router.asPath); return; }
    if (!date || !time) { setError('Please pick a date and time'); return; }
    setLoading(true); setError('');
    try {
      const payload = {
        business_id: biz.id,
        service_name: service?.name || null,
        service_id: service?.id || null,
        service_price_cents: service?.price_cents || null,
        note,
        scheduled_date: date,
        scheduled_time: time,
      };
      const res = await fetch('/api/intake', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await getSupabase().auth.getSession()).data.session?.access_token }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Booking failed'); setLoading(false); return; }
      setStep('done');
    } catch (e) { setError('Something went wrong'); }
    setLoading(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl shadow-2xl" style={{ background: bg, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-lg font-bold" style={{ color: text }}>{step === 'done' ? 'Booked!' : service ? service.name : 'Book Appointment'}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: dm ? '#2c2c2e' : '#f5f5f5' }}>
            <svg className="w-4 h-4" style={{ color: text }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {step === 'done' ? (
          <div className="px-5 pb-8 text-center">
            <div className="text-5xl mb-3">✅</div>
            <p className="font-semibold text-lg mb-1" style={{ color: text }}>Request Sent!</p>
            <p className="text-sm mb-6" style={{ color: muted }}>The business will confirm your booking shortly. Check your bookings page for updates.</p>
            <button onClick={() => router.push('/bookings')} className="w-full py-3.5 rounded-2xl font-bold text-white" style={{ background: '#0A84FF' }}>View My Bookings</button>
          </div>
        ) : (
          <div className="px-5 pb-8 flex flex-col gap-4">
            {service && (
              <div className="rounded-2xl p-4" style={{ background: dm ? '#2c2c2e' : '#f9fafb', border: '1px solid ' + border }}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold" style={{ color: text }}>{service.name}</p>
                    <p className="text-sm" style={{ color: muted }}>{service.duration_min} min</p>
                  </div>
                  <p className="font-bold text-lg" style={{ color: '#0A84FF' }}>{'$'}{(service.price_cents / 100).toFixed(2)}</p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold" style={{ color: muted }}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium outline-none"
                style={{ background: dm ? '#2c2c2e' : '#f5f5f5', color: text, border: '1.5px solid ' + border }} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold" style={{ color: muted }}>Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium outline-none"
                style={{ background: dm ? '#2c2c2e' : '#f5f5f5', color: text, border: '1.5px solid ' + border }} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold" style={{ color: muted }}>Note <span className="font-normal">(optional)</span></label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Describe what you need..."
                className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                style={{ background: dm ? '#2c2c2e' : '#f5f5f5', color: text, border: '1.5px solid ' + border }} />
            </div>

            {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

            {!user && <p className="text-sm text-center" style={{ color: muted }}>You'll be asked to sign in to complete your booking</p>}

            <button onClick={handleBook} disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-[17px] text-white transition-all active:scale-[0.97]"
              style={{ background: loading ? '#9ca3af' : 'linear-gradient(135deg, #0A84FF 0%, #5B5CFF 100%)' }}>
              {loading ? 'Booking...' : service ? `Request ${service.name}` : 'Request Appointment'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
