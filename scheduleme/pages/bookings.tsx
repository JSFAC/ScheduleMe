// pages/bookings.tsx — Book a service + booking history with clickable detail sheets
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import { maybeSendWelcomeEmail } from '../lib/sendWelcome';
import { createClient } from '@supabase/supabase-js';
import { SPONSORED } from '../lib/mockBusinesses';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Booking {
  id: string;
  service: string;
  category: string;
  status: string;
  created_at: string;
  scheduled_at?: string;
  address?: string;
  notes?: string;
  business_name?: string;
  business_phone?: string;
  business_email?: string;
  amount_cents?: number;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; barColor: string }> = {
  pending:         { label: 'Pending Review',   bg: 'bg-amber-50  border-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-400', barColor: '#f59e0b' },
  confirmed:       { label: 'Confirmed',         bg: 'bg-blue-50   border-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500',  barColor: '#3b82f6' },
  payment_pending: { label: 'Payment Pending',   bg: 'bg-violet-50 border-violet-100', text: 'text-violet-700', dot: 'bg-violet-500',barColor: '#8b5cf6' },
  paid:            { label: 'Paid',              bg: 'bg-green-50  border-green-100',  text: 'text-green-700',  dot: 'bg-green-500', barColor: '#22c55e' },
  completed:       { label: 'Completed',         bg: 'bg-green-50  border-green-100',  text: 'text-green-700',  dot: 'bg-green-500', barColor: '#22c55e' },
  cancelled:       { label: 'Cancelled',         bg: 'bg-neutral-50 border-neutral-200', text: 'text-neutral-500', dot: 'bg-neutral-400', barColor: '#a3a3a3' },
  payment_failed:  { label: 'Payment Failed',    bg: 'bg-red-50    border-red-100',    text: 'text-red-600',    dot: 'bg-red-400',   barColor: '#ef4444' },
};

const STEPS = ['pending', 'confirmed', 'paid', 'completed'];
const STEP_LABELS = ['Submitted', 'Confirmed', 'Paid', 'Done'];

