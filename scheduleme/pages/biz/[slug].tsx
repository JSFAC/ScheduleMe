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

export default function BizPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [biz, setBiz] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [selectedSvc, setSelectedSvc] = useState(null);
  const { dm } = useDm();
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
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

  async function book() {
    const { data: { session } } = await getSB().auth.getSession();
    if (!session) { router.push('/signin?next=/biz/' + slug); return; }
    if (!date || !time) { setErr('Pick a date and time'); return; }
    setSubmitting(true); setErr('');
    const res = await fetch('/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ business_id: biz.id, service_name: selectedSvc?.name || null, service_id: selectedSvc?.id || null, service_price_cents: selectedSvc?.price_cents || null, note, scheduled_date: date, scheduled_time: time }),
    });
    const d = await res.json();
    if (!res.ok) { setErr(d.error || 'Booking failed'); setSubmitting(false); return; }
    setDone(true); setSubmitting(false);
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
              <button key={s.id} onClick={()=>{setSelectedSvc(s);setShowBooking(true);}} className="w-full text-left rounded-2xl p-4" style={{background:selectedSvc?.id===s.id?(dm?'rgba(0,126,109,0.2)':'rgba(0,126,109,0.08)'):card,border:'1.5px solid '+(selectedSvc?.id===s.id?'#007e6d':bdr)}}>
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
            <button onClick={()=>{setSelectedSvc(null);setShowBooking(true);}} className="w-full text-left rounded-2xl p-4" style={{background:card,border:'1.5px dashed '+bdr}}>
              <p className="font-semibold text-sm" style={{color:tx}}>Custom Request</p>
              <p className="text-xs mt-0.5" style={{color:mu}}>Describe what you need — we will quote you</p>
            </button>
          </div>
          {biz.hours?.length > 0 && <>
            <h2 className="text-lg font-bold mb-3" style={{color:tx}}>Hours</h2>
            <div className="rounded-2xl overflow-hidden mb-5" style={{background:card,border:'1px solid '+bdr}}>
              {biz.hours.map((h,i) => <div key={i} className="flex justify-between px-4 py-3" style={{borderBottom:i<biz.hours.length-1?'1px solid '+bdr:'none'}}><span className="text-sm font-medium" style={{color:tx}}>{h.day}</span><span className="text-sm" style={{color:mu}}>{h.time}</span></div>)}
            </div>
          </>}
        </div>
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 z-40" style={{background:dm?'linear-gradient(to top,#0a0a0a 70%,transparent)':'linear-gradient(to top,#f9fafb 70%,transparent)'}}>
          <button onClick={()=>setShowBooking(true)} className="w-full max-w-2xl mx-auto block rounded-2xl py-4 font-bold text-white text-lg shadow-lg" style={{background:`linear-gradient(135deg,${accent} 0%,${accentDark} 100%)`}}>
            {selectedSvc ? 'Book '+selectedSvc.name+' — $'+(selectedSvc.price_cents/100).toFixed(2) : 'Book Appointment'}
          </button>
        </div>
        {showBooking && <>
          <div className="fixed inset-0 z-50" style={{background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)'}} onClick={()=>setShowBooking(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl shadow-2xl" style={{background:card,maxHeight:'90vh',overflowY:'auto'}}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-lg font-bold" style={{color:tx}}>{done?'Booked!':selectedSvc?selectedSvc.name:'Book Appointment'}</h3>
              <button onClick={()=>setShowBooking(false)} className="w-8 h-8 flex items-center justify-center rounded-full" style={{background:dm?'#2c2c2e':'#f5f5f5'}}><svg className="w-4 h-4" style={{color:tx}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            {done ? (
              <div className="px-5 pb-8 text-center">
                <div className="text-5xl mb-3">✅</div>
                <p className="font-semibold text-lg mb-1" style={{color:tx}}>Request Sent!</p>
                <p className="text-sm mb-6" style={{color:mu}}>The business will confirm shortly. Check your bookings for updates.</p>
                <button onClick={()=>router.push('/bookings')} className="w-full py-3.5 rounded-2xl font-bold text-white" style={{background:accent}}>View My Bookings</button>
              </div>
            ) : (
              <div className="px-5 pb-8 flex flex-col gap-4">
                {selectedSvc && <div className="rounded-xl p-4" style={{background:dm?'#2c2c2e':'#f9fafb',border:'1px solid '+bdr}}><div className="flex justify-between"><div><p className="font-semibold" style={{color:tx}}>{selectedSvc.name}</p><p className="text-sm" style={{color:mu}}>{selectedSvc.duration_min} min</p></div><p className="font-bold text-lg" style={{color:accent}}>{'$'+(selectedSvc.price_cents/100).toFixed(2)}</p></div></div>}
                <div><label className="text-sm font-semibold mb-1 block" style={{color:mu}}>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full rounded-xl px-4 py-3 text-sm outline-none" style={{background:dm?'#2c2c2e':'#f5f5f5',color:tx,border:'1.5px solid '+bdr}} /></div>
                <div><label className="text-sm font-semibold mb-1 block" style={{color:mu}}>Time</label><input type="time" value={time} onChange={e=>setTime(e.target.value)} className="w-full rounded-xl px-4 py-3 text-sm outline-none" style={{background:dm?'#2c2c2e':'#f5f5f5',color:tx,border:'1.5px solid '+bdr}} /></div>
                <div><label className="text-sm font-semibold mb-1 block" style={{color:mu}}>Note (optional)</label><textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="Describe what you need..." className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none" style={{background:dm?'#2c2c2e':'#f5f5f5',color:tx,border:'1.5px solid '+bdr}} /></div>
                {err && <p className="text-red-500 text-sm">{err}</p>}
                <button onClick={book} disabled={submitting} className="w-full py-4 rounded-2xl font-bold text-white text-lg" style={{background:submitting?'#9ca3af':`linear-gradient(135deg,${accent} 0%,${accentDark} 100%)`}}>{submitting?'Booking...':selectedSvc?'Request '+selectedSvc.name:'Request Appointment'}</button>
              </div>
            )}
          </div>
        </>}
      </div>
    </>
  );
}
