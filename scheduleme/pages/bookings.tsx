// @ts-nocheck
// pages/bookings.tsx — Book a service + booking history with clickable detail sheets
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import Nav from '../components/Nav';
import ReviewModal from '../components/ReviewModal';
import { SkeletonBookingCard } from '../components/SkeletonCard';
import { useDm } from '../lib/DarkModeContext';
import { maybeSendWelcomeEmail } from '../lib/sendWelcome';
import { createClient } from '@supabase/supabase-js';


function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

function isRealCover(src?: string | null): boolean {
  return !!src && src !== TRANSPARENT_PIXEL;
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function renderCover(opts: {
  src?: string | null;
  name: string;
  className: string;
  style?: any;
  fallbackClassName?: string;
  fallbackStyle?: any;
  showLabel?: boolean;
  label?: string;
}) {
  if (isRealCover(opts.src)) {
    return <img src={opts.src!} alt={opts.name} className={opts.className} style={opts.style} />;
  }
  return (
    <div className={opts.fallbackClassName || 'flex items-center justify-center bg-neutral-200'} style={opts.fallbackStyle}>
      <span className="text-xs font-bold" style={{ color: '#6b7280' }}>{initials(opts.name)}</span>
    </div>
  );
}

interface Booking {
  id: string;
  service: string;
  category: string;
  status: string;
  created_at: string;
  scheduled_at?: string;
  address?: string;
  note?: string; notes?: string;
  business_name?: string;
  business_phone?: string;
  business_email?: string;
  business_id?: string;
  amount_cents?: number;
  paid_at?: string;
  stripe_payment_method_id?: string;
  stripe_customer_id?: string;
  stripe_setup_intent_id?: string;
  reviewed?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; barColor: string; badgeBg: string; badgeText: string }> = {
  pending:         { label: 'Pending Review',   bg: 'bg-emerald-50  border-emerald-100',  text: 'text-emerald-700',  dot: 'bg-emerald-500', barColor: '#10b981', badgeBg: 'rgba(16,185,129,0.12)', badgeText: '#047857' },
  price_disputed:  { label: 'Disputing Price',  bg: 'bg-amber-100   border-amber-200',    text: 'text-amber-800',    dot: 'bg-amber-500',   barColor: '#f59e0b', badgeBg: 'rgba(245,158,11,0.18)', badgeText: '#92400e' },
  confirmed:       { label: 'Confirmed',         bg: 'bg-blue-50   border-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500',  barColor: '#3b82f6', badgeBg: 'rgba(59,130,246,0.12)', badgeText: '#1d4ed8' },
  payment_pending: { label: 'Payment Pending',   bg: 'bg-violet-50 border-violet-100', text: 'text-violet-700', dot: 'bg-violet-500',barColor: '#8b5cf6', badgeBg: 'rgba(139,92,246,0.12)', badgeText: '#5b21b6' },
  paid:            { label: 'Paid',              bg: 'bg-green-50  border-green-100',  text: 'text-green-700',  dot: 'bg-green-500', barColor: '#22c55e', badgeBg: 'rgba(34,197,94,0.12)', badgeText: '#15803d' },
  completed:       { label: 'Completed',         bg: 'bg-green-50  border-green-100',  text: 'text-green-700',  dot: 'bg-green-500', barColor: '#22c55e', badgeBg: 'rgba(34,197,94,0.12)', badgeText: '#15803d' },
  cancelled:       { label: 'Cancelled',         bg: 'bg-neutral-50 border-neutral-200', text: 'text-neutral-500', dot: 'bg-neutral-400', barColor: '#a3a3a3', badgeBg: 'rgba(163,163,163,0.16)', badgeText: '#6b7280' },
  payment_failed:  { label: 'Payment Failed',    bg: 'bg-red-50    border-red-100',    text: 'text-red-600',    dot: 'bg-red-400',   barColor: '#ef4444', badgeBg: 'rgba(239,68,68,0.12)', badgeText: '#b91c1c' },
};

const STEPS = ['pending', 'confirmed', 'paid', 'completed'];
const STEP_LABELS = ['Submitted', 'Confirmed', 'Paid', 'Done'];
const STEPS_NO_PAID = ['pending', 'confirmed', 'completed'];
const STEP_LABELS_NO_PAID = ['Submitted', 'Confirmed', 'Done'];

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

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

function formatTimeUntil(iso: string) {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diff = target - now;
  if (!Number.isFinite(diff)) return '';
  if (diff <= 0) return 'Now';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  const days = Math.round(hrs / 24);
  return `in ${days}d`;
}

function formatShortDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

function formatBusinessName(name?: string | null): string | null {
  if (!name) return null;
  const cleaned = String(name).trim();
  if (!cleaned) return null;
  if (cleaned.toLowerCase() === 'provider pending') return null;
  return cleaned;
}

function normalizeBookings(list: any[]): Booking[] {
  return (list || []).map((b: any) => {
    const businessName = b.business_name ?? b.businesses?.name ?? b.business?.name ?? null;
    const businessId = b.business_id ?? b.businesses?.id ?? b.business?.id ?? null;
    const businessPhone = b.business_phone ?? b.businesses?.phone ?? b.business?.phone ?? null;
    const businessEmail = b.business_email ?? b.businesses?.email ?? b.business?.email ?? null;
    return {
      ...b,
      business_name: businessName,
      business_id: businessId,
      business_phone: businessPhone,
      business_email: businessEmail,
    };
  });
}

function toCalDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function buildGoogleCalendarUrl(opts: { title: string; details?: string; location?: string; start: Date; end: Date }) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${toCalDate(opts.start)}/${toCalDate(opts.end)}`,
    details: opts.details || '',
    location: opts.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function downloadIcs(filename: string, opts: { title: string; details?: string; location?: string; start: Date; end: Date }) {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ScheduleMe//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@scheduleme`,
    `DTSTAMP:${toCalDate(new Date())}`,
    `DTSTART:${toCalDate(opts.start)}`,
    `DTEND:${toCalDate(opts.end)}`,
    `SUMMARY:${opts.title}`,
    opts.details ? `DESCRIPTION:${opts.details.replace(/\n/g, '\\n')}` : '',
    opts.location ? `LOCATION:${opts.location}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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

function ProgressBar({ status, steps, labels }: { status: string; steps: string[]; labels: string[] }) {
  const effective = steps.includes(status) ? status : (status === 'paid' ? 'confirmed' : status === 'payment_pending' ? 'pending' : status);
  const idx = Math.max(0, steps.indexOf(effective));
  return (
    <div className="mt-5">
      <div className="flex items-center">
        {steps.map((s, i) => {
          const done = i <= idx;
          const isLast = i === steps.length - 1;
          return (
            <div key={s} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
              <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 transition-colors ${done ? 'bg-accent' : 'bg-neutral-200'}`} />
              {!isLast && <div className={`h-0.5 flex-1 transition-colors ${i < idx ? 'bg-accent' : 'bg-neutral-200'}`} />}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        {labels.map((l, i) => (
          <span key={l} className={`text-[10px] font-medium ${i <= idx ? 'text-accent' : 'text-neutral-400'}`}>{l}</span>
        ))}
      </div>
    </div>
  );
}


