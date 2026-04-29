// @ts-nocheck
// pages/bookings.tsx — Book a service + booking history with clickable detail sheets
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import ReviewModal from '../components/ReviewModal';
import { SkeletonBookingCard } from '../components/SkeletonCard';
import { useDm } from '../lib/DarkModeContext';
import { issuePaymentAccessTicket } from '../lib/paymentAccess';
import { maybeSendWelcomeEmail } from '../lib/sendWelcome';
import { createClient } from '@supabase/supabase-js';


function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);
}

interface Booking {
  id: string;
  business_id?: string;
  service: string;
  category: string;
  status: string;
  reviewed?: boolean;
  created_at: string;
  scheduled_at?: string;
  address?: string;
  notes?: string;
  business_name?: string;
  business_phone?: string;
  business_email?: string;
  amount_cents?: number;
  paid_at?: string;
  consumer_confirmation_due_at?: string;
  completion_proof_note?: string;
  completion_proof_photo_urls?: string[];
  completion_proof_submitted_at?: string;
  completion_proof_geo_metadata?: any;
  disputed_at?: string;
  dispute_reason?: string;
  dispute_details?: string;
  dispute_media_urls?: string[];
}
const PROTECTION_FEE_CENTS = 99;
const REVIEW_SKIP_STORAGE_KEY = 'sm_review_skips_v1';
const BOOKINGS_CACHE_TTL_MS = 2 * 60 * 1000;

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; barColor: string }> = {
  pending:         { label: 'Pending Review',   bg: 'bg-amber-50  border-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-400', barColor: '#f59e0b' },
  confirmed:       { label: 'Confirmed',         bg: 'bg-accent-light   border-accent/20',   text: 'text-accent',   dot: 'bg-accent-light0',  barColor: '#0F766E' },
  payment_pending: { label: 'Payment Pending',   bg: 'bg-amber-50 border-amber-100', text: 'text-amber-700', dot: 'bg-amber-500',barColor: '#f59e0b' },
  paid:            { label: 'Paid',              bg: 'bg-green-50  border-green-100',  text: 'text-green-700',  dot: 'bg-green-500', barColor: '#22c55e' },
  awaiting_consumer_confirmation: { label: 'Awaiting Your Confirmation', bg: 'bg-indigo-50 border-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500', barColor: '#6366f1' },
  disputed:       { label: 'Disputed',           bg: 'bg-amber-50 border-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', barColor: '#d97706' },
  completed:       { label: 'Completed',         bg: 'bg-green-50  border-green-100',  text: 'text-green-700',  dot: 'bg-green-500', barColor: '#22c55e' },
  cancelled:       { label: 'Cancelled',         bg: 'bg-neutral-50 border-neutral-200', text: 'text-neutral-500', dot: 'bg-neutral-400', barColor: '#a3a3a3' },
  payment_failed:  { label: 'Payment Failed',    bg: 'bg-red-50    border-red-100',    text: 'text-red-600',    dot: 'bg-red-400',   barColor: '#ef4444' },
};

function getSkippedReviewIds(): Set<string> {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const raw = localStorage.getItem(REVIEW_SKIP_STORAGE_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((v) => typeof v === 'string'));
  } catch {
    return new Set<string>();
  }
}

function persistSkippedReviewId(bookingId: string) {
  if (typeof window === 'undefined' || !bookingId) return;
  const next = getSkippedReviewIds();
  next.add(bookingId);
  localStorage.setItem(REVIEW_SKIP_STORAGE_KEY, JSON.stringify(Array.from(next)));
}

function bookingsCacheKey(userId: string): string {
  return `sm_bookings_cache_${userId}`;
}

function readBookingsCache(userId: string): Booking[] | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = localStorage.getItem(bookingsCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.bookings)) return null;
    if (!parsed.ts || Date.now() - Number(parsed.ts) > BOOKINGS_CACHE_TTL_MS) return null;
    return parsed.bookings as Booking[];
  } catch {
    return null;
  }
}

function writeBookingsCache(userId: string, rows: Booking[]) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(bookingsCacheKey(userId), JSON.stringify({ ts: Date.now(), bookings: rows || [] }));
  } catch {
    // Ignore cache write errors (storage full/private mode).
  }
}

const CUSTOM_STEPS = ['pending', 'confirmed', 'paid', 'completed'];
const CUSTOM_STEP_LABELS = ['Submitted', 'Confirmed', 'Paid', 'Done'];
const PRESET_STEPS = ['paid', 'confirmed', 'completed'];
const PRESET_STEP_LABELS = ['Paid', 'Confirmed', 'Done'];

function isCustomBooking(booking: Pick<Booking, 'service'>) {
  return /custom/i.test(String(booking?.service || ''));
}

function getProgressIndex(status: string, isCustom: boolean) {
  const normalized = String(status || '').toLowerCase();
  if (['completed', 'awaiting_consumer_confirmation', 'disputed'].includes(normalized)) {
    return isCustom ? 3 : 2;
  }
  if (isCustom) {
    if (normalized === 'paid') return 2;
    if (normalized === 'confirmed' || normalized === 'payment_pending' || normalized === 'active') return 1;
    if (normalized === 'pending') return 0;
    return -1;
  }
  if (normalized === 'confirmed' || normalized === 'active') return 1;
  if (normalized === 'paid') return 0;
  return -1;
}

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

