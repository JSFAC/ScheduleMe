// components/BusinessProfile.tsx
// Full-screen business profile modal: image gallery, services, hours, book CTA
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { Business } from '../lib/mockBusinesses';

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-4 w-4' : 'h-3 w-3';
  return (
    <span className="flex items-center gap-1">
      <svg className={`${cls} text-amber-400 fill-current flex-shrink-0`} viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <span className={`font-semibold text-neutral-700 tabular-nums ${size === 'md' ? 'text-sm' : 'text-xs'}`}>{rating}</span>
    </span>
  );
}

export default function BusinessProfile({ biz, onClose, onBook }: {
  biz: Business;
  onClose: () => void;
  onBook?: () => void;
}) {
  const router = useRouter();
  const [activeImg, setActiveImg] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Close with animation
  function handleClose() {
    setClosing(true);
    setTimeout(onClose, 220);
  }

  // Keyboard close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  function prevImg() { setActiveImg(i => (i - 1 + biz.allImages.length) % biz.allImages.length); }
  function nextImg() { setActiveImg(i => (i + 1) % biz.allImages.length); }

  const ready = mounted && !closing;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
      style={{
        background: `rgba(0,0,0,${ready ? 0.5 : 0})`,
        backdropFilter: `blur(${ready ? 6 : 0}px)`,
        transition: 'background 0.22s ease, backdrop-filter 0.22s ease',
      }}
      onClick={handleClose}
    >
      {/* Modal panel */}
      <div
        onClick={e => e.stopPropagation()}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          opacity: ready ? 1 : 0,
          transform: ready ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(16px)',
          transition: 'opacity 0.22s ease, transform 0.22s ease',
        }}
      >
        {/* Image gallery */}
        <div className="relative flex-shrink-0" style={{ height: '240px' }}>
          <img
            src={biz.allImages[activeImg]}
            alt={biz.name}
            className="w-full h-full object-cover"
            style={{ transition: 'opacity 0.18s ease' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />

          {/* Nav arrows */}
          {biz.allImages.length > 1 && (
            <>
              <button onClick={prevImg}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center transition-colors">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <button onClick={nextImg}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center transition-colors">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
              {/* Dot indicator */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {biz.allImages.map((_, i) => (
                  <button key={i} onClick={() => setActiveImg(i)}
                    className={`h-1.5 rounded-full transition-all ${i === activeImg ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
                ))}
              </div>
            </>
          )}

          {/* Thumbnail strip */}
          <div className="absolute bottom-3 right-12 flex gap-1.5">
            {biz.allImages.slice(0, 4).map((url, i) => (
              <button key={i} onClick={() => setActiveImg(i)}
                className={`h-9 w-12 rounded-lg overflow-hidden border-2 transition-all ${i === activeImg ? 'border-white scale-105' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          {/* Close */}
          <button onClick={handleClose}
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center transition-colors">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Status pill */}
          <div className="absolute top-3 left-3">
            {biz.available ? (
              <span className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-semibold text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />Open
              </span>
            ) : (
              <span className="bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-semibold text-white/80">Currently busy</span>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-neutral-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-neutral-400 mb-0.5">{biz.category}</p>
                <h2 className="text-xl font-bold text-neutral-900" style={{ letterSpacing: '-0.02em' }}>{biz.name}</h2>
                <div className="flex items-center gap-3 mt-1.5">
                  <Stars rating={biz.rating} size="md" />
                  <span className="text-sm text-neutral-500">{biz.reviews} reviews</span>
                  <span className="text-neutral-200">·</span>
                  <span className="text-sm text-neutral-500">{biz.distance}</span>
                  {biz.badge && (
                    <>
                      <span className="text-neutral-200">·</span>
                      <span className="text-xs font-semibold text-accent">{biz.badge}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-sm font-medium text-neutral-400">
                  {'$'.repeat(biz.price_tier)}<span className="opacity-25">{'$'.repeat(3 - biz.price_tier)}</span>
                </span>
              </div>
            </div>
            <p className="text-sm text-neutral-500 mt-3 leading-relaxed">{biz.description}</p>
          </div>

          {/* Services */}
          <div className="px-6 py-4 border-b border-neutral-100">
            <h3 className="text-sm font-bold text-neutral-900 mb-3">Services</h3>
            <div className="grid grid-cols-2 gap-2">
              {biz.services.map(s => (
                <div key={s.name} className="bg-neutral-50 rounded-xl px-3 py-2.5">
                  <p className="text-sm font-medium text-neutral-800 leading-snug">{s.name}</p>
                  <p className="text-xs text-accent font-semibold mt-0.5">{s.price}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Hours + Contact */}
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
                  <svg className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  {biz.phone}
                </a>
                <a href={`mailto:${biz.email}`} className="flex items-center gap-2 text-xs text-neutral-600 hover:text-accent transition-colors">
                  <svg className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  {biz.email}
                </a>
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <svg className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <span className="leading-snug">{biz.address}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Book CTA */}
          <div className="px-6 py-5">
            <button
              onClick={() => {
                handleClose();
                setTimeout(() => router.push(`/bookings?business=${biz.id}`), 220);
              }}
              className="w-full py-3.5 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent-dark transition-colors"
            >
              Book {biz.name}
            </button>
            <p className="text-center text-xs text-neutral-400 mt-2">Free to request · No commitment</p>
          </div>
        </div>
      </div>
    </div>
  );
}