function SaveCardForm({ booking, onSaved, onError, dm }: { booking: Booking; onSaved: (pmId: string | null) => void; onError: (msg: string) => void; dm: boolean }) {
  const stripe = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!booking?.id) return;
      try {
        const { data: { session } } = await getSupabase().auth.getSession();
        if (!session) return;
        const res = await fetch('/api/create-setup-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
          body: JSON.stringify({ booking_id: booking.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Unable to start card setup');
        if (mounted) setClientSecret(data.client_secret || null);
      } catch (e: any) {
        onError(e?.message || 'Unable to start card setup');
      }
    }
    load();
    return () => { mounted = false; };
  }, [booking?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret) return;
    setLoading(true);
    try {
      const card = elements.getElement(CardElement);
      if (!card) {
        onError('Card input is not ready. Please try again.');
        return;
      }
      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card },
      });
      if (result.error) {
        onError(result.error.message || 'Card setup failed');
        return;
      }
      const setupIntent = (result as any)?.setupIntent;
      if (!setupIntent) {
        onError('Card setup did not complete. Please try again.');
        return;
      }
      const paymentMethodId = setupIntent?.payment_method || null;
      onSaved(paymentMethodId || null);
    } catch (e: any) {
      onError(e?.message || 'Card setup failed');
    } finally {
      setLoading(false);
    }
  }

  if (booking.stripe_payment_method_id) {
    return <div className="mt-3 text-xs font-semibold text-emerald-700">Card saved. You will be charged after completion.</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <div className="rounded-xl border px-3 py-3" style={{ borderColor: dm ? '#1e554c' : '#c7f0e3', background: dm ? '#0f1f1c' : '#ffffff' }}>
        <CardElement options={{ hidePostalCode: false, style: { base: { fontSize: '14px' } } }} />
      </div>
      <button
        type="submit"
        disabled={!stripe || !elements || !clientSecret || loading}
        className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-bold text-sm"
        style={{ background: 'linear-gradient(135deg,#007e6d 0%,#1e554c 100%)', opacity: (!stripe || !elements || !clientSecret || loading) ? 0.6 : 1 }}
      >
        {loading ? 'Saving…' : 'Save card'}
      </button>
    </form>
  );
}