const MOCK_BOOKINGS: Booking[] = [
  {
    id: '1', service: 'Leaking kitchen faucet — under sink dripping badly', category: 'Plumbing', status: 'confirmed',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    address: '421 Hayes St, San Francisco, CA 94102',
    notes: 'Please bring replacement parts for a standard kitchen faucet. Dog in the house, she is friendly.',
    business_name: 'Pacific Plumbing Co.', business_phone: '(415) 555-0192', business_email: 'hello@pacificplumbing.com',
    amount_cents: undefined,
  },
  {
    id: '2', service: 'Deep clean 2BR apartment before move-out', category: 'House Cleaning', status: 'completed',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    scheduled_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    address: '140 New Montgomery St, San Francisco, CA 94105',
    business_name: 'Sparkle Clean SF', business_phone: '(415) 555-0108', business_email: 'team@sparkleclean.com',
    amount_cents: 29000,
  },
  {
    id: '3', service: 'Electrical panel inspection — circuit keeps tripping', category: 'Electrical', status: 'pending',
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    address: '1 Ferry Building, San Francisco, CA 94111',
    notes: 'Circuit for the kitchen has been tripping every few days.',
    business_name: undefined,
    amount_cents: undefined,
  },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hrs = diff / 3600000;
  const days = diff / 86400000;
  if (hrs < 1) return 'Just now';
  if (hrs < 24) return `${Math.floor(hrs)}h ago`;
  if (days < 7) return `${Math.floor(days)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ProgressBar({ status }: { status: string }) {
  const idx = STEPS.indexOf(status);
  return (
    <div className="mt-5">
      <div className="flex items-center">
        {STEPS.map((s, i) => {
          const done = i <= idx;
          const isLast = i === STEPS.length - 1;
          return (
            <div key={s} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
              <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 transition-colors ${done ? 'bg-accent' : 'bg-neutral-200'}`} />
              {!isLast && <div className={`h-0.5 flex-1 transition-colors ${i < idx ? 'bg-accent' : 'bg-neutral-200'}`} />}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        {STEP_LABELS.map((l, i) => (
          <span key={l} className={`text-[10px] font-medium ${i <= idx ? 'text-accent' : 'text-neutral-400'}`}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function DetailSheet({ booking, originRect, onClose, onCancel }: {
  booking: Booking;
  originRect: DOMRect | null;
  onClose: () => void;
  onCancel: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function close() { setClosing(true); setTimeout(onClose, 220); }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  async function handleCancel() {
    setCancelling(true);
    await new Promise(r => setTimeout(r, 600));
    onCancel(booking.id);
    close();
  }

  const ready = mounted && !closing;

  // Compute morph origin: where on screen the card was
  const origin = originRect;
  const vpW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vpH = typeof window !== 'undefined' ? window.innerHeight : 800;

  // Target modal: centered, max-w-lg (~512px), max-h 88vh
  const modalW = Math.min(512, vpW - 32);
  const modalH = Math.min(vpH * 0.88, 640);
  const targetX = (vpW - modalW) / 2;
  const targetY = (vpH - modalH) / 2;

  // Origin card position
  const fromX = origin ? origin.left : targetX;
  const fromY = origin ? origin.top : targetY;
  const fromW = origin ? origin.width : modalW;
  const fromH = origin ? origin.height : modalH;

  // Scale to go from card size → modal size
  const scaleX = ready ? 1 : fromW / modalW;
  const scaleY = ready ? 1 : fromH / modalH;
  // Translation from card center to modal center
  const cardCX = origin ? fromX + fromW / 2 : vpW / 2;
  const cardCY = origin ? fromY + fromH / 2 : vpH / 2;
  const modalCX = vpW / 2;
  const modalCY = vpH / 2;
  const tx = ready ? 0 : cardCX - modalCX;
  const ty = ready ? 0 : cardCY - modalCY;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: `rgba(0,0,0,${ready ? 0.45 : 0})`,
        backdropFilter: `blur(${ready ? 5 : 0}px)`,
        transition: closing
          ? 'background 0.22s ease, backdrop-filter 0.22s ease'
          : 'background 0.35s ease, backdrop-filter 0.35s ease',
      }}
      onClick={close}>

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-y-auto"
        style={{
          maxHeight: '88vh',
          // Opening: morph from card. Closing: fade out only (no scale) so text stays legible
          opacity: ready ? 1 : closing ? 0 : 0.15,
          transform: closing
            ? 'scale(1)'
            : `translate(${tx}px, ${ty}px) scaleX(${scaleX}) scaleY(${scaleY})`,
          transformOrigin: 'center center',
          transition: closing
            ? 'opacity 0.22s ease'
            : ready
              ? 'opacity 0.35s ease, transform 0.42s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
              : 'none',
        }}
        onClick={e => e.stopPropagation()}>

        {/* Close */}
        <button onClick={close} className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors">
          <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-6 pb-8 pt-6 max-w-xl mx-auto">
          <h2 className="text-lg font-bold text-neutral-900 leading-snug pr-8">{booking.service}</h2>
          <p className="text-xs text-neutral-400 mt-1 mb-5">Submitted {formatDate(booking.created_at)}</p>

          <StatusBadge status={booking.status} />
          {!['cancelled', 'payment_failed'].includes(booking.status) && (
            <ProgressBar status={booking.status} />
          )}

          <div className="h-px bg-neutral-100 my-6" />

          <div className="space-y-3.5">
            {booking.scheduled_at && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Scheduled</p>
                  <p className="text-sm text-neutral-800 mt-0.5">{formatDateLong(booking.scheduled_at)}</p>
                </div>
              </div>
            )}

            {booking.address && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Location</p>
                  <p className="text-sm text-neutral-800 mt-0.5">{booking.address}</p>
                </div>
              </div>
            )}

            {booking.business_name && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Business</p>
                  <p className="text-sm font-semibold text-neutral-800 mt-0.5">{booking.business_name}</p>
                  {(booking.business_phone || booking.business_email) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {booking.business_phone && (
                        <a href={`tel:${booking.business_phone}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                          </svg>
                          {booking.business_phone}
                        </a>
                      )}
                      {booking.business_email && (
                        <a href={`mailto:${booking.business_email}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 bg-neutral-50 border border-neutral-200 px-3 py-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                          </svg>
                          {booking.business_email}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {booking.notes && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                  <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Your Notes</p>
                  <p className="text-sm text-neutral-600 mt-0.5 leading-relaxed">{booking.notes}</p>
                </div>
              </div>
            )}

            {booking.amount_cents && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                  <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Amount Paid</p>
                  <p className="text-sm font-bold text-neutral-900 mt-0.5">${(booking.amount_cents / 100).toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Cancel action */}
          {['pending', 'confirmed'].includes(booking.status) && (
            <div className="mt-8 pt-5 border-t border-neutral-100">
              {cancelling ? (
                <div className="flex items-center justify-center gap-2 py-3">
                  <div className="h-4 w-4 rounded-full border-2 border-red-300 border-t-red-500 animate-spin" />
                  <span className="text-sm text-red-500">Cancelling...</span>
                </div>
              ) : (
                <button onClick={handleCancel}
                  className="w-full py-3 rounded-xl border-2 border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 hover:border-red-300 transition-colors">
                  Cancel Request
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CantFindThem() {
  const [bizName, setBizName] = useState('');
  const [bizCategory, setBizCategory] = useState('');
  const [bizLocation, setBizLocation] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) return (
    <div className="bg-white rounded-2xl border border-neutral-100 p-8 text-center">
      <div className="h-14 w-14 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mx-auto mb-4">
        <svg className="h-7 w-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <h3 className="text-base font-bold text-neutral-900 mb-1">Request received</h3>
      <p className="text-sm text-neutral-500 max-w-xs mx-auto">We'll reach out to {bizName || 'them'} and let you know if they join ScheduleMe. Keep an eye on your email.</p>
      <button onClick={() => { setSent(false); setBizName(''); setBizCategory(''); setBizLocation(''); setNote(''); }}
        className="mt-6 text-sm text-accent font-medium hover:underline">
        Submit another request
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Explainer */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-6">
        <h2 className="text-base font-bold text-neutral-900 mb-1">Know a business we should add?</h2>
        <p className="text-sm text-neutral-500 leading-relaxed">
          If you already have a plumber, cleaner, or other pro you trust — tell us about them. We'll invite them to join ScheduleMe so you can book through us, and they can grow their business with new clients.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-100 p-6 space-y-4">
        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1.5">Business name <span className="text-red-400">*</span></label>
          <input type="text" value={bizName} onChange={e => setBizName(e.target.value)}
            placeholder="e.g. Joe's Plumbing, Maria's Cleaning Service"
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1.5">Category</label>
            <select value={bizCategory} onChange={e => setBizCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-accent appearance-none bg-white">
              <option value="">Select one</option>
              {['Plumbing','House Cleaning','Electrical','HVAC','Landscaping','Painting','Handyman','Roofing','Moving','Other'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1.5">Their area</label>
            <input type="text" value={bizLocation} onChange={e => setBizLocation(e.target.value)}
              placeholder="e.g. Mission District"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1.5">Why do you recommend them?</label>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="What did they do for you? How was the experience? Any contact info you have is helpful..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none" />
        </div>
        <button
          disabled={!bizName.trim()}
          onClick={() => { if (bizName.trim()) setSent(true); }}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
            bizName.trim() ? 'text-white' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
          }`}
          style={bizName.trim() ? { background: 'linear-gradient(135deg,#0A84FF 0%,#0066CC 100%)' } : {}}>
          Submit recommendation
        </button>
        <p className="text-center text-xs text-neutral-400">We'll contact them on your behalf. Your name won't be shared.</p>
      </div>
    </div>
  );
}

type Phase = 'loading' | 'welcome' | 'transitioning' | 'done';

const BookingsPage: NextPage = () => {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [userName, setUserName] = useState('');
  const [userInitials, setUserInitials] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  function openBooking(b: Booking, e: React.MouseEvent) {
    setOriginRect((e.currentTarget as HTMLElement).getBoundingClientRect());
    setSelectedBooking(b);
  }

  function cancelBooking(id: string) {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
  }

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const fullName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'there';
        const firstName = fullName.split(' ')[0];
        const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

        const { data: profile } = await supabase
          .from('profiles').select('has_seen_welcome').eq('id', session.user.id).maybeSingle();

        const isFirstVisit = profile !== null && profile.has_seen_welcome === false;

        if (isFirstVisit) {
          await supabase.from('profiles').update({ has_seen_welcome: true }).eq('id', session.user.id);
          setUserName(firstName);
          setUserInitials(initials);
          setPhase('welcome');
          if (session.user.email) {
            maybeSendWelcomeEmail(session.user.email, fullName);
          }
          setTimeout(() => {
            setPhase('transitioning');
            setTimeout(() => { setPhase('done'); }, 700);
          }, 2400);
        } else {
          setPhase('done');

        }

        setBookings(MOCK_BOOKINGS);
      } else {
        setPhase('done');
      }
    });
  }, []);

  const showOverlay = phase === 'welcome' || phase === 'transitioning';
  const overlayOut = phase === 'transitioning';
  const filteredBookings = activeCategory ? bookings.filter(b => b.category === activeCategory) : bookings;
  const activeBookings = filteredBookings.filter(b => !['completed', 'cancelled'].includes(b.status));
  const pastBookings   = filteredBookings.filter(b => ['completed', 'cancelled'].includes(b.status));

  return (
    <>
      <Head><title>Bookings — ScheduleMe</title></Head>

      {/* Welcome overlay */}
      {showOverlay && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center transition-opacity duration-300"
          style={{ opacity: overlayOut ? 0 : 1, background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
          <div className="text-center px-6">
            <div className="relative mx-auto mb-6 h-20 w-20">
              <div className="absolute inset-0 rounded-2xl bg-accent/20 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="relative h-full w-full rounded-2xl bg-accent flex items-center justify-center text-white text-2xl font-black">
                {userInitials}
              </div>
            </div>
            <h1 className="text-3xl font-black text-white mb-2" style={{ letterSpacing: '-0.02em' }}>Welcome, {userName}!</h1>
            <p className="text-neutral-400">You&apos;re all set. Let&apos;s find you a pro.</p>
            <div className="flex justify-center gap-1.5 mt-8">
              {[0,1,2].map(i => <div key={i} className="h-1.5 w-1.5 rounded-full bg-accent/40 animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />)}
            </div>
          </div>
        </div>
      )}

      <Nav />

      <div className="min-h-screen pt-[72px]" style={{ background: '#EDF5FF' }}>
        {/* Header — flat solid blue */}
        <div className="border-b" style={{
          background: '#3b82f6',
          borderColor: 'rgba(0,0,0,0.08)'
        }}>
          <div className="relative mx-auto max-w-3xl px-6 pt-8 pb-7">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] mb-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>Your activity</p>
                <h1 className="text-[2.1rem] font-black text-white" style={{ letterSpacing: '-0.03em', lineHeight: 1.1 }}>My Bookings</h1>
                <p className="mt-1" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>Track and manage your service requests</p>
              </div>
              <Link href="/browse" scroll={false}
                className="shrink-0 flex items-center gap-2 text-sm font-black px-4 py-2.5 rounded-xl transition-colors mt-1"
                style={{ background: 'white', color: '#0A84FF', border: '1px solid rgba(255,255,255,0.3)' }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New request
              </Link>
            </div>

            {/* Stats row — white cards on blue */}
            <div className="flex gap-3 mb-6">
              {[
                { label: 'Total', value: bookings.length },
                { label: 'Active', value: bookings.filter(b => !['completed','cancelled'].includes(b.status)).length },
                { label: 'Completed', value: bookings.filter(b => b.status === 'completed').length },
              ].map(s => (
                <div key={s.label} className="flex-1 rounded-xl px-3 py-2.5 text-center" style={{ background: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <p className="text-2xl font-black" style={{ letterSpacing: '-0.025em', color: '#0A84FF' }}>{s.value}</p>
                  <p className="text-[11px] font-bold uppercase tracking-wide mt-0.5 text-neutral-500">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Dynamic category filter */}
            {bookings.length > 0 && (() => {
              const usedCategories = [...new Set(bookings.map(b => b.category).filter(Boolean))];
              return usedCategories.length > 0 ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] mb-2" style={{ color: 'rgba(255,255,255,0.75)' }}>Filter by</p>
                  <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                    <button onClick={() => setActiveCategory(null)}
                      className="shrink-0 text-[11px] font-black px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap"
                      style={activeCategory === null
                        ? { background: 'white', color: '#0A84FF' }
                        : { background: 'rgba(255,255,255,0.22)', color: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.4)' }}>
                      All
                    </button>
                    {usedCategories.map(cat => (
                      <button key={cat} onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                        className="shrink-0 text-[11px] font-black px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap"
                        style={activeCategory === cat
                          ? { background: 'white', color: '#0A84FF' }
                          : { background: 'rgba(255,255,255,0.22)', color: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.4)' }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-6 py-8">
          <div className="space-y-3.5">
              {bookings.length === 0 ? (
                <div className="bg-white rounded-2xl border text-center py-16 px-6" style={{ border: '1px solid rgba(10,132,255,0.08)' }}>
                  <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <svg className="h-7 w-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
                    </svg>
                  </div>
                  <p className="font-bold text-neutral-700 mb-1" style={{ letterSpacing: '-0.01em' }}>No bookings yet</p>
                  <p className="text-neutral-400 text-sm mt-1 mb-6">Browse local professionals and book your first service</p>
                  <Link href="/browse" scroll={false} className="btn-primary px-6 py-2.5 text-sm">Browse professionals</Link>
                </div>
              ) : activeBookings.length === 0 && pastBookings.length === 0 ? (
                <div className="rounded-2xl border border-neutral-100 bg-white text-center py-10 px-6">
                  <p className="font-semibold text-neutral-600 text-sm">No {activeCategory} bookings</p>
                  <button onClick={() => setActiveCategory(null)} className="text-xs text-accent font-semibold mt-2 hover:opacity-70 transition-opacity">
                    Clear filter
                  </button>
                </div>
              ) : (
                <>
                  {activeBookings.length > 0 && (
                    <div>
                      <h2 className="text-[10px] font-black uppercase tracking-[0.14em] mb-3" style={{ color: '#0A84FF' }}>Active</h2>
                      <div className="space-y-3">
                        {activeBookings.map(b => {
                          const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending;
                          return (
                            <button key={b.id} onClick={e => openBooking(b, e)}
                              className="w-full text-left booking-card group overflow-hidden flex">
                              {/* Left accent bar — status color */}
                              <div className="w-[6px] shrink-0" style={{ background: cfg.barColor }} />
                              <div className="flex-1 p-6 pt-5 pb-5">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-black text-neutral-900 text-[17px] line-clamp-2 group-hover:text-accent transition-colors" style={{ letterSpacing: '-0.02em' }}>{b.service}</h3>
                                    {b.business_name
                                      ? <p className="text-xs text-neutral-500 mt-0.5 font-medium">{b.business_name}</p>
                                      : <p className="text-xs text-neutral-300 mt-0.5 italic">Matching you with a pro…</p>}
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <p className="text-[10px] text-neutral-300">{formatDate(b.created_at)}</p>
                                      {b.scheduled_at && (
                                        <>
                                          <span className="text-neutral-200">·</span>
                                          <span className="text-[10px] font-semibold" style={{ color: cfg.barColor }}>
                                            {new Date(b.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <StatusBadge status={b.status} />
                                    <svg className="h-4 w-4 text-neutral-300 group-hover:text-neutral-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                    </svg>
                                  </div>
                                </div>
                                <ProgressBar status={b.status} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {pastBookings.length > 0 && (
                    <div>
                      <h2 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.14em] mb-3">Past</h2>
                      <div className="space-y-3">
                        {pastBookings.map(b => (
                          <button key={b.id} onClick={e => openBooking(b, e)}
                            className="w-full text-left booking-card group overflow-hidden flex opacity-55 hover:opacity-100">
                            <div className="w-[6px] shrink-0 bg-neutral-200" />
                            <div className="flex-1 p-6 pt-5 pb-5 flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-black text-neutral-700 text-[17px] line-clamp-2" style={{ letterSpacing: '-0.02em' }}>{b.service}</h3>
                                {b.business_name && <p className="text-xs text-neutral-500 mt-0.5 font-medium">{b.business_name}</p>}
                                <div className="flex items-center gap-2 mt-1.5">
                                  <p className="text-[10px] text-neutral-300">{formatDate(b.created_at)}</p>
                                  {b.amount_cents && (
                                    <>
                                      <span className="text-neutral-200">·</span>
                                      <p className="text-[10px] font-bold text-neutral-500">${(b.amount_cents / 100).toFixed(2)} paid</p>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <StatusBadge status={b.status} />
                                <svg className="h-4 w-4 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

          {/* Nearby pros — horizontal scroll row, no grid */}
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(10,132,255,0.09)' }}>
            <div className="px-5 pt-5 pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-[1rem] font-black text-neutral-900" style={{ letterSpacing: '-0.02em' }}>Available near you</h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">Pros ready to take your job</p>
              </div>
              <Link href="/browse" scroll={false}
                className="text-[11px] font-black text-accent uppercase tracking-widest hover:opacity-70 transition-opacity">
                See all →
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto px-5 pb-5 pt-3" style={{ scrollbarWidth: 'none' }}>
              {SPONSORED.slice(0, 6).map(biz => (
                <Link key={biz.id} href={`/browse?biz=${biz.id}`} scroll={false}
                  className="group block rounded-xl overflow-hidden flex-shrink-0 transition-all hover:-translate-y-0.5"
                  style={{ width: 200, border: '1px solid rgba(10,132,255,0.10)', background: 'white' }}>
                  <div className="relative overflow-hidden bg-neutral-100" style={{ height: 140 }}>
                    <img src={biz.coverUrl} alt={biz.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, transparent 55%)' }} />
                    {biz.available && (
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full px-2 py-0.5"
                        style={{ background: 'rgba(255,255,255,0.95)' }}>
                        <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-500" />
                        <span className="text-[9px] font-black text-emerald-600">Open</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2">
                      <p className="text-white text-[11px] font-black line-clamp-1" style={{ letterSpacing: '-0.01em', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{biz.name}</p>
                    </div>
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <svg className="h-2.5 w-2.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-[10px] font-semibold text-neutral-700">{biz.rating}</span>
                      <span className="text-neutral-300 text-[10px]">·</span>
                      <span className="text-[10px] text-neutral-400">{biz.distance}</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">{biz.category}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          </div>
        </div>
      </div>

      {/* Detail sheet */}
      {selectedBooking && (
        <DetailSheet booking={selectedBooking} originRect={originRect} onClose={() => setSelectedBooking(null)} onCancel={cancelBooking} />
      )}
    </>
  );
};

export default BookingsPage;
