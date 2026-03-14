// components/BusinessProfile.tsx
import { useEffect, useRef, useState } from 'react';
import { useDm } from '../lib/DarkModeContext';
import type { Business } from '../lib/mockBusinesses';

/* ─── PureBtn: bypasses global button active-scale ─── */
function PureBtn({ onClick, className, children, style, disabled }: {
  onClick: () => void; className?: string; children: React.ReactNode;
  style?: React.CSSProperties; disabled?: boolean;
}) {
  return (
    <button type="button" onPointerDown={e => { if (!disabled) { e.preventDefault(); onClick(); } }}
      disabled={disabled}
      className={className} style={{ WebkitTapHighlightColor: 'transparent', ...(style || {}) }}>
      {children}
    </button>
  );
}

/* ─── Stars ─── */
function Stars({ rating }: { rating: number }) {
  const { dm } = useDm();
  return (
    <span className="flex items-center gap-1">
      <svg className="h-3.5 w-3.5 text-amber-400 fill-current flex-shrink-0" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <span className="text-sm font-semibold tabular-nums" style={{ color: dm ? '#d1d5db' : '#404040' }}>{rating}</span>
    </span>
  );
}

/* ─── Mini calendar ─── */
const TIME_SLOTS = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];

function MiniCalendar({ selected, onSelect }: { selected: Date | null; onSelect: (d: Date) => void }) {
  const { dm } = useDm();
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
        <PureBtn onClick={() => setVm(new Date(y, m - 1, 1))}
          className="h-7 w-7 rounded-full flex items-center justify-center transition-colors" style={{ color: dm ? '#9ca3af' : '#737373', background: dm ? 'transparent' : undefined }}>
          <svg className="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/></svg>
        </PureBtn>
        <p className="text-sm font-bold" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{MONTHS[m]} {y}</p>
        <PureBtn onClick={() => setVm(new Date(y, m + 1, 1))}
          className="h-7 w-7 rounded-full flex items-center justify-center transition-colors" style={{ color: dm ? '#9ca3af' : '#737373', background: dm ? 'transparent' : undefined }}>
          <svg className="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
        </PureBtn>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => <div key={d} className="text-center text-[10px] font-bold py-1" style={{ color: dm ? 'rgba(255,255,255,0.35)' : '#a3a3a3' }}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const isPast = date < today;
          const isToday = date.getTime() === today.getTime();
          const isSel = selected?.getTime() === date.getTime();
          return (
            <PureBtn key={i} onClick={() => !isPast && onSelect(date)}
              className={`mx-auto h-8 w-8 rounded-full text-xs font-medium flex items-center justify-center transition-colors ${
                isSel ? 'bg-accent text-white' :
                isToday ? 'border-2 border-accent text-accent hover:bg-blue-50' :
                isPast ? 'text-neutral-300 cursor-not-allowed' :
                'text-neutral-700 hover:bg-neutral-100'
              }`}>
              {date.getDate()}
            </PureBtn>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Booking sub-view ─── */
const SERVICES_CONTEXT = [
  'General consultation / estimate',
  'Emergency / urgent repair',
  'Routine maintenance',
  'New installation',
  'Inspection only',
  'Quote for larger project',
];

function BookingView({ biz, onBack }: { biz: Business; onBack: () => void }) {
  const { dm } = useDm();
  const [date, setDate] = useState<Date | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState<string>('');
  const [note, setNote] = useState('');
  const [address, setAddress] = useState('');
  const [done, setDone] = useState(false);

  if (done) return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-16 w-16 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mb-5">
        <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-neutral-900 mb-1">Request sent!</h3>
      <p className="text-sm text-neutral-500 mb-1">{biz.name} will confirm your appointment.</p>
      {date && slot && (
        <p className="text-xs text-neutral-400 mt-1">{date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {slot}</p>
      )}
      <p className="text-xs text-neutral-400 mt-3 max-w-xs">You'll receive a confirmation once the business accepts. Check My Bookings to track your request.</p>
      <button onClick={onBack} className="mt-8 text-sm text-accent font-semibold hover:underline">
        Back to business info
      </button>
    </div>
  );

  const canSubmit = date && slot && note.trim().length > 5 && address.trim().length > 3;

  return (
    <div>
      {/* Sticky back bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b sticky top-0 z-10" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#f5f5f5' }}>
        <PureBtn onClick={onBack}
          className="h-8 w-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors">
          <svg className="h-4 w-4 text-neutral-600 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </PureBtn>
        <div className="min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: dm ? '#f3f4f6' : '#171717' }}>Book {biz.name}</p>
          <p className="text-xs" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>{biz.category} · {biz.address}</p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-6">

        {/* Pricing reference */}
        <div className="rounded-2xl px-4 py-3" style={{ background: dm ? '#0d1f35' : '#eff6ff', border: dm ? '1px solid rgba(59,130,246,0.3)' : '1px solid #dbeafe' }}>
          <p className="text-xs font-bold text-accent uppercase tracking-wide mb-2">Typical pricing</p>
          <div className="grid grid-cols-2 gap-1.5">
            {biz.services.slice(0, 4).map(s => (
              <div key={s.name} className="flex items-start justify-between gap-2">
                <span className="text-xs leading-snug" style={{ color: dm ? '#9ca3af' : '#525252' }}>{s.name}</span>
                <span className="text-xs font-semibold whitespace-nowrap flex-shrink-0" style={{ color: dm ? '#d1d5db' : '#262626' }}>{s.price}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-neutral-400 mt-2">Final price confirmed after visit · Free to request</p>
        </div>

        {/* Type of service */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: dm ? 'rgba(255,255,255,0.4)' : '#737373' }}>What do you need?</p>
          <div className="grid grid-cols-2 gap-2">
            {SERVICES_CONTEXT.map(s => (
              <PureBtn key={s} onClick={() => setServiceType(s)}
                className={`py-2.5 px-3 rounded-xl text-xs font-medium text-left border transition-colors ${serviceType === s ? 'bg-accent text-white border-accent' : ''}`}
                style={serviceType === s ? {} : { background: dm ? '#0d0d0d' : 'white', color: dm ? '#d1d5db' : '#404040', borderColor: dm ? '#262626' : '#e5e5e5' }}>
                {s}
              </PureBtn>
            ))}
          </div>
        </div>

        {/* Calendar */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: dm ? 'rgba(255,255,255,0.4)' : '#737373' }}>Preferred date</p>
          <div className="bg-neutral-50 rounded-2xl p-4">
            <MiniCalendar selected={date} onSelect={d => { setDate(d); setSlot(null); }} />
          </div>
        </div>

        {/* Time slots */}
        {date && (
          <div>
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-2.5">
              Available times — {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {TIME_SLOTS.map(s => (
                <PureBtn key={s} onClick={() => setSlot(s)}
                  className={`py-2.5 rounded-xl text-xs font-semibold text-center border transition-colors ${
                    slot === s ? 'bg-accent text-white border-accent' : ''
                  }`}>
                  {s}
                </PureBtn>
              ))}
            </div>
          </div>
        )}

        {/* Service address */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: dm ? 'rgba(255,255,255,0.4)' : '#737373' }}>Service address</p>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Your address or unit where work is needed"
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </div>

        {/* Description */}
        <div>
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-2">Describe the job</p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={`e.g. My ${biz.category.toLowerCase()} needs attention — describe the issue, how long it's been happening, and anything else helpful...`}
            rows={4}
            className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none" style={{ background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : '#e5e5e5', color: dm ? '#f3f4f6' : '#171717' }}
          />
          <p className="text-[11px] text-neutral-400 mt-1.5">The more detail, the faster they can prepare.</p>
        </div>

        {/* Hours reminder */}
        <div className="bg-neutral-50 rounded-xl px-4 py-3 flex items-start gap-3">
          <svg className="h-4 w-4 text-neutral-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-neutral-700 mb-0.5">Business hours</p>
            {biz.hours.map(h => (
              <p key={h.day} className="text-xs text-neutral-500">{h.day}: {h.time}</p>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button type="button"
          disabled={!canSubmit}
          onClick={() => { if (canSubmit) setDone(true); }}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-colors ${
            canSubmit ? 'text-white' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
          }`}
          style={canSubmit ? { background: 'linear-gradient(135deg,#0A84FF 0%,#0066CC 100%)' } : {}}>
          {canSubmit
            ? `Request ${date!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${slot}`
            : 'Fill in the details above to continue'}
        </button>
        <p className="text-center text-xs text-neutral-400 -mt-3">Free to request · No payment required now · Cancel anytime</p>
      </div>
    </div>
  );
}

/* ─── Main modal ─── */
export default function BusinessProfile({ biz, onClose }: { biz: Business; onClose: () => void }) {
  const { dm } = useDm();
  const [activeImg, setActiveImg] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [view, setView] = useState<'info' | 'book'>('info');
  const thumbsRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function close() {
    setClosing(true);
    // Fade out only — no scale on close so text doesn't shrink visibly
    setTimeout(onClose, 250);
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  function goImg(dir: 1 | -1) {
    setActiveImg(cur => {
      const next = (cur + dir + biz.allImages.length) % biz.allImages.length;
      setTimeout(() => {
        (thumbsRef.current?.children[next] as HTMLElement)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }, 0);
      return next;
    });
  }

  function pickThumb(i: number) {
    if (isDragging.current) return;
    setActiveImg(i);
    (thumbsRef.current?.children[i] as HTMLElement)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  const ready = mounted && !closing;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
      style={{
        background: `rgba(0,0,0,${ready ? 0.5 : 0})`,
        backdropFilter: `blur(${ready ? 6 : 0}px)`,
        // On close: fade backdrop, but don't scale the modal (to avoid shrinking text)
        transition: closing
          ? 'background 0.25s ease, backdrop-filter 0.25s ease'
          : 'background 0.2s ease, backdrop-filter 0.2s ease',
      }}
      onClick={close}>
      <div
        onClick={e => e.stopPropagation()}
        className="relative rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col"
        style={{
          background: dm ? '#171717' : 'white',
          opacity: ready ? 1 : 0,
          transform: !closing && !ready ? 'scale(0.96)' : 'scale(1)',
          transition: closing
            ? 'opacity 0.25s ease'
            : 'opacity 0.2s ease, transform 0.2s ease',
        }}
      >
        {/* Gallery */}
        <div className="relative flex-shrink-0 bg-neutral-900" style={{ height: 220 }}>
          <img key={activeImg} src={biz.allImages[activeImg]} alt={biz.name}
            className="w-full h-full object-cover"
            style={{ opacity: ready ? 1 : 0, transition: 'opacity 0.15s ease' }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10 pointer-events-none" />

          {biz.allImages.length > 1 && (
            <>
              <PureBtn onClick={() => goImg(-1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <svg className="h-4 w-4 text-white pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </PureBtn>
              <PureBtn onClick={() => goImg(1)}
                className="absolute right-12 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <svg className="h-4 w-4 text-white pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </PureBtn>
            </>
          )}

          {/* Draggable thumbnail carousel */}
          <div ref={thumbsRef}
            className="absolute bottom-2.5 left-3 flex gap-1.5 overflow-x-auto"
            style={{ maxWidth: 'calc(100% - 52px)', scrollbarWidth: 'none', cursor: 'grab' } as React.CSSProperties}
            onMouseDown={e => {
              const el = e.currentTarget;
              isDragging.current = false;
              const onMove = (ev: MouseEvent) => { isDragging.current = true; el.scrollLeft -= ev.movementX; };
              const onUp = () => { setTimeout(() => { isDragging.current = false; }, 50); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}>
            {biz.allImages.map((url, i) => (
              <button key={i} type="button" onPointerDown={e => e.preventDefault()} onClick={() => pickThumb(i)}
                className="flex-shrink-0 h-10 w-14 rounded-lg overflow-hidden transition-all"
                style={{ border: `2px solid ${i === activeImg ? '#fff' : 'transparent'}`, opacity: i === activeImg ? 1 : 0.6 }}>
                <img src={url} alt="" className="w-full h-full object-cover pointer-events-none" />
              </button>
            ))}
          </div>

          <PureBtn onClick={close}
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <svg className="h-4 w-4 text-white pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </PureBtn>

          <div className="absolute top-3 left-3 pointer-events-none">
            {biz.available
              ? <span className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-semibold text-green-700"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />Open</span>
              : <span className="backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-semibold text-white/80" style={{ background: 'rgba(0,0,0,0.55)' }}>Fully Booked</span>}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {view === 'book' ? <BookingView biz={biz} onBack={() => setView('info')} /> : (
            <>
              <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: dm ? '#262626' : '#f5f5f5' }}>
                <p className="text-xs font-medium mb-0.5" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>{biz.category}</p>
                <h2 className="text-xl font-bold" style={{ letterSpacing: '-0.02em', color: dm ? '#f3f4f6' : '#171717' }}>{biz.name}</h2>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <Stars rating={biz.rating} />
                  <span className="text-sm" style={{ color: dm ? '#9ca3af' : '#737373' }}>{biz.reviews} reviews</span>
                  <span className="text-neutral-200">·</span>
                  <span className="text-sm" style={{ color: dm ? '#9ca3af' : '#737373' }}>{biz.distance}</span>
                  <span className="text-sm font-medium text-neutral-400">{'$'.repeat(biz.price_tier)}<span className="opacity-25">{'$'.repeat(3 - biz.price_tier)}</span></span>
                  {biz.badge && <span className="text-xs font-semibold text-accent bg-blue-50 px-2 py-0.5 rounded-full">{biz.badge}</span>}
                </div>
                <p className="text-sm mt-3 leading-relaxed" style={{ color: dm ? '#9ca3af' : '#737373' }}>{biz.description}</p>
              </div>

              <div className="px-6 py-4 border-b" style={{ borderColor: dm ? '#262626' : '#f5f5f5' }}>
                <h3 className="text-sm font-bold mb-3" style={{ color: dm ? '#f3f4f6' : '#171717' }}>Services &amp; pricing</h3>
                <div className="grid grid-cols-2 gap-2">
                  {biz.services.map(s => (
                    <div key={s.name} className="bg-neutral-50 rounded-xl px-3 py-2.5">
                      <p className="text-sm font-medium text-neutral-800 leading-snug">{s.name}</p>
                      <p className="text-xs text-accent font-semibold mt-0.5">{s.price}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-6 py-4 grid grid-cols-2 gap-6 border-b border-neutral-100">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 mb-3">Hours</h3>
                  <div className="space-y-1.5">
                    {biz.hours.map(h => (
                      <div key={h.day} className="flex justify-between gap-4">
                        <span className="text-xs font-medium text-neutral-500">{h.day}</span>
                        <span className="text-xs text-neutral-700 text-right">{h.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 mb-3">Contact</h3>
                  <div className="space-y-2">
                    <a href={`tel:${biz.phone}`} className="flex items-center gap-2 text-xs text-neutral-600 hover:text-accent transition-colors">
                      <svg className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                      {biz.phone}
                    </a>
                    <a href={`mailto:${biz.email}`} className="flex items-center gap-2 text-xs text-neutral-600 hover:text-accent transition-colors">
                      <svg className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                      {biz.email}
                    </a>
                    <div className="flex items-start gap-2 text-xs text-neutral-500">
                      <svg className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                      <span className="leading-snug">{biz.address}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5">
                <button type="button" onClick={() => setView('book')}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-colors"
                  style={{ background: 'linear-gradient(135deg,#0A84FF 0%,#0066CC 100%)' }}>
                  Book {biz.name}
                </button>
                <p className="text-center text-xs text-neutral-400 mt-2">Free to request · No commitment</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
