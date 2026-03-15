// components/ReviewModal.tsx — post-booking review popup
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useDm } from '../lib/DarkModeContext';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props {
  bookingId: string;
  businessId: string;
  businessName: string;
  serviceName: string;
  onDone: () => void;
}

export default function ReviewModal({ bookingId, businessId, businessName, serviceName, onDone }: Props) {
  const { dm } = useDm();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit() {
    if (!rating) return;
    setSubmitting(true); setError('');
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ booking_id: bookingId, business_id: businessId, rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setDone(true);
      setTimeout(onDone, 1800);
    } catch { setError('Something went wrong. Please try again.'); }
    finally { setSubmitting(false); }
  }

  const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];
  const activeRating = hovered || rating;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-3xl shadow-2xl animate-fade-up"
        style={{ background: dm ? '#171717' : 'white', border: `1px solid ${dm ? '#262626' : '#f0f0f0'}` }}>

        {done ? (
          <div className="p-8 text-center">
            <div className="text-5xl mb-4">⭐</div>
            <p className="text-lg font-black mb-1" style={{ color: dm ? '#f3f4f6' : '#171717', letterSpacing: '-0.02em' }}>
              Thanks for the review!
            </p>
            <p className="text-sm" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
              Your feedback helps other customers.
            </p>
          </div>
        ) : (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-accent mb-1">Rate your experience</p>
                <p className="text-base font-black" style={{ letterSpacing: '-0.02em', color: dm ? '#f3f4f6' : '#171717' }}>
                  {businessName}
                </p>
                <p className="text-xs mt-0.5" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>{serviceName}</p>
              </div>
              <button onClick={onDone} className="text-xs px-3 py-1.5 rounded-xl"
                style={{ color: dm ? '#6b7280' : '#a3a3a3', background: dm ? '#262626' : '#f5f5f5' }}>
                Skip
              </button>
            </div>

            {/* Stars */}
            <div className="flex items-center gap-2 mb-2 justify-center">
              {[1, 2, 3, 4, 5].map(i => (
                <button key={i}
                  onClick={() => setRating(i)}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(0)}
                  className="transition-transform hover:scale-110 active:scale-95">
                  <svg className="h-10 w-10 transition-colors duration-150" fill="currentColor" viewBox="0 0 20 20"
                    style={{ color: i <= activeRating ? '#f59e0b' : (dm ? '#333' : '#e5e7eb') }}>
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>
            <p className="text-center text-sm font-semibold mb-5 h-5"
              style={{ color: activeRating ? '#f59e0b' : (dm ? '#6b7280' : '#a3a3a3') }}>
              {LABELS[activeRating]}
            </p>

            {/* Comment */}
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Tell others about your experience (optional)"
              rows={3}
              maxLength={500}
              className="w-full px-4 py-3 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent transition-all mb-4"
              style={{
                background: dm ? '#0d0d0d' : '#f9fafb',
                borderColor: dm ? '#262626' : '#e5e7eb',
                color: dm ? '#f3f4f6' : '#171717',
              }}
            />

            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

            <button onClick={submit} disabled={!rating || submitting}
              className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-40"
              style={{ background: rating ? '#0A84FF' : (dm ? '#262626' : '#e5e7eb'), color: rating ? 'white' : (dm ? '#6b7280' : '#a3a3a3') }}>
              {submitting ? 'Submitting…' : 'Submit Review'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
