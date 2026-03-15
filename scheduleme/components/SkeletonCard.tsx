// components/SkeletonCard.tsx — shimmer skeleton for business cards
import { useDm } from '../lib/DarkModeContext';

export function SkeletonCard() {
  const { dm } = useDm();
  return (
    <div className="rounded-2xl overflow-hidden flex-shrink-0"
      style={{ width: 'clamp(220px, 18vw, 290px)', background: dm ? '#171717' : 'white', border: `1px solid ${dm ? '#262626' : '#f0f0f0'}` }}>
      {/* Image area */}
      <div className="animate-shimmer" style={{ height: 'clamp(175px, 14vw, 220px)' }} />
      {/* Body */}
      <div className="px-3.5 pt-2.5 pb-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="animate-shimmer rounded-full h-5" style={{ width: 80 }} />
          <div className="animate-shimmer rounded h-4 w-4" />
        </div>
        <div className="animate-shimmer rounded h-2.5" style={{ width: '85%' }} />
        <div className="animate-shimmer rounded h-2.5" style={{ width: '65%' }} />
        <div className="flex items-center gap-1.5 mt-1">
          <div className="animate-shimmer rounded-full h-4 w-4" />
          <div className="animate-shimmer rounded h-2.5" style={{ width: 60 }} />
        </div>
      </div>
    </div>
  );
}

// Row of skeleton cards for scroll sections
export function SkeletonScrollRow({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-3.5 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// Skeleton for booking cards
export function SkeletonBookingCard({ dm }: { dm?: boolean }) {
  return (
    <div className="rounded-2xl border p-5 space-y-3"
      style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#f0f0f0' }}>
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="animate-shimmer rounded h-3.5" style={{ width: '60%' }} />
          <div className="animate-shimmer rounded h-2.5" style={{ width: '40%' }} />
        </div>
        <div className="animate-shimmer rounded-full h-6 w-16" />
      </div>
      <div className="animate-shimmer rounded h-2.5" style={{ width: '80%' }} />
      <div className="animate-shimmer rounded h-2.5" style={{ width: '50%' }} />
    </div>
  );
}

// Skeleton for message thread items
export function SkeletonThread({ dm }: { dm?: boolean }) {
  return (
    <div className="px-4 py-3.5 border-b flex items-start gap-3"
      style={{ borderColor: dm ? '#1e1e1e' : '#fafafa' }}>
      <div className="animate-shimmer rounded-lg h-7 w-7 shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <div className="animate-shimmer rounded h-3" style={{ width: '55%' }} />
        <div className="animate-shimmer rounded h-2.5" style={{ width: '75%' }} />
      </div>
    </div>
  );
}