function DetailSheet({ booking, originRect, onClose, onCancel, onRequestReview, dm, paymentMethods, paymentDefaultId, paymentLoading, showAddCard, setShowAddCard, fetchPaymentMethods, setDefaultPaymentMethod, setPaymentToast }: {
  booking: Booking;
  originRect: DOMRect | null;
  onClose: () => void;
  onCancel: (id: string) => void;
  onRequestReview: (booking: Booking) => void;
  dm: boolean;
  paymentMethods: any[];
  paymentDefaultId: string | null;
  paymentLoading: boolean;
  showAddCard: boolean;
  setShowAddCard: (value: boolean) => void;
  fetchPaymentMethods: () => void;
  setDefaultPaymentMethod: (id: string) => void;
  setPaymentToast: (value: 'cancelled' | 'setup_success' | 'setup_cancelled' | null) => void;
}) {
  const displayBizName = booking.business_name || (booking as any)?.businesses?.name;
  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
  const [mounted, setMounted] = useState(false);
  const [err, setErr] = useState<string>('');
  const [closing, setClosing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputePrice, setDisputePrice] = useState('');
  const [disputeNote, setDisputeNote] = useState('');
  const [disputeSending, setDisputeSending] = useState(false);
  const [disputeSent, setDisputeSent] = useState(false);

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

  const accent = '#007e6d';
  const accentDark = '#1e554c';
  const panelBg = dm ? '#0f1f1c' : '#ecfdf3';
  const panelBorder = dm ? '#1e554c' : '#a7f3d0';
  const panelTitle = dm ? '#a7f3d0' : '#065f46';
  const panelText = dm ? '#8dd9c9' : '#0f766e';
  const inputBg = dm ? '#0b1513' : '#ffffff';
  const inputBorder = dm ? '#1e554c' : '#c7f0e3';
  const inputText = dm ? '#e5f9f4' : '#0f3d35';
  const isCustom = String(booking.service || '').toLowerCase().includes('custom');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: `rgba(0,0,0,${ready ? 0.45 : 0})`,
        backdropFilter: `blur(${ready ? 5 : 0}px)`,
        transition: closing
          ? 'background 0.22s ease, backdrop-filter 0.22s ease'
          : 'background 0.35s ease, backdrop-filter 0.35s ease',
      }}
      onMouseDown={(e) => { if (disputeOpen) return; if (e.target === e.currentTarget) close(); }}>

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
                      <h2 className="text-lg font-bold text-neutral-900 leading-snug pr-8">{booking.service || 'Custom Request'}</h2>
          {formatBusinessName(displayBizName) && (
            <p className="text-sm font-semibold text-neutral-700 mt-0.5">
              {formatBusinessName(displayBizName)}
            </p>
          )}
          <p className="text-xs text-neutral-400 mt-1 mb-5">Submitted {formatDate(booking.created_at)}</p>

          <StatusBadge status={booking.status} />
          {!['cancelled', 'payment_failed'].includes(booking.status) && (() => {
            const isCustom = !booking.service || String(booking.service).toLowerCase().includes('custom');
            const steps = isCustom ? STEPS : STEPS_NO_PAID;
            const labels = isCustom ? STEP_LABELS : STEP_LABELS_NO_PAID;
            return <ProgressBar status={booking.status} steps={steps} labels={labels} />;
          })()}

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

            {booking.scheduled_at && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10m-9 4h4m-6 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Add to calendar</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <a
                      href={buildGoogleCalendarUrl({
                        title: `${booking.service} — ${displayBizName || 'ScheduleMe'}`,
                        details: booking.note || booking.notes || '',
                        location: booking.address || '',
                        start: new Date(booking.scheduled_at),
                        end: new Date(new Date(booking.scheduled_at).getTime() + 60 * 60 * 1000),
                      })}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      Google Calendar
                    </a>
                    <button
                      onClick={() => downloadIcs(
                        `scheduleme-${booking.id}.ics`,
                        {
                          title: `${booking.service} — ${displayBizName || 'ScheduleMe'}`,
                          details: booking.note || booking.notes || '',
                          location: booking.address || '',
                          start: new Date(booking.scheduled_at),
                          end: new Date(new Date(booking.scheduled_at).getTime() + 60 * 60 * 1000),
                        }
                      )}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100 transition-colors"
                    >
                      Download .ics
                    </button>
                  </div>
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

            {displayBizName && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Business</p>
                  <p className="text-sm font-semibold text-neutral-800 mt-0.5">{displayBizName}</p>
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

            {(booking.note || booking.notes) && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                  <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Your Notes</p>
                  <p className="text-sm text-neutral-600 mt-0.5 leading-relaxed">{booking.note || booking.notes}</p>
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
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">{booking.paid_at ? 'Amount Paid' : 'Amount Due'}</p>
                  <p className="text-sm font-bold text-neutral-900 mt-0.5">{'$'}{(booking.amount_cents / 100).toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Message provider + payment authorized note */}
          {!['cancelled', 'payment_failed'].includes(booking.status) && (
            <div className="mt-6 pt-5 border-t border-neutral-100">
              {booking.amount_cents && !booking.paid_at && (
                booking.stripe_payment_method_id ? (
                  <div className="rounded-2xl p-4 mb-4" style={{ background: dm ? '#0f1f1c' : '#ecfdf3', border: `1px solid ${panelBorder}` }}>
                    <p className="text-sm font-bold mb-0.5" style={{ color: panelTitle }}>Payment received</p>
                    <p className="text-xs" style={{ color: panelText }}>Your payment method is saved. You will be charged after the service is completed.</p>
                    <a href={`/pay/${booking.id}`} className="mt-3 inline-flex items-center text-xs font-semibold" style={{ color: accent }}>
                      Change payment method →
                    </a>
                  </div>
                ) : (
                  <div className="rounded-2xl p-4 mb-4" style={{ background: panelBg, border: `1px solid ${panelBorder}` }}>
                    <p className="text-sm font-bold mb-0.5" style={{ color: panelTitle }}>Payment method required</p>
                    <p className="text-xs" style={{ color: panelText }}>Save a card to confirm your booking. You will only be charged after the service is completed.</p>
                    {paymentLoading ? (
                      <div className="mt-3 text-xs" style={{ color: dm ? 'rgba(255,255,255,0.6)' : '#6b7280' }}>Loading payment methods…</div>
                    ) : paymentMethods.length > 0 && !showAddCard ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold" style={{ color: panelTitle }}>Saved payment method</p>
                        <div className="flex items-center gap-2">
                          <select
                            value={paymentDefaultId || paymentMethods[0]?.id}
                            onChange={(e) => setDefaultPaymentMethod(e.target.value)}
                            className="flex-1 rounded-lg border px-3 py-2 text-xs bg-transparent"
                            style={{ borderColor: inputBorder, color: inputText, background: inputBg }}
                          >
                            {paymentMethods.map((m) => (
                              <option key={m.id} value={m.id}>{`${m.brand?.toUpperCase() || 'CARD'} •••• ${m.last4} (exp ${m.exp_month}/${String(m.exp_year).slice(-2)})`}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => setShowAddCard(true)}
                            className="px-3 py-2 rounded-lg text-xs font-semibold"
                            style={{ background: accentDark, color: 'white' }}
                          >
                            Add new
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3">
                        {process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? (
                          <Elements stripe={stripePromise} options={{ appearance: { theme: dm ? 'night' : 'stripe', variables: { colorPrimary: accent, colorText: dm ? '#e5f9f4' : '#0f3d35', colorBackground: dm ? '#0b1513' : '#ffffff', colorTextSecondary: dm ? '#8dd9c9' : '#0f766e' } } }}>
                            <SaveCardForm
                              booking={booking}
                              dm={dm}
                              onSaved={(pmId) => {
                                setShowAddCard(false);
                                fetchPaymentMethods();
                                if (pmId) setDefaultPaymentMethod(pmId);
                                setPaymentToast('setup_success');
                              }}
                              onError={(msg) => {
                                setPaymentToast('setup_cancelled');
                                setErr(msg);
                              }}
                            />
                          </Elements>
                        ) : (
                          <div className="text-xs" style={{ color: panelText }}>Stripe key missing. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.</div>
                        )}
                        {err && <div className="mt-2 text-xs" style={{ color: dm ? '#fca5a5' : '#b91c1c' }}>{err}</div>}
                      </div>
                    )}
                  </div>
                )
              )}
              <Link href={`/messages?booking=${booking.id}`} scroll={false}
                onClick={() => close()}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-bold text-sm"
                style={{ background: 'linear-gradient(135deg,#007e6d 0%,#1e554c 100%)' }}>
                Message provider
              </Link>
            </div>
          )}

          {isCustom && booking.amount_cents && !booking.paid_at && (
            <div className="mt-6 pt-5 border-t border-neutral-100">
              <button
                onClick={() => setDisputeOpen(true)}
                className="w-full py-3 rounded-xl border-2 border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-50 hover:border-amber-300 transition-colors">
                Dispute price / propose a new amount
              </button>
              {disputeSent && (
                <p className="text-[11px] text-emerald-600 mt-2">Proposal sent to the business. They can adjust the price or reply.</p>
              )}
            </div>
          )}

          {/* Paid confirmation */}
          {booking.paid_at && (
            <div className="mt-6 pt-5 border-t border-neutral-100">
              <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <svg className="h-5 w-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div>
                  <p className="text-sm font-bold text-green-800">Payment confirmed</p>
                  <p className="text-xs text-green-700">{'$'}{(booking.amount_cents! / 100).toFixed(2)} paid · {new Date(booking.paid_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}
          {['completed', 'paid'].includes(booking.status) && !booking.reviewed && booking.business_id && (
            <div className="mt-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestReview(booking);
                }}
                className="w-full py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: '#007e6d' }}
              >
                Leave a review
              </button>
            </div>
          )}

          {/* Cancel action */}
          {['pending', 'confirmed'].includes(booking.status) && !booking.paid_at && (
            <div className="mt-6 pt-5 border-t border-neutral-100">
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

      {disputeOpen && (
        <div
          className="fixed inset-0 z-[2100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          onMouseDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) setDisputeOpen(false); }}
          onClick={(e) => { e.stopPropagation(); }}
        >
          <div
            className="w-full max-w-md mx-4 rounded-2xl p-5"
            style={{ background: dm ? '#0f0f10' : 'white', border: '1px solid ' + (dm ? '#1f2937' : '#e5e7eb') }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold" style={{ color: dm ? '#f3f4f6' : '#111' }}>Propose a new price</p>
              <button onClick={() => setDisputeOpen(false)} className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: dm ? '#1f2937' : '#f3f4f6' }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Your proposed price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>$</span>
              <input
                value={disputePrice ? (Number(disputePrice) / 100).toFixed(2) : ''}
                onChange={(e) => {
                  const digits = (e.target.value || '').replace(/[^\d]/g, '').slice(0, 7);
                  setDisputePrice(digits);
                }}
                inputMode="numeric"
                placeholder="0.00"
                className="w-full rounded-xl border pl-7 pr-3 py-2 text-sm"
                style={{ borderColor: dm ? '#262626' : '#e5e7eb', background: dm ? '#0d0d0d' : 'white', color: dm ? '#f3f4f6' : '#111' }}
              />
            </div>
            <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mt-3 mb-1">Notes (optional)</label>
            <textarea
              value={disputeNote}
              onChange={(e) => setDisputeNote(e.target.value)}
              rows={3}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: dm ? '#262626' : '#e5e7eb', background: dm ? '#0d0d0d' : 'white', color: dm ? '#f3f4f6' : '#111' }}
            />
            <button
              onClick={async () => {
                const cents = parseInt(disputePrice || '0', 10);
                if (!(cents > 0)) { setErr('Enter a valid price'); return; }
                setDisputeSending(true);
                try {
                  const headers = await getAuthHeaders();
                  const res = await fetch('/api/bookings', {
                    method: 'PATCH',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      booking_id: booking.id,
                      status: 'price_disputed',
                      dispute_amount_cents: cents,
                      dispute_note: disputeNote || null,
                    }),
                  });
                  if (!res.ok) {
                    const d = await res.json().catch(() => ({}));
                    setErr(d.error || 'Failed to send proposal');
                  } else {
                    setDisputeSent(true);
                    setDisputeOpen(false);
                    setDisputePrice('');
                    setDisputeNote('');
                    setBookings(prev => prev.map(b => b.id === booking.id
                      ? { ...b, status: 'price_disputed', dispute_amount_cents: cents, dispute_note: disputeNote || null }
                      : b
                    ));
                  }
                } finally {
                  setDisputeSending(false);
                }
              }}
              disabled={disputeSending}
              className="w-full mt-4 py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 disabled:opacity-60">
              {disputeSending ? 'Sending…' : 'Send proposal'}
            </button>
            {err && <p className="text-[11px] text-red-500 mt-2">{err}</p>}
          </div>
        </div>
      )}
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
          <div className="relative">
            <input type="text" value={bizName} onChange={e => setBizName(e.target.value)}
              placeholder="e.g. Joe's Plumbing, Maria's Cleaning Service"
              maxLength={60}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent" />
            <span className="absolute bottom-2 right-3 text-[10px] text-neutral-400">{bizName.length}/60</span>
          </div>
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
          <div className="relative">
            <input type="text" value={bizLocation} onChange={e => setBizLocation(e.target.value)}
              placeholder="e.g. Mission District"
              maxLength={120}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent" />
            <span className="absolute bottom-2 right-3 text-[10px] text-neutral-400">{bizLocation.length}/120</span>
          </div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1.5">Why do you recommend them?</label>
          <div className="relative">
            <textarea value={note} maxLength={500} onChange={e => setNote(e.target.value)}
              placeholder="What did they do for you? How was the experience? Any contact info you have is helpful..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none" />
            <span className="absolute bottom-2 right-3 text-[10px] text-neutral-400">{note.length}/500</span>
          </div>
        </div>
        <button
          disabled={!bizName.trim()}
          onClick={() => { if (bizName.trim()) setSent(true); }}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
            bizName.trim() ? 'text-white' : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
          }`}
          style={bizName.trim() ? { background: 'linear-gradient(135deg,#007e6d 0%,#1e554c 100%)' } : {}}>
          Submit recommendation
        </button>
        <p className="text-center text-xs text-neutral-400">We'll contact them on your behalf. Your name won't be shared.</p>
      </div>
    </div>
  );
}


// ─── Onboarding Carousel ──────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  {
    icon: 'search',
    headline: 'Need a service?',
    body: "Stop texting everyone you know asking for recommendations. ScheduleMe shows you verified people near you — or at your own school — in seconds.",
    cta: "Show me how it works →",
  },
  {
    icon: 'ai',
    headline: 'Describe it. We handle the rest.',
    body: "Type what you need in plain English. Our AI figures out the service, finds the right pros nearby, and lets you book directly — no calls, no back and forth.",
    cta: "What's next? →",
  },
  {
    icon: 'campus',
    headline: 'On campus? Unlock your school feed.',
    body: "Verify your .edu email to access your campus marketplace — students offering haircuts, photography, tutoring, and more. Real people, reviewed and verified.",
    cta: "Get started →",
  },
];

function OnboardingCarousel({ userName, userInitials, fading, onDone }: {
  userName: string; userInitials: string; fading: boolean; onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [dir, setDir] = useState<'forward' | 'back'>('forward');

  function go(newStep: number) {
    if (animating) return;
    setDir(newStep > step ? 'forward' : 'back');
    setAnimating(true);
    setTimeout(() => { setStep(newStep); setAnimating(false); }, 180);
  }

  function next() {
    if (step < ONBOARDING_STEPS.length - 1) go(step + 1);
    else onDone();
  }

  function back() {
    if (step > 0) go(step - 1);
  }

  const s = ONBOARDING_STEPS[step];

  return (
    <div className="onboarding-active fixed inset-0 z-[200] flex flex-col items-center justify-center px-6 transition-opacity duration-500 overflow-hidden"
      style={{ opacity: fading ? 0 : 1, background: 'linear-gradient(160deg, #0a0a1a 0%, #0d1f3c 50%, #0a0a1a 100%)' }}>

      {/* Top row: back button left, progress dots center, skip right */}
      <div className="absolute top-10 left-0 right-0 flex items-center justify-between px-6">
        {/* Back button — invisible on step 0 so layout stays consistent */}
        <button onClick={back}
          className="flex items-center gap-1.5 text-xs font-semibold transition-opacity"
          style={{ color: 'rgba(255,255,255,0.4)', opacity: step === 0 ? 0 : 1, pointerEvents: step === 0 ? 'none' : 'auto' }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>

        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {ONBOARDING_STEPS.map((_, i) => (
            <div key={i} className="rounded-full transition-all duration-300"
              style={{ width: i === step ? 20 : 6, height: 6, background: i === step ? '#007e6d' : 'rgba(255,255,255,0.2)' }} />
          ))}
        </div>

        {/* Skip */}
        <button onClick={onDone}
          className="text-xs font-semibold"
          style={{ color: 'rgba(255,255,255,0.4)' }}>
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="max-w-sm w-full text-center transition-opacity duration-180"
        style={{ opacity: animating ? 0 : 1 }}>
        <div className="mb-8 flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(10,132,255,0.15)', border: '1px solid rgba(10,132,255,0.3)' }}>
            {s.icon === 'search' && (
              <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            )}
            {s.icon === 'ai' && (
              <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            )}
            {s.icon === 'campus' && (
              <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
              </svg>
            )}
          </div>
        </div>
        <h1 className="text-2xl font-black text-white mb-4" style={{ letterSpacing: '-0.025em', lineHeight: 1.2 }}>
          {s.headline}
        </h1>
        <p className="text-base leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {s.body}
        </p>
        <button onClick={next}
          className="w-full py-4 rounded-2xl text-base font-bold transition-all active:scale-95"
          style={{ background: '#007e6d', color: 'white', boxShadow: '0 8px 32px rgba(10,132,255,0.4)' }}>
          {s.cta}
        </button>
      </div>

      {/* Name greeting — bottom */}
      {step === 0 && (
        <p className="absolute bottom-10 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Welcome, {userName}
        </p>
      )}
    </div>
  );
}

type Phase = 'loading' | 'welcome' | 'transitioning' | 'done';


const BookingsPage: NextPage = () => {
  const router = useRouter();
  const { dm } = useDm();
  const [phase, setPhase] = useState<Phase>('loading');
  const [userName, setUserName] = useState('');
  const [userInitials, setUserInitials] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [nearbyBizList, setNearbyBizList] = useState<any[]>([]);
  const hasNearbyRef = useRef(false);
  const [nearbyLoading, setNearbyLoading] = useState(true);
  function setNearbySafe(list: any[]) {
    hasNearbyRef.current = list.length > 0;
    setNearbyBizList(list);
  }
  const [reviewTarget, setReviewTarget] = useState<{ bookingId: string; businessId: string; businessName: string; serviceName: string } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const [paymentToast, setPaymentToast] = useState<'cancelled' | 'setup_success' | 'setup_cancelled' | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [paymentDefaultId, setPaymentDefaultId] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [reviewBanner, setReviewBanner] = useState<Booking | null>(null);

const COORDS_KEY = 'sm_last_coords';
function readCoords(): { lat: number; lng: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.lat !== 'number' || typeof v?.lng !== 'number') return null;
    return v;
  } catch { return null; }
}
function writeCoords(lat: number, lng: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(COORDS_KEY, JSON.stringify({ lat, lng, ts: Date.now() }));
}

  // Show toast if redirected back after cancelled payment / card setup
  useEffect(() => {
    if (router.query.payment === 'cancelled') {
      setPaymentToast('cancelled');
      const bookingId = typeof router.query.booking === 'string' ? router.query.booking : null;
      if (bookingId) {
        getSupabase().auth.getSession().then(async ({ data: { session } }) => {
          if (!session) return;
          await fetch('/api/bookings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ booking_id: bookingId, status: 'cancelled' }),
          }).catch(() => {});
        });
      }
      const t = setTimeout(() => setPaymentToast(null), 5000);
      router.replace('/bookings', undefined, { shallow: true });
      return () => clearTimeout(t);
    }

    if (router.query.setup === 'success') {
      setPaymentToast('setup_success');
      const bookingId = typeof router.query.booking === 'string' ? router.query.booking : null;
      if (bookingId) {
        getSupabase().auth.getSession().then(async ({ data: { session } }) => {
          if (!session) return;
          try {
            const res = await fetch(`/api/bookings`, { headers: { 'Authorization': `Bearer ${session.access_token}` }, cache: 'no-store' });
            const data = await res.json();
            if (res.ok) {
              const normalized = normalizeBookings(data?.bookings || []);
              setBookings(normalized);
            }
          } catch {}
        });
      }
      const t = setTimeout(() => setPaymentToast(null), 5000);
      router.replace('/bookings', undefined, { shallow: true });
      return () => clearTimeout(t);
    }

    if (router.query.setup === 'cancelled') {
      setPaymentToast('setup_cancelled');
      const t = setTimeout(() => setPaymentToast(null), 5000);
      router.replace('/bookings', undefined, { shallow: true });
      return () => clearTimeout(t);
    }
  }, [router.query.payment, router.query.booking, router.query.setup]);

  useEffect(() => {
    if (router.query.setup === 'required' && typeof router.query.booking === 'string' && bookings.length > 0) {
      const b = bookings.find(b => b.id === router.query.booking);
      if (b) {
        setSelectedBooking(b);
      }
    }
  }, [router.query.setup, router.query.booking, bookings]);

  async function fetchPaymentMethods() {
    setPaymentLoading(true);
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      if (!session) { setPaymentMethods([]); setPaymentDefaultId(null); return; }
      const res = await fetch('/api/payment-methods', { headers: { Authorization: 'Bearer ' + session.access_token } });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPaymentMethods(data.methods || []);
        setPaymentDefaultId(data.defaultId || null);
      }
    } catch {
      setPaymentMethods([]);
      setPaymentDefaultId(null);
    } finally {
      setPaymentLoading(false);
    }
  }

  async function setDefaultPaymentMethod(id: string) {
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      if (!session) return;
      const res = await fetch('/api/set-default-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ payment_method_id: id }),
      });
      if (res.ok) setPaymentDefaultId(id);
    } catch {}
  }

  function openBooking(b: Booking, e: React.MouseEvent) {
    setOriginRect((e.currentTarget as HTMLElement).getBoundingClientRect());
    setSelectedBooking(b);
    fetchPaymentMethods();
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

        const seenCacheKey = `sm_seen_welcome_${session.user.id}`;
        const emailCacheKey = `sm_welcome_email_sent_${session.user.id}`;
        const cachedSeen = typeof window !== 'undefined' && localStorage.getItem(seenCacheKey) === 'true';
        const cachedEmailSent = typeof window !== 'undefined' && localStorage.getItem(emailCacheKey) === 'true';

        const isFirstVisit = !cachedSeen && profile !== null && profile.has_seen_welcome === false;

        if (isFirstVisit) {
          if (typeof window !== 'undefined') {
            localStorage.setItem(seenCacheKey, 'true');
          }
          setUserName(firstName);
          setUserInitials(initials);
          setPhase('welcome');
          if (session.user.email && !cachedEmailSent) {
            maybeSendWelcomeEmail(session.user.email, fullName, session.user.id);
            if (typeof window !== 'undefined') {
              localStorage.setItem(emailCacheKey, 'true');
            }
          }
        } else {
          setPhase('done');
        }

        // Fetch real bookings for this user (requires auth header)
        let bookingsData: any[] = [];

        try {
          const res = await fetch(`/api/bookings`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
            cache: 'no-store',
          });
          const data = await res.json();
          if (res.ok) {
            bookingsData = normalizeBookings(data?.bookings || []);
            setBookings(bookingsData);
          } else {
            setBookings([]);
          }
        } catch {
          setBookings([]);
        } finally {
          setLoadingBookings(false);
          // Also fetch nearby businesses for the "Available near you" section
          try {
            const { fetchNearbyBusinesses } = await import('../lib/realBusinesses');

            const cached = readCoords();
            if (cached?.lat && cached?.lng) {
              fetchNearbyBusinesses(cached.lat, cached.lng, { limit: 6, radius: 25 }).then((real) => {
                if (real.length > 0) { setNearbySafe(real); }
              });
            }

            // IP geo fallback
            try {
              const _ipRes = await fetch('https://ipapi.co/json/');
              const _ipData = await _ipRes.json();
              if (_ipData.latitude && _ipData.longitude) {
                const _ipBiz = await fetchNearbyBusinesses(_ipData.latitude, _ipData.longitude, { limit: 6, radius: 25 });
                if (_ipBiz.length > 0) {
                  setNearbySafe(_ipBiz);
                  setNearbyLoading(false);
                }
              }
            } catch (_e) {}

            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                async (pos) => {
                  const nearby = await fetchNearbyBusinesses(pos.coords.latitude, pos.coords.longitude, { limit: 6, radius: 25 });
                  if (nearby.length > 0) setNearbySafe(nearby);
                  // if empty, keep existing list
                  setNearbyLoading(false);
                },
                () => { if (!hasNearbyRef.current) setNearbySafe([]); setNearbyLoading(false); },
                { timeout: 8000, enableHighAccuracy: false, maximumAge: 300000 }
              );
              return; // setNearbyLoading handled in callbacks above
            }
            if (!hasNearbyRef.current) setNearbySafe([]);
          } catch { if (!hasNearbyRef.current) setNearbySafe([]); }
          setNearbyLoading(false);
          // Check for unreviewed completed bookings — show review banner
          const unreviewed = bookingsData.find(
            (b: any) => ['completed', 'paid'].includes(b.status) && !b.reviewed
          );
          if (unreviewed) {
            const key = `sm_review_dismissed_${unreviewed.id}`;
            const dismissed = typeof window !== 'undefined' && localStorage.getItem(key);
            if (!dismissed) {
              setReviewBanner(unreviewed);
            }
          }
        }
      } else {
        setPhase('done');
        setLoadingBookings(false);
          // Also fetch nearby businesses for the "Available near you" section
          try {
            const { fetchNearbyBusinesses } = await import('../lib/realBusinesses');

            const cached = readCoords();
            if (cached?.lat && cached?.lng) {
              fetchNearbyBusinesses(cached.lat, cached.lng, { limit: 6, radius: 25 }).then((real) => {
                if (real.length > 0) { setNearbySafe(real); }
              });
            }

            // IP geo fallback
            try {
              const _ipRes = await fetch('https://ipapi.co/json/');
              const _ipData = await _ipRes.json();
              if (_ipData.latitude && _ipData.longitude) {
                const _ipBiz = await fetchNearbyBusinesses(_ipData.latitude, _ipData.longitude, { limit: 6, radius: 25 });
                if (_ipBiz.length > 0) {
                  setNearbySafe(_ipBiz);
                  setNearbyLoading(false);
                }
              }
            } catch (_e) {}

            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                async (pos) => {
                  const nearby = await fetchNearbyBusinesses(pos.coords.latitude, pos.coords.longitude, { limit: 6, radius: 25 });
                  if (nearby.length > 0) setNearbySafe(nearby);
                  // if empty, keep existing list
                  setNearbyLoading(false);
                },
                () => { if (!hasNearbyRef.current) setNearbySafe([]); setNearbyLoading(false); },
                { timeout: 8000, enableHighAccuracy: false, maximumAge: 300000 }
              );
              return; // setNearbyLoading handled in callbacks above
            }
            if (!hasNearbyRef.current) setNearbySafe([]);
          } catch { if (!hasNearbyRef.current) setNearbySafe([]); }
          setNearbyLoading(false);
      }
    });
  }, []);

  const showOverlay = phase === 'welcome' || phase === 'transitioning';
  const overlayOut = phase === 'transitioning';
  const filteredBookings = bookings; // category filter removed - column doesn't exist in DB
  const activeBookings = filteredBookings.filter(b => !['completed', 'cancelled'].includes(b.status));
  const pastBookings   = filteredBookings.filter(b => ['completed', 'cancelled'].includes(b.status));
  const PAGE_SIZE = 2;
  const [activePage, setActivePage] = useState(0);
  const [pastPage, setPastPage] = useState(0);
  const activePages = Math.max(1, Math.ceil(activeBookings.length / PAGE_SIZE));
  const pastPages = Math.max(1, Math.ceil(pastBookings.length / PAGE_SIZE));
  const activeSlice = activeBookings.slice(activePage * PAGE_SIZE, activePage * PAGE_SIZE + PAGE_SIZE);
  const pastSlice = pastBookings.slice(pastPage * PAGE_SIZE, pastPage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setActivePage(0);
    setPastPage(0);
  }, [activeBookings.length, pastBookings.length]);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <title>Bookings — ScheduleMe</title></Head>

      {/* Onboarding carousel — first time users only */}
      {showOverlay && (
        <OnboardingCarousel
          userName={userName}
          userInitials={userInitials}
          fading={overlayOut}
          onDone={() => { setPhase('transitioning'); setTimeout(() => setPhase('done'), 500); }}
        />
      )}

      <Nav />

      <div className="min-h-screen pb-20 md:pb-0" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))', background: dm ? '#0a0a0a' : '#EDF5FF' }}>
        {/* Header — flat solid blue */}
        <div className="border-b" style={{
          background: '#007e6d',
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
                style={{ background: dm ? 'rgb(17,17,17)' : 'white', color: dm ? 'rgba(255,255,255,0.9)' : '#007e6d', border: '1px solid rgba(255,255,255,0.3)' }}>
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
                <div key={s.label} className="flex-1 rounded-xl px-3 py-2.5 text-center" style={{ background: dm ? 'rgb(20,20,20)' : 'white', border: dm ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.2)' }}>
                  <p className="text-2xl font-black" style={{ letterSpacing: '-0.025em', color: dm ? '#007e6d' : '#007e6d' }}>{s.value}</p>
                  <p className="text-[11px] font-bold uppercase tracking-wide mt-0.5" style={{ color: dm ? 'rgba(255,255,255,0.7)' : undefined }}>{s.label}</p>
                </div>
              ))}
            </div>

          </div>
        </div>

        <div className="relative mx-auto max-w-3xl px-6 py-10">
          {/* Soft ambient glow for a little warmth */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-8 left-1/2 h-48 w-[38rem] -translate-x-1/2 rounded-full blur-3xl"
            style={{
              opacity: dm ? 0.2 : 0.45,
              background: dm
                ? 'radial-gradient(closest-side, rgba(0,126,109,0.35), transparent 70%)'
                : 'radial-gradient(closest-side, rgba(0,126,109,0.25), transparent 70%)',
            }}
          />
          <div className="relative z-10 space-y-6">
            {reviewBanner && (
              <div className="rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                style={{ background: dm ? '#171717' : 'white', border: dm ? '1px solid #2a2d3a' : '1px solid rgba(10,132,255,0.12)', boxShadow: dm ? '0 10px 22px rgba(0,0,0,0.25)' : '0 12px 30px rgba(0, 73, 128, 0.08)' }}>
                <div>
                  <p className="text-sm font-bold" style={{ color: dm ? '#f3f4f6' : '#111827' }}>How was your recent booking?</p>
                  <p className="text-xs mt-0.5" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                    Leave a review for {reviewBanner.business_name || 'your provider'}.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setReviewTarget({
                        bookingId: reviewBanner.id,
                        businessId: reviewBanner.business_id,
                        businessName: reviewBanner.business_name,
                        serviceName: reviewBanner.service,
                      });
                      setReviewBanner(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white"
                    style={{ background: '#007e6d' }}>
                    Leave review
                  </button>
                  <button
                    onClick={() => {
                      try { localStorage.setItem(`sm_review_dismissed_${reviewBanner.id}`, 'true'); } catch {}
                      setReviewBanner(null);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold"
                    style={{ background: dm ? '#1f2937' : '#f3f4f6', color: dm ? '#9ca3af' : '#6b7280' }}>
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            {loadingBookings ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonBookingCard key={i} dm={dm} />)}
            </div>
          ) : bookings.length === 0 ? (
                <div className="rounded-2xl border text-center py-16 px-6" style={{ background: dm ? '#171717' : 'white', border: dm ? '1px solid #2a2d3a' : '1px solid rgba(10,132,255,0.08)', boxShadow: dm ? '0 12px 24px rgba(0,0,0,0.35)' : '0 18px 40px rgba(0, 73, 128, 0.08)' }}>
                  <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <svg className="h-7 w-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
                    </svg>
                  </div>
                  <p className="font-bold text-neutral-700 mb-1" style={{ letterSpacing: '-0.01em' }}>No bookings yet</p>
                  <p className="text-neutral-400 text-sm mt-1 mb-6">Browse local professionals and book your first service</p>
                  <Link href="/browse" scroll={false} className="btn-primary px-6 py-2.5 text-sm">Browse professionals</Link>
                </div>

              ) : (
                <>
                  {activeBookings.length > 0 && (
                    <div className="rounded-2xl border p-4 sm:p-5" style={{ background: dm ? '#171717' : 'white', border: dm ? '1px solid #262626' : '1px solid #e5e7eb', boxShadow: dm ? '0 10px 24px rgba(0,0,0,0.35)' : '0 16px 40px rgba(0,0,0,0.08)' }}>
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: dm ? 'rgba(0,126,109,0.2)' : 'rgba(0,126,109,0.12)', color: '#007e6d' }}>Active</span>
                          <div className="h-px flex-1" style={{ background: dm ? 'rgba(255,255,255,0.08)' : '#e5e7eb' }} />
                        </div>
                        {activeBookings.length > PAGE_SIZE && (
                          <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: dm ? '#d1d5db' : '#374151' }}>
                            <button
                              type="button"
                              onClick={() => setActivePage(p => Math.max(0, p - 1))}
                              disabled={activePage === 0}
                              className="h-7 w-7 rounded-full border flex items-center justify-center disabled:opacity-40"
                              style={{ borderColor: dm ? '#2c2c2e' : '#e5e7eb', background: dm ? '#1f2937' : 'white' }}
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
                            </button>
                            <span>{activePage + 1}/{activePages}</span>
                            <button
                              type="button"
                              onClick={() => setActivePage(p => Math.min(activePages - 1, p + 1))}
                              disabled={activePage >= activePages - 1}
                              className="h-7 w-7 rounded-full border flex items-center justify-center disabled:opacity-40"
                              style={{ borderColor: dm ? '#2c2c2e' : '#e5e7eb', background: dm ? '#1f2937' : 'white' }}
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 6l6 6-6 6" /></svg>
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        {activeSlice.map(b => {
                          const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending;
                          const bizName = formatBusinessName(b.business_name || (b as any).businesses?.name);
                          const primaryTime = b.scheduled_at ? formatTimeUntil(b.scheduled_at) : formatDate(b.created_at);
                          const scheduledLabel = b.scheduled_at ? formatShortDateTime(b.scheduled_at) : null;
                          return (
                            <button key={b.id} onClick={e => openBooking(b, e)}
                              className="w-full text-left booking-card group overflow-hidden transition-all hover:-translate-y-0.5"
                              style={{
                                background: dm ? '#1c1c1e' : 'white',
                                border: dm ? '1px solid #2c2c2e' : '1px solid #e5e7eb',
                                borderRadius: 16,
                                boxShadow: dm ? '0 6px 16px rgba(0,0,0,0.35)' : '0 12px 28px rgba(0,0,0,0.08)',
                              }}>
                              <div className="p-6 pt-5 pb-5">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-black text-[17px] line-clamp-2 group-hover:text-accent transition-colors" style={{ letterSpacing: '-0.02em', color: dm ? '#f3f4f6' : '#171717' }}>
                                      {b.service || 'Custom Request'}
                                    </h3>
                                    {bizName && (
                                      <p className="text-xs font-semibold mt-0.5" style={{ color: dm ? '#a3a3a3' : '#6b7280' }}>
                                        {bizName}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <p className="text-[10px] font-semibold" style={{ color: dm ? '#9ca3af' : '#64748b' }}>{primaryTime}</p>
                                      {scheduledLabel && (
                                        <>
                                          <span className="text-neutral-200">·</span>
                                          <span className="text-[10px] font-semibold" style={{ color: cfg.barColor }}>
                                            {scheduledLabel}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {b.amount_cents != null && (
                                      <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: dm ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: dm ? '#e5e7eb' : '#111827' }}>
                                        {'$'}{(b.amount_cents / 100).toFixed(2)}
                                      </span>
                                    )}
                                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: cfg.badgeBg, color: cfg.badgeText }}>{cfg.label}</span>
                                    <svg className="h-4 w-4 text-neutral-300 group-hover:text-neutral-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                    </svg>
                                  </div>
                                </div>
                                <ProgressBar status={b.status} steps={(String(b.service||'').toLowerCase().includes('custom') ? STEPS : STEPS_NO_PAID)} labels={(String(b.service||'').toLowerCase().includes('custom') ? STEP_LABELS : STEP_LABELS_NO_PAID)} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {pastBookings.length > 0 && (
                    <div className="rounded-2xl border p-4 sm:p-5" style={{ background: dm ? '#171717' : 'white', border: dm ? '1px solid #262626' : '1px solid #e5e7eb', boxShadow: dm ? '0 10px 24px rgba(0,0,0,0.35)' : '0 16px 40px rgba(0,0,0,0.06)' }}>
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: dm ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: dm ? 'rgba(255,255,255,0.6)' : '#6b7280' }}>Past</span>
                          <div className="h-px flex-1" style={{ background: dm ? 'rgba(255,255,255,0.08)' : '#e5e7eb' }} />
                        </div>
                        {pastBookings.length > PAGE_SIZE && (
                          <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: dm ? '#d1d5db' : '#374151' }}>
                            <button
                              type="button"
                              onClick={() => setPastPage(p => Math.max(0, p - 1))}
                              disabled={pastPage === 0}
                              className="h-7 w-7 rounded-full border flex items-center justify-center disabled:opacity-40"
                              style={{ borderColor: dm ? '#2c2c2e' : '#e5e7eb', background: dm ? '#1f2937' : 'white' }}
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
                            </button>
                            <span>{pastPage + 1}/{pastPages}</span>
                            <button
                              type="button"
                              onClick={() => setPastPage(p => Math.min(pastPages - 1, p + 1))}
                              disabled={pastPage >= pastPages - 1}
                              className="h-7 w-7 rounded-full border flex items-center justify-center disabled:opacity-40"
                              style={{ borderColor: dm ? '#2c2c2e' : '#e5e7eb', background: dm ? '#1f2937' : 'white' }}
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 6l6 6-6 6" /></svg>
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        {pastSlice.map(b => {
                          const bizName = formatBusinessName(b.business_name || (b as any).businesses?.name);
                          return (
                          <button key={b.id} onClick={e => openBooking(b, e)}
                            className="w-full text-left booking-card group overflow-hidden opacity-80 hover:opacity-100 transition-all hover:-translate-y-0.5"
                            style={{
                              background: dm ? '#1c1c1e' : 'white',
                              border: dm ? '1px solid #2c2c2e' : '1px solid #e5e7eb',
                              borderRadius: 16,
                              boxShadow: dm ? '0 6px 16px rgba(0,0,0,0.3)' : '0 12px 26px rgba(0,0,0,0.06)',
                            }}>
                            <div className="p-6 pt-5 pb-5 flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-black text-[17px] line-clamp-2" style={{ letterSpacing: '-0.02em', color: dm ? '#d1d5db' : '#404040' }}>{b.service || 'Custom Request'}</h3>
                                {bizName && (
                                  <p className="text-xs mt-0.5 font-semibold" style={{ color: dm ? '#9ca3af' : '#737373' }}>{bizName}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1.5">
                                  <p className="text-[10px]" style={{ color: dm ? 'rgba(255,255,255,0.3)' : '#d4d4d4' }}>{formatDate(b.created_at)}</p>
                                  {b.amount_cents && (
                                    <>
                                      <span className="text-neutral-200">·</span>
                                      <p className="text-[10px] font-bold text-neutral-500">{'$'}{(b.amount_cents / 100).toFixed(2)} paid</p>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: '#f3f4f6', color: '#6b7280' }}>{b.status}</span>
                                <svg className="h-4 w-4 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                              </div>
                            </div>
                          </button>
                        );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

          {/* Nearby pros — horizontal scroll row, no grid */}
          <div className="rounded-2xl overflow-hidden" style={{ background: dm ? '#171717' : 'white', border: dm ? '1px solid #2a2d3a' : '1px solid rgba(10,132,255,0.09)', boxShadow: dm ? '0 10px 24px rgba(0,0,0,0.35)' : '0 18px 50px rgba(0, 73, 128, 0.08)' }}>
            <div className="px-5 pt-5 pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-[1rem] font-black" style={{ letterSpacing: '-0.02em', color: dm ? '#f3f4f6' : '#171717' }}>Available near you</h3>
                <p className="text-[11px] mt-0.5" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>Pros ready to take your job</p>
              </div>
              <Link href="/browse" scroll={false}
                className="text-[11px] font-black text-accent uppercase tracking-widest hover:opacity-70 transition-opacity">
                See all →
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto px-5 pb-5 pt-3" style={{ scrollbarWidth: 'none' }}>
              {nearbyLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="animate-shimmer rounded-xl flex-shrink-0" style={{ width: 200, height: 180 }} />
                  ))
                : nearbyBizList.slice(0, 8).map(biz => (
                <Link key={biz.id} href={`/biz/${biz.slug || biz.realId || biz.id}`} scroll={false}
                  className="group block rounded-xl overflow-hidden flex-shrink-0 transition-all hover:-translate-y-0.5"
                  style={{ width: 200, border: dm ? '1px solid #404040' : '1px solid rgba(10,132,255,0.12)', background: dm ? '#171717' : 'white' }}>
                  <div className="relative overflow-hidden bg-neutral-100" style={{ height: 140 }}>
                    {renderCover({
                      src: biz.coverUrl,
                      name: biz.name,
                      className: 'w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]',
                      fallbackClassName: 'w-full h-full flex items-center justify-center',
                      fallbackStyle: { background: dm ? '#242426' : '#e5e7eb' },
                    })}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, transparent 55%)' }} />
                    {biz.available && (
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full px-2 py-0.5"
                        style={{ background: dm ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.95)' }}>
                        <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-500" />
                        <span className="text-[9px] font-black" style={{ color: dm ? 'white' : '#16a34a' }}>Open</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2">
                      <p className="text-white text-[11px] font-black line-clamp-1" style={{ letterSpacing: '-0.01em', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{biz.name}</p>
                    </div>
                  </div>
                  <div className="px-3 py-2.5" style={{ background: dm ? '#171717' : 'white' }}>
                    {(biz.reviews ?? 0) > 0 && biz.rating != null ? (
                    <div className="flex items-center gap-1">
                      <svg className="h-2.5 w-2.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-[10px] font-semibold" style={{ color: dm ? '#d1d5db' : '#404040' }}>{biz.rating}</span>
                      <span className="text-neutral-300 text-[10px]">·</span>
                      <span className="text-[10px]" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>{biz.distance}</span>
                    </div>
                    ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px]" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>{biz.distance}</span>
                    </div>
                    )}
                    <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>{biz.category}</p>
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
        <DetailSheet
          booking={selectedBooking}
          originRect={originRect}
          onClose={() => setSelectedBooking(null)}
          onCancel={cancelBooking}
          onRequestReview={(b) => {
            if (!b.business_id) { setPaymentToast('setup_cancelled'); return; }
            setReviewTarget({
              bookingId: b.id,
              businessId: b.business_id,
              businessName: b.business_name || 'Provider',
              serviceName: b.service || 'Booking',
            });
            setTimeout(() => setSelectedBooking(null), 120);
          }}
          dm={dm}
          paymentMethods={paymentMethods}
          paymentDefaultId={paymentDefaultId}
          paymentLoading={paymentLoading}
          showAddCard={showAddCard}
          setShowAddCard={setShowAddCard}
          fetchPaymentMethods={fetchPaymentMethods}
          setDefaultPaymentMethod={setDefaultPaymentMethod}
          setPaymentToast={setPaymentToast}
        />
      )}

      {reviewTarget && (
        <ReviewModal
          bookingId={reviewTarget.bookingId}
          businessId={reviewTarget.businessId}
          businessName={reviewTarget.businessName}
          serviceName={reviewTarget.serviceName}
          onDone={() => {
            setReviewTarget(null);
            setReviewBanner(null);
            setBookings((prev) => prev.map((b) => b.id === reviewTarget.bookingId ? { ...b, reviewed: true } : b));
          }}
        />
      )}

      {/* Payment/capture toasts */}
      {paymentToast && (
        <div
          className="fixed bottom-24 md:bottom-6 left-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl"
          style={{ transform: 'translateX(-50%)', background: '#1a1d27', border: '1px solid #2a2d3a', animation: 'fade-up 0.3s ease both' }}>
          {paymentToast === 'setup_success' ? (
            <svg className="h-4 w-4 shrink-0" style={{ color: '#10b981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          ) : (
            <svg className="h-4 w-4 shrink-0" style={{ color: '#f59e0b' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          )}
          <p className="text-sm font-semibold text-white">
            {paymentToast === 'cancelled' && 'Payment cancelled — no charge was made.'}
            {paymentToast === 'setup_cancelled' && 'Card setup cancelled — no charge was made.'}
            {paymentToast === 'setup_success' && 'Card saved. You will be charged after completion.'}
          </p>
          <button onClick={() => setPaymentToast(null)} className="ml-1 text-neutral-400 hover:text-white transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </>
  );
};

async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
  };
}

export default BookingsPage;