function ProgressBar({ booking }: { booking: Booking }) {
  const custom = isCustomBooking(booking);
  const steps = custom ? CUSTOM_STEPS : PRESET_STEPS;
  const labels = custom ? CUSTOM_STEP_LABELS : PRESET_STEP_LABELS;
  const idx = getProgressIndex(booking.status, custom);
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

function DetailSheet({ booking, originRect, onClose, onCancel, onOpenDispute, onUploadDisputeMedia, onMessageProvider, onLeaveReview }: {
  booking: Booking;
  originRect: DOMRect | null;
  onClose: () => void;
  onCancel: (id: string) => void;
  onOpenDispute: (id: string, payload: { reason: string; details?: string; media_urls?: string[] }) => Promise<void>;
  onUploadDisputeMedia: (bookingId: string, file: File) => Promise<string | null>;
  onMessageProvider: (bookingId: string) => void;
  onLeaveReview: (booking: Booking) => void;
}) {
  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
  const serviceAmountCents = booking.amount_cents || 0;
  const totalAmountCents = serviceAmountCents > 0 ? serviceAmountCents + PROTECTION_FEE_CENTS : 0;
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [uploadingDisputeMedia, setUploadingDisputeMedia] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDetails, setDisputeDetails] = useState('');
  const [disputeMediaUrls, setDisputeMediaUrls] = useState<string[]>([]);
  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null);

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

  async function handleOpenDispute() {
    if (!disputeReason.trim()) return;
    setDisputing(true);
    await onOpenDispute(booking.id, {
      reason: disputeReason.trim(),
      details: disputeDetails.trim() || undefined,
      media_urls: disputeMediaUrls,
    });
    setDisputing(false);
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
            <ProgressBar booking={booking} />
          )}

          <div className="h-px bg-neutral-100 my-6" />

          <div className="space-y-3.5">
            {booking.scheduled_at && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-accent-light flex items-center justify-center flex-shrink-0">
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
                <div className="h-8 w-8 rounded-lg bg-accent-light flex items-center justify-center flex-shrink-0">
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
                <div className="h-8 w-8 rounded-lg bg-accent-light flex items-center justify-center flex-shrink-0">
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
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent bg-accent-light border border-accent/20 px-3 py-1.5 rounded-lg hover:brightness-95 transition-colors">
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
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Price Breakdown</p>
                  <p className="text-sm text-neutral-700 mt-0.5">Service: {'$'}{(serviceAmountCents / 100).toFixed(2)}</p>
                  <p className="text-sm text-neutral-700">Protection fee: {'$'}{(PROTECTION_FEE_CENTS / 100).toFixed(2)}</p>
                  <p className="text-sm font-bold text-neutral-900 mt-1">Total: {'$'}{(totalAmountCents / 100).toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Pay Now — shown when booking is confirmed and has amount set */}
          {booking.status === 'confirmed' && booking.amount_cents && !booking.paid_at && (
            <div className="mt-6 pt-5 border-t border-neutral-100">
              <div className="rounded-2xl p-4 mb-4" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <p className="text-sm font-bold text-green-800 mb-0.5">Ready to pay</p>
                <p className="text-xs text-green-700">{booking.business_name} has confirmed your booking. Complete payment to secure your appointment.</p>
              </div>
              <button
                onClick={async () => {
                  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) return;
                  issuePaymentAccessTicket(booking.id);
                  window.location.href = `/pay/${booking.id}`;
                }}
                className="w-full py-3.5 rounded-xl text-white font-bold text-sm"
                style={{ background: 'linear-gradient(135deg,#0F766E 0%,#0B5C56 100%)' }}>
                Pay ${(totalAmountCents / 100).toFixed(2)} Now →
              </button>
              <p className="text-[11px] text-neutral-500 mt-2 text-center">
                Includes ${(PROTECTION_FEE_CENTS / 100).toFixed(2)} protection fee.
              </p>
            </div>
          )}

          {/* Paid confirmation */}
          {booking.paid_at && (
            <div className="mt-6 pt-5 border-t border-neutral-100">
              <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <svg className="h-5 w-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div>
                  <p className="text-sm font-bold text-green-800">Payment confirmed</p>
                  <p className="text-xs text-green-700">{'$'}{(totalAmountCents / 100).toFixed(2)} paid (incl. {'$'}{(PROTECTION_FEE_CENTS / 100).toFixed(2)} protection fee) · {new Date(booking.paid_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Provider completion proof */}
          {(booking.completion_proof_submitted_at || booking.completion_proof_note || (booking.completion_proof_photo_urls || []).length > 0) && (
            <div className="mt-6 pt-5 border-t border-neutral-100">
              <div className="rounded-2xl p-4" style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}>
                <p className="text-sm font-bold text-indigo-900 mb-1">Provider completion proof</p>
                {booking.completion_proof_submitted_at && (
                  <p className="text-xs text-indigo-700 mb-2">
                    Submitted {new Date(booking.completion_proof_submitted_at).toLocaleString()}
                  </p>
                )}
                {booking.completion_proof_note && (
                  <p className="text-sm text-indigo-900 mb-2">{booking.completion_proof_note}</p>
                )}
                {(booking.completion_proof_photo_urls || []).length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {(booking.completion_proof_photo_urls || []).slice(0, 6).map((url) => (
                      <button key={url} type="button" onClick={() => setPreviewMediaUrl(url)} className="block">
                        <img src={url} alt="Completion proof" className="h-20 w-full rounded-lg object-cover border border-indigo-100" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Consumer dispute window */}
          {booking.status === 'completed' && booking.consumer_confirmation_due_at && new Date(booking.consumer_confirmation_due_at).getTime() > Date.now() && (
            <div className="mt-6 pt-5 border-t border-neutral-100">
              <div className="rounded-2xl p-4" style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}>
                <p className="text-sm font-bold text-amber-800 mb-0.5">Service auto-completed from provider proof</p>
                <p className="text-xs text-amber-700 mb-3">
                  If something is wrong, open a dispute before {new Date(booking.consumer_confirmation_due_at).toLocaleString()}.
                </p>
                <p className="text-sm font-bold text-amber-800 mb-2">Report issue / dispute</p>
                <select
                  className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm mb-2 bg-white"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                >
                  <option value="">Select reason</option>
                  <option value="service_not_completed">Service not completed</option>
                  <option value="quality_issue">Quality issue</option>
                  <option value="wrong_service">Wrong service delivered</option>
                  <option value="provider_no_show">Provider no-show</option>
                  <option value="other">Other</option>
                </select>
                <textarea
                  rows={3}
                  value={disputeDetails}
                  onChange={(e) => setDisputeDetails(e.target.value)}
                  placeholder="What went wrong?"
                  className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm mb-2"
                />
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 border border-amber-300 px-3 py-1.5 rounded-lg cursor-pointer bg-white">
                    {uploadingDisputeMedia ? 'Uploading…' : 'Add Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingDisputeMedia(true);
                        const url = await onUploadDisputeMedia(booking.id, file);
                        if (url) setDisputeMediaUrls((prev) => [...prev, url]);
                        setUploadingDisputeMedia(false);
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                  {disputeMediaUrls.length > 0 && (
                    <span className="text-xs text-amber-800">{disputeMediaUrls.length} photo(s) attached</span>
                  )}
                </div>
                {disputeMediaUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {disputeMediaUrls.slice(0, 6).map((url) => (
                      <button key={url} type="button" onClick={() => setPreviewMediaUrl(url)} className="block">
                        <img src={url} alt="Dispute media" className="h-20 w-full rounded-lg object-cover border border-amber-200" />
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={handleOpenDispute}
                  disabled={!disputeReason || disputing}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: '#b45309' }}
                >
                  {disputing ? 'Opening Dispute...' : 'Report Issue / Open Dispute'}
                </button>
              </div>
            </div>
          )}

          {booking.status === 'disputed' && (
            <div className="mt-6 pt-5 border-t border-neutral-100">
              <div className="rounded-2xl p-4" style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}>
                <p className="text-sm font-bold text-amber-800 mb-1">Dispute open</p>
                {booking.dispute_reason && (
                  <p className="text-xs text-amber-800 mb-1">Reason: {booking.dispute_reason.replace(/_/g, ' ')}</p>
                )}
                {booking.dispute_details && (
                  <p className="text-sm text-amber-900">{booking.dispute_details}</p>
                )}
                {(booking.dispute_media_urls || []).length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {(booking.dispute_media_urls || []).slice(0, 6).map((url) => (
                      <button key={url} type="button" onClick={() => setPreviewMediaUrl(url)} className="block">
                        <img src={url} alt="Dispute media" className="h-20 w-full rounded-lg object-cover border border-amber-200" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Completed booking actions */}
          {['completed', 'paid'].includes(booking.status) && (
            <div className="mt-6 pt-5 border-t border-neutral-100 space-y-2.5">
              {!!booking.business_id && (
                <button
                  onClick={() => onMessageProvider(booking.id)}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg,#0F766E 0%,#0B5C56 100%)' }}
                >
                  Message Provider
                </button>
              )}
              <button
                onClick={() => onLeaveReview(booking)}
                disabled={booking.reviewed === true}
                className="w-full py-3 rounded-xl text-sm font-semibold border transition-colors disabled:cursor-not-allowed disabled:opacity-55"
                style={{
                  background: booking.reviewed ? '#f5f5f5' : '#111111',
                  color: booking.reviewed ? '#9ca3af' : 'white',
                  borderColor: booking.reviewed ? '#e5e7eb' : '#111111',
                }}
              >
                {booking.reviewed ? 'Review already submitted' : 'Leave a Review'}
              </button>
            </div>
          )}

          {/* Cancel action */}
          {['pending', 'confirmed', 'payment_pending', 'paid'].includes(booking.status) && (
            <div className="mt-6 pt-5 border-t border-neutral-100">
              {cancelling ? (
                <div className="flex items-center justify-center gap-2 py-3">
                  <div className="h-4 w-4 rounded-full border-2 border-red-300 border-t-red-500 animate-spin" />
                  <span className="text-sm text-red-500">Cancelling...</span>
                </div>
              ) : (
                <button onClick={handleCancel}
                  className="w-full py-3 rounded-xl border-2 border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 hover:border-red-300 transition-colors">
                  Cancel Booking
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {previewMediaUrl && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPreviewMediaUrl(null)}
        >
          <img
            src={previewMediaUrl}
            alt="Preview"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setPreviewMediaUrl(null)}
            className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/15 text-white text-lg"
            aria-label="Close preview"
          >
            ×
          </button>
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
          style={bizName.trim() ? { background: 'linear-gradient(135deg,#0F766E 0%,#0B5C56 100%)' } : {}}>
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
              style={{ width: i === step ? 20 : 6, height: 6, background: i === step ? '#0F766E' : 'rgba(255,255,255,0.2)' }} />
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
            style={{ background: 'rgba(15,118,110,0.15)', border: '1px solid rgba(15,118,110,0.3)' }}>
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
          style={{ background: '#0F766E', color: 'white', boxShadow: '0 8px 32px rgba(15,118,110,0.4)' }}>
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
  const [isGuestViewer, setIsGuestViewer] = useState(false);
  const [userName, setUserName] = useState('');
  const [userInitials, setUserInitials] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [nearbyBizList, setNearbyBizList] = useState<any[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(true);
  const [reviewTarget, setReviewTarget] = useState<{ bookingId: string; businessId: string; businessName: string; serviceName: string } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const [paymentToast, setPaymentToast] = useState<'cancelled' | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [activeOpen, setActiveOpen] = useState(true);
  const [pastOpen, setPastOpen] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'confirmed' | 'payment_pending' | 'paid' | 'disputed'>('all');
  const [completedFilter, setCompletedFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [activePage, setActivePage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);

  // Show toast if redirected back after cancelled payment
  useEffect(() => {
    if (router.query.payment === 'cancelled') {
      setPaymentToast('cancelled');
      const t = setTimeout(() => setPaymentToast(null), 5000);
      router.replace('/bookings', undefined, { shallow: true });
      return () => clearTimeout(t);
    }
  }, [router.query.payment]);

  function openBooking(b: Booking, e: React.MouseEvent) {
    setOriginRect((e.currentTarget as HTMLElement).getBoundingClientRect());
    setSelectedBooking(b);
  }

  async function cancelBooking(id: string) {
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setActionToast('Please log in again to cancel this booking.');
        return;
      }
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ booking_id: id, status: 'cancelled' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionToast(data.error || 'Could not cancel booking.');
        return;
      }
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
      const refunded = !!data?.refund?.refunded;
      setActionToast(refunded ? 'Booking cancelled. Payment refunded.' : 'Booking cancelled.');
    } catch {
      setActionToast('Could not cancel booking.');
    } finally {
      setTimeout(() => setActionToast(null), 5000);
    }
  }

  async function openDispute(id: string, payload: { reason: string; details?: string; media_urls?: string[] }) {
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setActionToast('Please log in again to open a dispute.');
        return;
      }
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          booking_id: id,
          action: 'consumer_open_dispute',
          dispute_reason: payload.reason,
          dispute_details: payload.details || '',
          dispute_media_urls: payload.media_urls || [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionToast(data.error || 'Could not open dispute.');
        return;
      }
      setBookings(prev => prev.map(b => b.id === id ? {
        ...b,
        status: 'disputed',
        dispute_reason: payload.reason,
        dispute_details: payload.details || '',
        dispute_media_urls: payload.media_urls || [],
      } : b));
      setSelectedBooking(prev => prev && prev.id === id ? {
        ...prev,
        status: 'disputed',
        dispute_reason: payload.reason,
        dispute_details: payload.details || '',
        dispute_media_urls: payload.media_urls || [],
      } : prev);
      setActionToast('Dispute opened. Funds are on hold while we review.');
    } catch {
      setActionToast('Could not open dispute.');
    } finally {
      setTimeout(() => setActionToast(null), 5000);
    }
  }

  async function uploadDisputeMedia(bookingId: string, file: File): Promise<string | null> {
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
      const res = await fetch('/api/upload-message-media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          booking_id: bookingId,
          media_type: mediaType,
          file_data: base64,
          file_type: file.type || 'image/jpeg',
          file_name: file.name || `dispute-${Date.now()}.jpg`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionToast(data.error || 'Could not upload photo.');
        setTimeout(() => setActionToast(null), 5000);
        return null;
      }
      return data.url || null;
    } catch {
      setActionToast('Could not upload photo.');
      setTimeout(() => setActionToast(null), 5000);
      return null;
    }
  }

  useEffect(() => {
    let alive = true;

    const loadNearbyBusinesses = async () => {
      if (alive) setNearbyLoading(true);
      try {
        const { fetchAllBusinesses, fetchNearbyBusinesses } = await import('../lib/realBusinesses');

        // Fast seed load so "Available near you" renders quickly before geo/IP lookup completes.
        const seeded = await fetchAllBusinesses({ limit: 6 });
        if (!alive) return;
        if (seeded.length > 0) {
          setNearbyBizList(seeded.slice(0, 6));
          setNearbyLoading(false);
        }

        const loadFromCoords = async (lat: number, lng: number) => {
          const nearby = await fetchNearbyBusinesses(lat, lng, { limit: 6, radius: 25 });
          return (nearby || []).slice(0, 6);
        };

        let nearby: any[] = [];

        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          nearby = await new Promise<any[]>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                try {
                  resolve(await loadFromCoords(pos.coords.latitude, pos.coords.longitude));
                } catch {
                  resolve([]);
                }
              },
              () => resolve([]),
              { timeout: 8000, enableHighAccuracy: false, maximumAge: 300000 }
            );
          });
        }

        if ((nearby || []).length === 0) {
          const ipSources = ['https://ipapi.co/json/', 'https://ipwho.is/'];
          for (const src of ipSources) {
            try {
              const res = await fetch(src);
              const json = await res.json();
              const lat = Number(json.latitude ?? json.lat);
              const lng = Number(json.longitude ?? json.lon);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
              nearby = await loadFromCoords(lat, lng);
              if (nearby.length > 0) break;
            } catch {
              // Try next IP source.
            }
          }
        }

        if (alive && (nearby || []).length > 0) {
          setNearbyBizList(nearby || []);
        } else if (alive && seeded.length === 0) {
          setNearbyBizList([]);
        }
      } catch {
        if (alive) setNearbyBizList([]);
      } finally {
        if (alive) setNearbyLoading(false);
      }
    };

    const init = async () => {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        if (alive) setIsGuestViewer(false);
        const cachedBookings = readBookingsCache(session.user.id);
        if (alive && cachedBookings) {
          setBookings(cachedBookings);
          setLoadingBookings(false);
        }

        const fullName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'there';
        const firstName = fullName.split(' ')[0];
        const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

        const { data: profile } = await supabase
          .from('profiles').select('has_seen_welcome').eq('id', session.user.id).maybeSingle();

        const isFirstVisit = profile !== null && profile.has_seen_welcome === false;

        if (isFirstVisit) {
          await supabase.from('profiles').update({ has_seen_welcome: true }).eq('id', session.user.id);
          if (alive) {
            setUserName(firstName);
            setUserInitials(initials);
            // Global cross-page tour now lives in Nav; keep bookings page onboarding disabled.
            setPhase('done');
          }
          if (session.user.email) {
            maybeSendWelcomeEmail(session.user.email, fullName, session.access_token);
          }
        } else if (alive) {
          setPhase('done');
        }

        let bookingsData: any[] = [];
        try {
          const res = await fetch(`/api/bookings?user_id=${encodeURIComponent(session.user.id)}`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const data = await res.json();
            bookingsData = data.bookings || [];
            if (alive) {
              setBookings(bookingsData);
              writeBookingsCache(session.user.id, bookingsData);
            }
          } else if (alive && !cachedBookings) {
            setBookings([]);
            writeBookingsCache(session.user.id, []);
          }
        } catch {
          if (alive && !cachedBookings) setBookings([]);
        } finally {
          if (alive) setLoadingBookings(false);
          void loadNearbyBusinesses();
          const skippedIds = getSkippedReviewIds();
          const unreviewed = bookingsData.find(
            (b: any) => ['completed', 'paid'].includes(b.status) && !b.reviewed && !skippedIds.has(String(b.id))
          );
          if (alive && unreviewed && unreviewed.business_name) {
            setTimeout(() => setReviewTarget({
              bookingId: unreviewed.id,
              businessId: unreviewed.business_id,
              businessName: unreviewed.business_name,
              serviceName: unreviewed.service,
            }), 800);
          }
        }
      } else {
        if (alive) {
          setIsGuestViewer(true);
          setPhase('done');
          setLoadingBookings(false);
        }
        void loadNearbyBusinesses();
      }
    };

    init();
    return () => { alive = false; };
  }, []);

  const showOverlay = phase === 'welcome' || phase === 'transitioning';
  const overlayOut = phase === 'transitioning';
  const ITEMS_PER_PAGE = 6;
  const filteredBookings = bookings; // category filter removed - column doesn't exist in DB
  const activeBookings = filteredBookings.filter(b => !['completed', 'cancelled'].includes(b.status));
  const completedBookings = filteredBookings.filter(b => ['completed', 'cancelled'].includes(b.status));
  const activeFiltered = activeFilter === 'all' ? activeBookings : activeBookings.filter((b) => b.status === activeFilter);
  const completedFiltered = completedFilter === 'all' ? completedBookings : completedBookings.filter((b) => b.status === completedFilter);
  const activeTotalPages = Math.max(1, Math.ceil(activeFiltered.length / ITEMS_PER_PAGE));
  const completedTotalPages = Math.max(1, Math.ceil(completedFiltered.length / ITEMS_PER_PAGE));
  const activePageItems = activeFiltered.slice((activePage - 1) * ITEMS_PER_PAGE, activePage * ITEMS_PER_PAGE);
  const completedPageItems = completedFiltered.slice((completedPage - 1) * ITEMS_PER_PAGE, completedPage * ITEMS_PER_PAGE);

  useEffect(() => { setActivePage(1); }, [activeFilter, activeBookings.length]);
  useEffect(() => { setCompletedPage(1); }, [completedFilter, completedBookings.length]);
  useEffect(() => {
    if (activePage > activeTotalPages) setActivePage(activeTotalPages);
  }, [activePage, activeTotalPages]);
  useEffect(() => {
    if (completedPage > completedTotalPages) setCompletedPage(completedTotalPages);
  }, [completedPage, completedTotalPages]);

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

      <div className="min-h-screen pb-[calc(68px+env(safe-area-inset-bottom,0px))] md:pb-0" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))', background: dm ? '#0a0a0a' : '#F4EFE6' }}>
        <div className="border-b" style={{
          background: 'linear-gradient(145deg,#0F766E 0%, #156F68 100%)',
          borderColor: 'rgba(0,0,0,0.08)'
        }}>
          <div className="relative mx-auto max-w-3xl px-4 sm:px-6 pt-8 pb-7">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] mb-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>Your activity</p>
                <h1 className="text-[2.1rem] font-black text-white" style={{ letterSpacing: '-0.03em', lineHeight: 1.1 }}>My Bookings</h1>
                <p className="mt-1" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>Track and manage your service requests</p>
              </div>
              <Link href="/browse" scroll={false}
                className="shrink-0 flex items-center gap-2 text-sm font-black px-4 py-2.5 rounded-xl transition-colors mt-1"
                style={{ background: dm ? 'rgba(255,255,255,0.14)' : 'white', color: dm ? 'rgba(255,255,255,0.9)' : '#0F766E', border: '1px solid rgba(255,255,255,0.3)' }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New request
              </Link>
            </div>

            {/* Stats row — white cards on blue */}
            <div className="flex gap-3 mb-6">
              {[
                { label: 'Total', value: isGuestViewer ? '-' : String(bookings.length) },
                { label: 'Active', value: isGuestViewer ? '-' : String(bookings.filter(b => !['completed','cancelled'].includes(b.status)).length) },
                { label: 'Completed', value: isGuestViewer ? '-' : String(bookings.filter(b => ['completed','cancelled'].includes(b.status)).length) },
              ].map(s => (
                <div key={s.label} className="flex-1 rounded-xl px-3 py-2.5 text-center" style={{ background: dm ? 'rgba(255,255,255,0.14)' : 'white', border: dm ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.2)' }}>
                  <p className="text-2xl font-black" style={{ letterSpacing: '-0.025em', color: dm ? 'white' : '#0F766E' }}>{s.value}</p>
                  <p className="text-[11px] font-bold uppercase tracking-wide mt-0.5" style={{ color: dm ? 'rgba(255,255,255,0.7)' : undefined }}>{s.label}</p>
                </div>
              ))}
            </div>

          </div>
        </div>

        {actionToast && (
          <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-4">
            <div className="rounded-xl border px-4 py-3 text-sm font-medium"
              style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#334155' }}>
              {actionToast}
            </div>
          </div>
        )}

        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
          <div className="space-y-3.5">
              {loadingBookings ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonBookingCard key={i} dm={dm} />)}
            </div>
          ) : bookings.length === 0 ? (
                <div className="rounded-2xl border text-center py-16 px-6" style={{ background: dm ? '#171717' : 'white', border: dm ? '1px solid #2a2d3a' : '1px solid rgba(15,118,110,0.08)' }}>
                  <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <svg className="h-7 w-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
                    </svg>
                  </div>
                  {isGuestViewer ? (
                    <>
                      <p className="font-bold text-neutral-700 mb-1" style={{ letterSpacing: '-0.01em' }}>Track bookings after you sign up</p>
                      <p className="text-neutral-400 text-sm mt-1 mb-6">Create an account to request services, message providers, and manage all your bookings in one place.</p>
                      <div className="flex items-center justify-center gap-2">
                        <Link href="/signup?next=%2Fbookings" scroll={false} className="btn-primary px-6 py-2.5 text-sm">Create account</Link>
                        <Link href="/signin?next=%2Fbookings" scroll={false} className="px-6 py-2.5 text-sm font-bold rounded-xl border" style={{ borderColor: dm ? '#475569' : '#cbd5e1', color: dm ? '#cbd5e1' : '#334155' }}>Log in</Link>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-neutral-700 mb-1" style={{ letterSpacing: '-0.01em' }}>No bookings yet</p>
                      <p className="text-neutral-400 text-sm mt-1 mb-6">Browse local professionals and book your first service</p>
                      <Link href="/browse" scroll={false} className="btn-primary px-6 py-2.5 text-sm">Browse professionals</Link>
                    </>
                  )}
                </div>

              ) : (
                <>
                  {activeBookings.length > 0 && (
                    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: dm ? '#262626' : 'rgba(15,118,110,0.12)', background: dm ? '#111111' : 'rgba(255,255,255,0.8)' }}>
                      <div className="w-full px-4 py-3.5 flex items-center justify-between text-left" style={{ borderBottom: activeOpen ? (dm ? '1px solid #262626' : '1px solid rgba(15,118,110,0.1)') : 'none' }}>
                        <div className="flex items-center gap-2">
                          <h2 className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: '#0F766E' }}>Active</h2>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(15,118,110,0.22)' : 'rgba(15,118,110,0.12)', color: '#0F766E' }}>
                            {activeFiltered.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={activeFilter}
                            onChange={(e) => setActiveFilter(e.target.value as any)}
                            className="text-[11px] font-semibold pl-2 pr-7 py-1.5 rounded-lg border bg-transparent appearance-none"
                            style={{
                              borderColor: dm ? '#2f2f2f' : '#d1d5db',
                              color: dm ? '#d1d5db' : '#374151',
                              backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'><path d='M5 7.5L10 12.5L15 7.5' stroke='${dm ? '#ffffff' : '#374151'}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>`)}")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 0.45rem center',
                              backgroundSize: '14px 14px',
                            }}
                          >
                            <option value="all">All</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="payment_pending">Payment Pending</option>
                            <option value="paid">Paid</option>
                            <option value="disputed">Disputed</option>
                          </select>
                          <button onClick={() => setActiveOpen((prev) => !prev)} className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: dm ? '#1b1b1b' : '#f3f4f6' }}>
                            <svg className={`h-4 w-4 transition-transform ${activeOpen ? 'rotate-180' : ''}`} style={{ color: dm ? '#ffffff' : '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {activeOpen && (
                        <div className="space-y-3 p-3">
                          {activePageItems.map(b => {
                            const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending;
                            return (
                              <button key={b.id} onClick={e => openBooking(b, e)}
                                className="w-full text-left booking-card group overflow-hidden flex" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : undefined }}>
                                <div className="w-[6px] shrink-0" style={{ background: cfg.barColor }} />
                                <div className="flex-1 p-6 pt-5 pb-5" style={{ background: dm ? '#171717' : 'white' }}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <h3 className="font-black text-[17px] line-clamp-2 group-hover:text-accent transition-colors" style={{ letterSpacing: '-0.02em', color: dm ? '#f3f4f6' : '#171717' }}>{b.service}</h3>
                                      {b.business_name
                                        ? <p className="text-xs mt-0.5 font-medium" style={{ color: dm ? '#9ca3af' : '#737373' }}>{b.business_name}</p>
                                        : <p className="text-xs mt-0.5 italic" style={{ color: dm ? 'rgba(255,255,255,0.3)' : '#d4d4d4' }}>Matching you with a pro…</p>}
                                      <div className="flex items-center gap-2 mt-1.5">
                                        <p className="text-[10px]" style={{ color: dm ? 'rgba(255,255,255,0.3)' : '#d4d4d4' }}>{formatDate(b.created_at)}</p>
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
                                  <ProgressBar booking={b} />
                                </div>
                              </button>
                            );
                          })}
                          {activeFiltered.length > ITEMS_PER_PAGE && (
                            <div className="pt-1 flex items-center justify-between gap-2">
                              <button
                                onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                                disabled={activePage === 1}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-45"
                                style={{ borderColor: dm ? '#2a2a2a' : '#d1d5db', color: dm ? '#d1d5db' : '#4b5563' }}
                              >
                                Prev
                              </button>
                              <p className="text-xs font-semibold" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                                Page {activePage} / {activeTotalPages}
                              </p>
                              <button
                                onClick={() => setActivePage((p) => Math.min(activeTotalPages, p + 1))}
                                disabled={activePage === activeTotalPages}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-45"
                                style={{ borderColor: dm ? '#2a2a2a' : '#d1d5db', color: dm ? '#d1d5db' : '#4b5563' }}
                              >
                                Next
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {completedBookings.length > 0 && (
                    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: dm ? '#262626' : 'rgba(115,115,115,0.2)', background: dm ? '#111111' : 'rgba(255,255,255,0.75)' }}>
                      <div className="w-full px-4 py-3.5 flex items-center justify-between text-left" style={{ borderBottom: pastOpen ? (dm ? '1px solid #262626' : '1px solid rgba(115,115,115,0.18)') : 'none' }}>
                        <div className="flex items-center gap-2">
                          <h2 className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: dm ? 'rgba(255,255,255,0.55)' : '#737373' }}>Completed</h2>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: dm ? 'rgba(255,255,255,0.1)' : 'rgba(115,115,115,0.12)', color: dm ? '#d1d5db' : '#525252' }}>
                            {completedFiltered.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={completedFilter}
                            onChange={(e) => setCompletedFilter(e.target.value as any)}
                            className="text-[11px] font-semibold pl-2 pr-7 py-1.5 rounded-lg border bg-transparent appearance-none"
                            style={{
                              borderColor: dm ? '#2f2f2f' : '#d1d5db',
                              color: dm ? '#d1d5db' : '#374151',
                              backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'><path d='M5 7.5L10 12.5L15 7.5' stroke='${dm ? '#ffffff' : '#374151'}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>`)}")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 0.45rem center',
                              backgroundSize: '14px 14px',
                            }}
                          >
                            <option value="all">All</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                          <button onClick={() => setPastOpen((prev) => !prev)} className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: dm ? '#1b1b1b' : '#f3f4f6' }}>
                            <svg className={`h-4 w-4 transition-transform ${pastOpen ? 'rotate-180' : ''}`} style={{ color: dm ? '#ffffff' : '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {pastOpen && (
                        <div className="space-y-3 p-3">
                          {completedPageItems.map(b => (
                            <button key={b.id} onClick={e => openBooking(b, e)}
                              className="w-full text-left booking-card group overflow-hidden flex opacity-70 hover:opacity-100" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : undefined }}>
                              <div className="w-[6px] shrink-0 bg-neutral-200" />
                              <div className="flex-1 p-6 pt-5 pb-5 flex items-start justify-between gap-3" style={{ background: dm ? '#171717' : 'white' }}>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-black text-[17px] line-clamp-2" style={{ letterSpacing: '-0.02em', color: dm ? '#d1d5db' : '#404040' }}>{b.service}</h3>
                                  {b.business_name && <p className="text-xs mt-0.5 font-medium" style={{ color: dm ? '#9ca3af' : '#737373' }}>{b.business_name}</p>}
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <p className="text-[10px]" style={{ color: dm ? 'rgba(255,255,255,0.3)' : '#d4d4d4' }}>{formatDate(b.created_at)}</p>
                                    {b.amount_cents && (
                                      <>
                                        <span className="text-neutral-200">·</span>
                                        <p className="text-[10px] font-bold text-neutral-500">{'$'}{((b.amount_cents + PROTECTION_FEE_CENTS) / 100).toFixed(2)} paid</p>
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
                          {completedFiltered.length > ITEMS_PER_PAGE && (
                            <div className="pt-1 flex items-center justify-between gap-2">
                              <button
                                onClick={() => setCompletedPage((p) => Math.max(1, p - 1))}
                                disabled={completedPage === 1}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-45"
                                style={{ borderColor: dm ? '#2a2a2a' : '#d1d5db', color: dm ? '#d1d5db' : '#4b5563' }}
                              >
                                Prev
                              </button>
                              <p className="text-xs font-semibold" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                                Page {completedPage} / {completedTotalPages}
                              </p>
                              <button
                                onClick={() => setCompletedPage((p) => Math.min(completedTotalPages, p + 1))}
                                disabled={completedPage === completedTotalPages}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-45"
                                style={{ borderColor: dm ? '#2a2a2a' : '#d1d5db', color: dm ? '#d1d5db' : '#4b5563' }}
                              >
                                Next
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

          {/* Nearby pros — horizontal scroll row, no grid */}
          <div className="rounded-2xl overflow-hidden" style={{ background: dm ? '#171717' : 'white', border: dm ? '1px solid #2a2d3a' : '1px solid rgba(15,118,110,0.09)' }}>
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
                : nearbyBizList.map(biz => (
                <Link key={biz.id} href={`/browse?biz=${biz.id}`} scroll={false}
                  className="group block rounded-xl overflow-hidden flex-shrink-0 transition-all hover:-translate-y-0.5"
                  style={{ width: 200, border: dm ? '1px solid #404040' : '1px solid rgba(15,118,110,0.12)', background: dm ? '#171717' : 'white' }}>
                  <div className="relative overflow-hidden bg-neutral-100" style={{ height: 140 }}>
                    {biz.coverUrl && biz.coverUrl !== 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=' ? (
                      <img src={biz.coverUrl} alt={biz.name || biz.category || 'Provider'} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0L15 15m-1.5-1.5l1.159-1.159a2.25 2.25 0 013.182 0L21.75 16.5m-1.5-13.5h-15A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21h15a2.25 2.25 0 002.25-2.25V5.25A2.25 2.25 0 0020.25 3z" />
                        </svg>
                        <span className="text-[10px] font-semibold">No photos added</span>
                      </div>
                    )}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, transparent 55%)' }} />
                    {biz.available && (
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full px-2 py-0.5"
                        style={{ background: dm ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.95)' }}>
                        <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-500" />
                        <span className="text-[9px] font-black" style={{ color: dm ? 'white' : '#16a34a' }}>Open</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2">
                      <p className="text-white text-[11px] font-black line-clamp-1" style={{ letterSpacing: '-0.01em', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{biz.name || biz.category || 'Provider'}</p>
                    </div>
                  </div>
                  <div className="px-3 py-2.5" style={{ background: dm ? '#171717' : 'white' }}>
                    <div className="flex items-center gap-1">
                      <svg className="h-2.5 w-2.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-[10px] font-semibold" style={{ color: dm ? '#d1d5db' : '#404040' }}>{biz.rating}</span>
                      <span className="text-neutral-300 text-[10px]">·</span>
                      <span className="text-[10px]" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>{biz.distance}</span>
                    </div>
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
          onOpenDispute={openDispute}
          onUploadDisputeMedia={uploadDisputeMedia}
          onMessageProvider={(bookingId) => {
            setSelectedBooking(null);
            router.push(`/messages?booking=${encodeURIComponent(bookingId)}`, undefined, { scroll: false });
          }}
          onLeaveReview={(booking) => {
            if (!booking.business_id || !booking.business_name) return;
            setSelectedBooking(null);
            setReviewTarget({
              bookingId: booking.id,
              businessId: booking.business_id,
              businessName: booking.business_name,
              serviceName: booking.service,
            });
          }}
        />
      )}

      {reviewTarget && (
        <ReviewModal
          bookingId={reviewTarget.bookingId}
          businessId={reviewTarget.businessId}
          businessName={reviewTarget.businessName}
          serviceName={reviewTarget.serviceName}
          onDone={(mode) => {
            const bid = reviewTarget.bookingId;
            setReviewTarget(null);
            if (mode === 'skipped') {
              persistSkippedReviewId(bid);
              return;
            }
            setBookings(prev => prev.map(b => b.id === bid ? { ...b, reviewed: true } : b));
          }}
        />
      )}

      {/* Payment cancelled toast */}
      {paymentToast === 'cancelled' && (
        <div
          className="fixed bottom-24 md:bottom-6 left-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl"
          style={{ transform: 'translateX(-50%)', background: '#1a1d27', border: '1px solid #2a2d3a', animation: 'fade-up 0.3s ease both' }}>
          <svg className="h-4 w-4 shrink-0" style={{ color: '#f59e0b' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm font-semibold text-white">Payment cancelled — no charge was made.</p>
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
