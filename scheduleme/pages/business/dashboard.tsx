// @ts-nocheck

// pages/business/dashboard.tsx — ScheduleMe Provider Dashboard
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { useDm } from '../../lib/DarkModeContext';
import { normalizeServiceTags, serviceTagToLabel } from '../../lib/categoryNormalization';
import { formatCampusLabel, normalizeDomain } from '../../lib/providerMetadata';
import { isProviderCampusNameVisible, isProviderPublicNameVisible, isProviderPublicPhotosVisible } from '../../lib/providerTrust';
import BrandRouteLoader from '../../components/BrandRouteLoader';

import { SkeletonBookingCard, SkeletonThread } from '../../components/SkeletonCard';

function getSupabase() {
  return getSupabaseClient();
}

type TabId = 'overview' | 'bookings' | 'messages' | 'clients' | 'calendar' | 'settings' | 'edit' | 'services';

interface Booking {
  id: string; service: string; status: string; created_at: string;
  scheduled_start?: string; scheduled_end?: string;
  amount_cents: number | null; paid_at: string | null;
  user_id?: string;
  dispute_amount_cents?: number | null;
  dispute_note?: string | null;
  dispute_at?: string | null;
  customer_proposed_price_cents?: number | null;
  provider_proposed_price_cents?: number | null;
  price_accepted_by_customer?: boolean | null;
  price_accepted_by_provider?: boolean | null;
  price_accepted_at?: string | null;
  profiles: { id?: string; name: string; phone: string; email: string; avatar_url?: string } | null;
}
interface Business {
  id: string; name: string; owner_name: string; owner_email: string;
  phone?: string; description?: string;
  stripe_account_id: string | null; stripe_onboarded: boolean;
  service_tags: string[]; address: string; rating: number | null; price_tier?: number | null; review_count?: number | null;
  city?: string; zip?: string; lat?: number | null; lng?: number | null;
  slug?: string | null;
  hours?: any;
  availability_status?: string | null; break_until?: string | null;
  is_onboarded: boolean; website?: string; instagram?: string;
  school_domain?: string | null; school_email?: string | null; edu_verified?: boolean;
  campus_provider?: boolean; campus_key?: string | null; campus_school_name?: string | null;
  public_visibility?: boolean; public_show_name?: boolean; public_show_photos?: boolean; campus_show_name?: boolean;
}

function cleanDraftField(value: any, blocked: string[]): string {
  const text = toStringSafe(value).trim();
  return blocked.includes(text) ? '' : text;
}

function toStringSafe(v: any, fallback = ''): string {
  return typeof v === 'string' ? v : (v == null ? fallback : String(v));
}

function toNumberSafe(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toBooleanSafe(v: any): boolean {
  return v === true || v === 'true' || v === 1;
}

function toStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => toStringSafe(x)).filter(Boolean);
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((x) => toStringSafe(x)).filter(Boolean);
      } catch {}
    }
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function normalizeBusiness(input: any): Business | null {
  if (!input || typeof input !== 'object') return null;
  return {
    ...input,
    id: toStringSafe(input.id),
    name: toStringSafe(input.name, 'My Provider'),
    owner_name: toStringSafe(input.owner_name),
    owner_email: toStringSafe(input.owner_email),
    phone: toStringSafe(input.phone),
    description: toStringSafe(input.description),
    stripe_account_id: input.stripe_account_id ? toStringSafe(input.stripe_account_id) : null,
    stripe_onboarded: toBooleanSafe(input.stripe_onboarded),
    service_tags: toStringArray(input.service_tags),
    address: cleanDraftField(input.address, ['Setup in progress']),
    city: cleanDraftField(input.city, ['Setup']),
    zip: cleanDraftField(input.zip, ['00000']),
    lat: input.lat == null ? null : toNumberSafe(input.lat, 0),
    lng: input.lng == null ? null : toNumberSafe(input.lng, 0),
    rating: input.rating == null ? null : toNumberSafe(input.rating, 0),
    price_tier: input.price_tier == null ? undefined : toNumberSafe(input.price_tier, 0),
    review_count: input.review_count == null ? undefined : toNumberSafe(input.review_count, 0),
    slug: input.slug == null ? null : toStringSafe(input.slug),
    availability_status: input.availability_status == null ? null : toStringSafe(input.availability_status),
    break_until: input.break_until == null ? null : toStringSafe(input.break_until),
    is_onboarded: toBooleanSafe(input.is_onboarded),
    website: toStringSafe(input.website),
    instagram: toStringSafe(input.instagram),
    school_domain: input.school_domain == null ? null : toStringSafe(input.school_domain),
    school_email: input.school_email == null ? null : toStringSafe(input.school_email),
    edu_verified: toBooleanSafe(input.edu_verified),
    campus_provider: toBooleanSafe(input.campus_provider),
    campus_key: input.campus_key == null ? null : toStringSafe(input.campus_key),
    campus_school_name: input.campus_school_name == null ? null : toStringSafe(input.campus_school_name),
    public_visibility: input.public_visibility === false ? false : true,
    public_show_name: isProviderPublicNameVisible(input),
    public_show_photos: isProviderPublicPhotosVisible(input),
    campus_show_name: isProviderCampusNameVisible(input),
  };
}

const STATUS_CFG: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  pending:         { label: 'Pending',         dot: 'bg-accent',      bg: 'bg-[#eef8f5]',  text: 'text-[#0f766e]',   border: 'border-[#bfe5db]' },
  confirmed:       { label: 'Confirmed',       dot: 'bg-accent',      bg: 'bg-[#eef8f5]',  text: 'text-[#0f766e]',   border: 'border-[#bfe5db]' },
  price_disputed:  { label: 'Disputed',        dot: 'bg-rose-500',    bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200' },
  paid:            { label: 'Paid',            dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  payment_pending: { label: 'Price Pending',   dot: 'bg-[#0f766e]',   bg: 'bg-[#f5fbf8]',  text: 'text-[#0f766e]',   border: 'border-[#cfe7de]' },
  payment_failed:  { label: 'Pmt Failed',      dot: 'bg-red-500',     bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  completed:       { label: 'Completed',       dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  cancelled:       { label: 'Cancelled',       dot: 'bg-neutral-400', bg: 'bg-neutral-100',text: 'text-neutral-500', border: 'border-neutral-200' },
};

const NAV: { id: TabId; label: string; d: string }[] = [
  { id: 'overview',  label: 'Overview',  d: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'bookings',  label: 'Bookings',  d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { id: 'messages',  label: 'Messages',  d: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z' },
  { id: 'clients',   label: 'Clients',   d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'calendar',  label: 'Calendar',  d: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'services', label: 'Services', d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { id: 'edit',   label: 'Edit',   d: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'settings',  label: 'Settings',  d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

function fmt(cents: number) { return '$' + (cents / 100).toFixed(2); }
function safeDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
function fmtDate(d?: string | null) {
  const dt = safeDate(d);
  if (!dt) return '—';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtShortDate(d?: string | null) {
  const dt = safeDate(d);
  if (!dt) return '';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtTime(d?: string | null) {
  const dt = safeDate(d);
  if (!dt) return '—';
  return dt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function fmtClockTime(d?: string | null) {
  const dt = safeDate(d);
  if (!dt) return '';
  return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function normalizeBookings(input: any): Booking[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((b: any) => b && typeof b === 'object' && typeof b.id === 'string')
    .map((b: any) => ({
      ...b,
      profiles: b?.profiles && typeof b.profiles === 'object' ? b.profiles : null,
      service: typeof b?.service === 'string' ? b.service : '',
      status: typeof b?.status === 'string' ? b.status : 'pending',
      created_at: typeof b?.created_at === 'string' ? b.created_at : '',
      amount_cents: typeof b?.amount_cents === 'number' ? b.amount_cents : null,
    }));
}
function normalizeThreads(input: any): any[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((t: any) => t && typeof t === 'object')
    .map((t: any) => ({
      ...t,
      unreadCount: Number.isFinite(t?.unreadCount) ? Number(t.unreadCount) : 0,
      booking_ids: Array.isArray(t?.booking_ids) ? t.booking_ids : [],
      profiles: t?.profiles && typeof t.profiles === 'object' ? t.profiles : null,
    }));
}

function buildThreadFallbackFromBookings(rows: any[], businessId: string) {
  const grouped = new Map<string, any[]>();
  for (const booking of rows || []) {
    const key = booking?.user_id || booking?.profiles?.id || booking?.profiles?.email || booking?.id;
    if (!key) continue;
    const current = grouped.get(key) || [];
    current.push(booking);
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).map((group: any[]) => {
    const sorted = [...group].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latest = sorted[0];
    return {
      id: latest?.profiles?.id || latest?.user_id || latest?.profiles?.email || latest?.id,
      customer_id: latest?.profiles?.id || latest?.user_id || null,
      business_id: businessId,
      booking_id: latest?.id || null,
      booking_ids: sorted.map((row: any) => row.id).filter(Boolean),
      service: latest?.service || 'Conversation',
      status: latest?.status || 'pending',
      created_at: latest?.created_at || new Date().toISOString(),
      profiles: latest?.profiles || null,
      lastMessage: null,
      unreadCount: 0,
    };
  });
}
function onlyDigits(v: string) { return (v || '').replace(/[^\d]/g, '').slice(0, 7); }
function digitsToDollars(digits: string) { return digits ? (Number(digits) / 100).toFixed(2) : ''; }
function toCalDate(d: Date) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); }
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
function downloadIcsBatch(filename: string, events: { title: string; details?: string; location?: string; start: Date; end: Date }[]) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ScheduleMe//EN',
  ];
  events.forEach((ev, i) => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${Date.now()}-${i}@scheduleme`,
      `DTSTAMP:${toCalDate(new Date())}`,
      `DTSTART:${toCalDate(ev.start)}`,
      `DTEND:${toCalDate(ev.end)}`,
      `SUMMARY:${ev.title}`,
      ev.details ? `DESCRIPTION:${ev.details.replace(/\n/g, '\\n')}` : '',
      ev.location ? `LOCATION:${ev.location}` : '',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  const ics = lines.filter(Boolean).join('\r\n');
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

const DASHBOARD_DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function normalizeDashboardHours(hours: any): Array<{ day: string; time: string }> {
  if (!hours) return [];
  if (Array.isArray(hours)) return hours.filter((h) => h?.day && typeof h?.time === 'string');
  return Object.entries(hours).map(([day, time]) => ({ day, time: String(time || '') })).filter((h) => h.time);
}

function dashboardDayMatches(pattern: string, date: Date) {
  const dayName = DASHBOARD_DAY_NAMES[date.getDay()];
  const text = String(pattern || '').trim().toLowerCase();
  if (!text) return false;
  return text.includes(dayName.toLowerCase()) || text.includes(dayName.slice(0, 3).toLowerCase());
}

function hasBusinessHoursOnDate(hours: any, date: Date) {
  const normalized = normalizeDashboardHours(hours);
  if (!normalized.length) return false;
  const match = normalized.find((entry) => dashboardDayMatches(entry.day, date));
  if (!match) return false;
  const value = String(match.time || '').trim().toLowerCase();
  if (!value || value.includes('closed')) return false;
  return true;
}

function canMarkComplete(b: Booking, bizHours?: any) {
  if (!b?.scheduled_start) return true;
  try {
    if (bizHours) {
      const hoursArr = Array.isArray(bizHours) ? bizHours : Object.entries(bizHours).map(([day, time]) => ({ day, time }));
      const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const dayName = dayNames[new Date(b.scheduled_start).getDay()];
      const match = hoursArr.find((h: any) => typeof h?.day === 'string' && (h.day.includes(dayName) || h.day.includes(dayName.slice(0, 3))));
      if (match?.time && String(match.time).toLowerCase() === 'by appointment') return true;
      if (match?.time && String(match.time).toLowerCase() === '24 hours') return true;
    }
  } catch {}
  return new Date(b.scheduled_start).getTime() <= Date.now();
}

function isCustomPricingBooking(b: Partial<Booking>) {
  if (!b) return false;
  return (
    !b.service
    || String(b.service).toLowerCase().includes('custom')
    || b.customer_proposed_price_cents != null
    || b.provider_proposed_price_cents != null
    || b.dispute_amount_cents != null
    || (b.status === 'pending' && b.amount_cents == null)
  );
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}

function RevenueChart({ bookings, dm }: { bookings: Booking[]; dm: boolean }) {
  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const completedWeeks = Array.from({ length: 12 }, (_, i) => {
    const now = new Date();
    const startOfCurrentWeek = new Date(now);
    startOfCurrentWeek.setHours(0, 0, 0, 0);
    startOfCurrentWeek.setDate(now.getDate() - now.getDay());

    const weekStart = new Date(startOfCurrentWeek);
    weekStart.setDate(startOfCurrentWeek.getDate() - ((11 - i) + 1) * 7);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const earned = bookings
      .filter((b) => (b.status === 'paid' || b.status === 'completed') && b.amount_cents)
      .filter((b) => {
        const anchor = new Date(b.paid_at || b.created_at);
        return anchor >= weekStart && anchor <= weekEnd;
      })
      .reduce((sum, b) => sum + (b.amount_cents || 0), 0);

    return {
      label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      rangeLabel: `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      earned,
    };
  });

  const providerNet = (grossCents: number) => Math.max(0, Math.round(grossCents * 0.88));
  const weekly = completedWeeks.map((w) => ({ ...w, net: providerNet(w.earned) }));
  const max = Math.max(...weekly.map((w) => w.net), 1);
  const highestIndex = weekly.reduce((best, item, idx, arr) => item.net > arr[best].net ? idx : best, 0);
  const latestNonZeroIndex = (() => {
    for (let i = weekly.length - 1; i >= 0; i -= 1) {
      if (weekly[i].net > 0) return i;
    }
    return weekly.length - 1;
  })();
  const [selectedIndex, setSelectedIndex] = useState(latestNonZeroIndex);

  useEffect(() => {
    setSelectedIndex(latestNonZeroIndex);
  }, [latestNonZeroIndex]);

  const selected = weekly[selectedIndex] || weekly[weekly.length - 1];
  const trailingQuarterRevenue = weekly.reduce((sum, w) => sum + w.net, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-medium" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>
          Each bar represents 1 completed week from the past 3 months.
        </p>
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold"
          style={{
            background: dm ? 'rgba(0,126,109,0.18)' : '#f5fbf8',
            border: `1px solid ${dm ? 'rgba(93,214,198,0.32)' : '#cfe7de'}`,
            color: dm ? '#d7fff8' : '#0f766e',
          }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: '#007e6d' }} />
          {selected?.rangeLabel}: {currency.format((selected?.net || 0) / 100)}
        </span>
      </div>

      <div className="flex items-end justify-end gap-2 h-36">
        {weekly.map((w, i) => {
          const isHighest = i === highestIndex;
          const isSelected = i === selectedIndex;
          const hasRevenue = w.net > 0;
          const opacity = isHighest ? 1 : hasRevenue ? 0.42 : 0.18;
          return (
            <button
              key={`${w.label}-${i}`}
              type="button"
              onClick={() => setSelectedIndex(i)}
              className="flex-1 flex flex-col items-center gap-2 group"
              title={`${w.rangeLabel}: ${currency.format(w.net / 100)}`}
            >
              <div
                className="w-full rounded-t-[12px] rounded-b-[4px] transition-all duration-200"
                style={{
                  height: Math.max((w.net / max) * 112, hasRevenue ? 10 : 3),
                  background: '#007e6d',
                  opacity: isSelected ? 1 : opacity,
                  boxShadow: isSelected ? '0 8px 18px rgba(0,126,109,0.18)' : 'none',
                  transform: isSelected ? 'translateY(-2px)' : 'none',
                }}
              />
              <span
                className="text-[10px] whitespace-nowrap transition-colors"
                style={{ color: isSelected ? '#007e6d' : (dm ? '#8e8e93' : '#9ca3af'), fontWeight: isSelected ? 700 : 500 }}
              >
                {w.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-[11px]" style={{ color: dm ? '#8e8e93' : '#9ca3af' }}>
          Highest-revenue week is fully opaque. Click a bar to inspect that week.
        </p>
        <p className="text-[11px] font-semibold" style={{ color: dm ? '#d1d5db' : '#0f766e' }}>
          Past 3 months: {currency.format(trailingQuarterRevenue / 100)}
        </p>
      </div>
    </div>
  );
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
  };
}


// ─── Floating Action Button nav for mobile ────────────────────────────────────
function MobileFAB({ tab, setTab, pendingCount, totalUnreadMsgs, dm }: {
  tab: TabId; setTab: (t: TabId) => void;
  pendingCount: number; totalUnreadMsgs: number; dm: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [viewport, setViewport] = useState({ w: 1200, h: 900 });
  const [pos, setPos] = useState({ x: 16, y: 120 });
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, bx: 0, by: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncViewport = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    dragging.current = false;
    dragStart.current = { mx: e.clientX, my: e.clientY, bx: pos.x, by: pos.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragging.current = true;
    if (dragging.current) {
      setPos({
        x: Math.max(8, Math.min(viewport.w - 56, dragStart.current.bx + dx)),
        y: Math.max(80, Math.min(viewport.h - 160, dragStart.current.by + dy)),
      });
    }
  }
  function onPointerUp() {
    if (!dragging.current) setOpen(o => !o);
  }

  const navItems = [
    { id: 'overview' as TabId, label: 'Overview', icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5' },
    { id: 'bookings' as TabId, label: 'Bookings', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5' },
    { id: 'messages' as TabId, label: 'Messages', icon: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z' },
    { id: 'clients' as TabId, label: 'Clients', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z' },
    { id: 'edit' as TabId, label: 'Edit', icon: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { id: 'settings' as TabId, label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  return (
    <div className="lg:hidden" style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999 }}>
      {/* Dropdown menu */}
      {open && (
        <div className="absolute w-52 rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: dm ? '#171717' : 'white',
            border: `1px solid ${dm ? '#262626' : '#e5e7eb'}`,
            ...(pos.y > viewport.h / 2 ? { bottom: '100%', marginBottom: 8 } : { top: '100%', marginTop: 8 }),
            ...(pos.x > viewport.w / 2 ? { right: 0 } : { left: 0 }),
            animation: 'fadeUp 0.2s ease forwards',
          }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setTab(item.id); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors"
              style={{ background: tab === item.id ? (dm ? 'rgba(10,132,255,0.15)' : '#EBF4FF') : 'transparent', color: tab === item.id ? '#007e6d' : (dm ? '#d1d5db' : '#374151') }}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
              {item.id === 'bookings' && pendingCount > 0 && (
                <span className="ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-md bg-accent text-white tabular-nums min-w-[18px] text-center">{pendingCount}</span>
              )}
              {item.id === 'messages' && totalUnreadMsgs > 0 && (
                <span className="ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full bg-accent text-white">{totalUnreadMsgs}</span>
              )}
            </button>
          ))}
          <div style={{ height: 1, background: dm ? '#262626' : '#f0f0f0' }} />
          <a href="/home"
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium"
            style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
            </svg>
            Back to Consumer App
          </a>
        </div>
      )}

      {/* FAB button */}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="h-12 w-12 rounded-2xl shadow-lg flex items-center justify-center touch-none select-none"
        style={{ background: open ? '#007e6d' : (dm ? '#171717' : 'white'), border: open ? '1px solid #007e6d' : `1px solid ${dm ? '#262626' : '#e5e7eb'}`, cursor: 'grab', outline: 'none', WebkitTapHighlightColor: 'transparent' }}>
        {open ? (
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            style={{ color: dm ? 'white' : '#374151' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        )}
        {/* Badge for pending items */}
        {(pendingCount > 0 || totalUnreadMsgs > 0) && !open && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
            {pendingCount + totalUnreadMsgs}
          </span>
        )}
      </button>
    </div>
  );
}


// ─── Editable Preview Component ───────────────────────────────────────────────
function EditablePreview({ business, services, mediaImages, mediaVideo, editDesc, setEditDesc, setMediaImages, setMediaVideo, setBusiness, dm }: {
  business: any; services: any[]; mediaImages: string[]; mediaVideo: string;
  editDesc: string; setEditDesc: (v: string) => void;
  setMediaImages: (imgs: string[]) => void; setMediaVideo: (v: string) => void;
  setBusiness: (fn: (b: any) => any) => void; dm: boolean;
}) {
  const [tab, setTab] = useState<'card' | 'modal'>('card');
  const [editingCard, setEditingCard] = useState(false);
  const [editingModal, setEditingModal] = useState(false);
  const [imgs, setImgs] = useState(mediaImages);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [stripDragOver, setStripDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeImg, setActiveImg] = useState<string | null>(null);
  const [modalDesc, setModalDesc] = useState(editDesc);
  const [unsaved, setUnsaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setImgs(mediaImages); }, [mediaImages]);
  useEffect(() => { setActiveImg(null); }, [imgs]);

  const bg = dm ? '#1c1c1e' : 'white';
  const border = dm ? '#2c2c2e' : '#e5e7eb';
  const subtle = dm ? '#2c2c2e' : '#f2f2f7';
  const muted = dm ? '#8e8e93' : '#8e8e93';

  async function submitChangeRequest(changes: Record<string, any>, requestType?: string) {
    if (!business) return;
    const h = await getAuthHeaders();
    const res = await fetch('/api/business-change-requests', {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ business_id: business.id, changes, request_type: requestType || 'profile' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit change request');
    return data;
  }

  async function uploadFiles(files: File[]) {
    if (!business || files.length === 0) return;
    setUploading(true);
    const results: string[] = [];
    for (const file of files) {
      const isVideo = file.type.startsWith('video/');
      await new Promise<void>(resolve => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target?.result as string;
          try {
            const h = await getAuthHeaders();
            const res = await fetch('/api/upload-media', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify({ business_id: business.id, media_type: isVideo ? 'video' : 'image', file_data: base64, file_type: file.type, file_name: file.name }) });
            const data = await res.json();
            if (data.url) { if (isVideo) { setMediaVideo(data.url); try { await submitChangeRequest({ video_url: data.url }, 'media'); } catch {} } else results.push(data.url); }
          } finally { resolve(); }
        };
        reader.readAsDataURL(file);
      });
    }
    if (results.length > 0) { const next = [...imgs, ...results]; setImgs(next); setMediaImages(next);
      try { await submitChangeRequest({ media_urls: next, cover_url: next[0] || null }, 'media'); } catch {}
    }
    setUploading(false);
  }

  function onDragStart(i: number) { setDragIdx(i); }
  function onDragOverImg(e: React.DragEvent, i: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const next = [...imgs]; const [m] = next.splice(dragIdx, 1); next.splice(i, 0, m);
    setImgs(next); setDragIdx(i);
  }
  async function onDragEnd() { setDragIdx(null); setMediaImages(imgs); if (business) { try { await submitChangeRequest({ media_urls: imgs, cover_url: imgs[0] || null }, 'media'); } catch {} } }
  async function removeImg(i: number) { const next = imgs.filter((_,j) => j !== i); setImgs(next); setMediaImages(next); if (business) { try { await submitChangeRequest({ media_urls: next, cover_url: next[0] || null }, 'media'); } catch {} } }
  async function saveDesc() { if (!business) return; try { await submitChangeRequest({ description: editDesc }, 'profile'); } catch {} }

  function switchTab(next: 'card' | 'modal') {
    const editing = tab === 'card' ? editingCard : editingModal;
    if (editing && unsaved) {
      if (!confirm('You have unsaved changes. Discard them?')) return;
    }
    setEditingCard(false); setEditingModal(false); setUnsaved(false); setTab(next);
  }

  // ── Photo strip (shared) ───────────────────────────────────────────────────
  const photoStrip = (editing: boolean) => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold" style={{ color: muted }}>Photos & Video</p>
        {imgs.length > 0 && editing && <p className="text-[10px]" style={{ color: muted }}>Drag to reorder · tap × to remove</p>}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none' }}
        onDragOver={editing ? e => { e.preventDefault(); setStripDragOver(true); } : undefined}
        onDragLeave={editing ? () => setStripDragOver(false) : undefined}
        onDrop={editing ? e => { e.preventDefault(); setStripDragOver(false); uploadFiles(Array.from(e.dataTransfer.files)); } : undefined}>
        {imgs.map((url, i) => (
          <div key={url} draggable={editing}
            onDragStart={editing ? () => onDragStart(i) : undefined}
            onDragOver={editing ? e => onDragOverImg(e, i) : undefined}
            onDragEnd={editing ? onDragEnd : undefined}
            className="relative flex-shrink-0 rounded-xl overflow-hidden"
            style={{ width: 72, height: 72, opacity: dragIdx === i ? 0.4 : 1, cursor: editing ? 'grab' : 'pointer', border: (activeImg === url || (!activeImg && i === 0)) ? '2px solid #007e6d' : `1px solid ${border}` }}
            onClick={() => setActiveImg(url)}>
            <img src={url} alt="" className="w-full h-full object-cover" />
            {i === 0 && <div className="absolute bottom-0 left-0 right-0 text-center text-[8px] font-bold py-0.5" style={{ background: 'rgba(10,132,255,0.85)', color: 'white' }}>COVER</div>}
            {editing && (
              <button onClick={e => { e.stopPropagation(); removeImg(i); }}
                className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        ))}
        {editing && (
          <div className="flex-shrink-0 rounded-xl flex flex-col items-center justify-center cursor-pointer"
            style={{ width: 72, height: 72, border: `2px dashed ${stripDragOver ? '#007e6d' : border}`, background: stripDragOver ? (dm ? 'rgba(10,132,255,0.1)' : '#EBF4FF') : 'transparent' }}
            onClick={() => fileInputRef.current?.click()}>
            {uploading ? <div className="h-5 w-5 rounded-full border-2 border-accent border-t-transparent animate-spin" /> : (
              <><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke={muted} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              <span style={{ fontSize: 9, fontWeight: 700, color: muted }}>Add</span></>
            )}
          </div>
        )}
      </div>
      {mediaVideo && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: subtle }}>
          <svg className="h-4 w-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /></svg>
          <span className="text-sm flex-1" style={{ color: dm ? '#d1d5db' : '#374151' }}>Promo video attached</span>
          {editing && <button onClick={async () => { setMediaVideo(''); if (business) await getSupabase().from('businesses').update({ video_url: null }).eq('id', business.id); }} className="text-xs font-semibold text-red-500">Remove</button>}
        </div>
      )}
    </div>
  );

  // ── Card preview ────────────────────────────────────────────────────────────
  const displayImg = activeImg || imgs[0];
  const cardPreview = (
    <div className="space-y-4">
      {/* Preview card */}
      <div className="rounded-2xl overflow-hidden border" style={{ background: bg, borderColor: border }}>
        {/* Cover */}
        <div className="relative" style={{ height: 200, background: dm ? '#2c2c2e' : '#e5e7eb' }}>
          {displayImg ? <img src={displayImg} alt="" className="w-full h-full object-cover" /> : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-sm" style={{ color: muted }}>No photos yet</p>
            </div>
          )}
          <button onClick={() => setEditingCard(e => !e)}
            className="absolute top-3 right-3 flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-xl"
            style={{ background: editingCard ? '#007e6d' : 'rgba(0,0,0,0.55)', color: 'white', backdropFilter: 'blur(8px)' }}>
            {editingCard ? <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Done</> : <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>Edit</>}
          </button>
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h2 className="text-lg font-black" style={{ color: dm ? '#f2f2f7' : '#1c1c1e', letterSpacing: '-0.02em' }}>{business?.name}</h2>
              <p className="text-xs mt-0.5" style={{ color: muted }}>{business?.address}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <svg className="h-3.5 w-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              <span className="text-sm font-bold" style={{ color: dm ? '#f2f2f7' : '#1c1c1e' }}>{business?.rating ?? '—'}</span>
            </div>
          </div>

          {/* Description — editable inline */}
          {editingCard ? (
            <div className="relative mb-3">
              <textarea value={editDesc} maxLength={1000} onChange={e => { setEditDesc(e.target.value); setUnsaved(true); }} onBlur={saveDesc}
                placeholder="Tell customers about your services…" rows={3}
                className="w-full px-3 py-2 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent"
                style={{ background: subtle, borderColor: border, color: dm ? '#f2f2f7' : '#1c1c1e' }} />
              <span className="absolute bottom-2 right-3 text-[10px]" style={{ color: dm ? '#9ca3af' : '#9ca3af' }}>{editDesc.length}/1000</span>
            </div>
          ) : editDesc ? (
            <p className="text-sm leading-relaxed mb-3" style={{ color: dm ? '#ebebf0' : '#3a3a3c' }}>{editDesc}</p>
          ) : null}

          {(business?.service_tags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(business!.service_tags ?? []).map((tag: string) => (
                <span key={tag} className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: dm ? 'rgba(10,132,255,0.15)' : '#e8f0fe', color: '#007e6d' }}>{serviceTagToLabel(tag)}</span>
              ))}
              {business?.price_tier ? (
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: dm ? 'rgba(10,132,255,0.15)' : '#e8f0fe', color: '#007e6d' }}>{'$'.repeat(business.price_tier)}</span>
              ) : null}
            </div>
          )}

          {/* Photo strip */}
          {photoStrip(editingCard)}
        </div>
      </div>
    </div>
  );

  // ── Modal preview ───────────────────────────────────────────────────────────
  const modalPreview = (
    <div className="rounded-2xl overflow-hidden border" style={{ background: bg, borderColor: border }}>
      {/* Header image */}
      <div style={{ height: 180, background: dm ? '#2c2c2e' : '#e5e7eb', position: 'relative' }}>
        {displayImg ? <img src={displayImg} alt="" className="w-full h-full object-cover" /> : null}
        {/* Photo thumbnails */}
        {imgs.length > 1 && (
          <div className="absolute bottom-2 left-3 flex gap-1.5" style={{ maxWidth: 'calc(100% - 60px)' }}>
            {imgs.slice(0,5).map((url, i) => (
              <div key={i} className="flex-shrink-0 rounded-lg overflow-hidden cursor-pointer" style={{ width: 44, height: 32, border: `2px solid ${displayImg === url ? '#fff' : 'rgba(255,255,255,0.4)'}`, opacity: displayImg === url ? 1 : 0.6 }} onClick={() => setActiveImg(url)}>
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
        <button onClick={() => setEditingModal(e => !e)}
          className="absolute top-3 right-3 flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-xl"
          style={{ background: editingModal ? '#007e6d' : 'rgba(0,0,0,0.55)', color: 'white', backdropFilter: 'blur(8px)' }}>
          {editingModal ? <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Done</> : <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>Edit</>}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Name + rating */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black" style={{ color: dm ? '#f2f2f7' : '#1c1c1e', letterSpacing: '-0.02em' }}>{business?.name}</h2>
            <p className="text-xs mt-0.5" style={{ color: muted }}>{business?.address}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-full" style={{ background: subtle }}>
            <svg className="h-3.5 w-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            <span className="text-sm font-bold" style={{ color: dm ? '#f2f2f7' : '#1c1c1e' }}>{business?.rating ?? '—'}</span>
            {(business?.review_count ?? 0) > 0 && <span className="text-xs" style={{ color: muted }}>({business.review_count})</span>}
          </div>
        </div>

        {/* Description — editable in modal edit mode */}
        {editingModal ? (
          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: muted }}>Description</p>
            <div className="relative">
              <textarea value={editDesc} maxLength={1000} onChange={e => { setEditDesc(e.target.value); setUnsaved(true); }} onBlur={saveDesc}
              placeholder="Tell customers about your services…" rows={3}
                className="w-full px-3 py-2 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent"
                style={{ background: subtle, borderColor: border, color: dm ? '#f2f2f7' : '#1c1c1e' }} />
              <span className="absolute bottom-2 right-3 text-[10px]" style={{ color: dm ? '#9ca3af' : '#9ca3af' }}>{editDesc.length}/1000</span>
            </div>
          </div>
        ) : editDesc ? <p className="text-sm leading-relaxed" style={{ color: dm ? '#ebebf0' : '#3a3a3c' }}>{editDesc}</p> : null}

        {/* Tags */}
        {(business?.service_tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(business!.service_tags ?? []).map((tag: string) => (
              <span key={tag} className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: dm ? 'rgba(10,132,255,0.15)' : '#e8f0fe', color: '#007e6d' }}>{serviceTagToLabel(tag)}</span>
            ))}
            {business?.price_tier ? (
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: dm ? 'rgba(10,132,255,0.15)' : '#e8f0fe', color: '#007e6d' }}>{'$'.repeat(business.price_tier)}</span>
            ) : null}
          </div>
        )}

        {/* Services preview */}
        <div className="rounded-xl p-3.5 space-y-2" style={{ background: subtle }}>
          <p className="text-[10px] font-black uppercase tracking-wider mb-2.5" style={{ color: muted }}>Services</p>
          {services.length === 0 ? (
            <p className="text-xs" style={{ color: muted }}>No services listed yet</p>
          ) : (
            services.slice(0, 4).map((s: any) => (
              <div key={s.id || s.name} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: dm ? '#f2f2f7' : '#1c1c1e' }}>{s.name}</p>
                  {s.description && <p className="text-[11px] truncate" style={{ color: muted }}>{s.description}</p>}
                </div>
                {s.price_cents != null && (
                  <span className="text-xs font-bold" style={{ color: '#007e6d' }}>${(s.price_cents / 100).toFixed(2)}</span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Contact info */}
        <div className="rounded-xl p-3.5 space-y-2" style={{ background: subtle }}>
          <p className="text-[10px] font-black uppercase tracking-wider mb-2.5" style={{ color: muted }}>Contact Info</p>
          {[
            { icon: 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z', val: business?.phone, edit: 'phone', placeholder: '+1 (555) 000-0000' },
            { icon: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75', val: business?.owner_email, edit: null },
            { icon: 'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3', val: business?.website, edit: 'website', placeholder: 'https://yourwebsite.com' },
          ].map(({ icon, val, edit, placeholder }) => (
            <div key={icon} className="flex items-center gap-2.5">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="#007e6d" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
              {editingModal && edit ? (
                <div className="relative flex-1">
                  <input className="w-full text-sm bg-transparent border-b focus:outline-none focus:border-accent"
                    style={{ color: dm ? '#f2f2f7' : '#1c1c1e', borderColor: dm ? '#404040' : '#d1d5db' }}
                    maxLength={edit === 'phone' ? 20 : edit === 'website' ? 200 : 120}
                    defaultValue={val || ''} placeholder={placeholder}
                    onBlur={async e => { if (business) { await getSupabase().from('businesses').update({ [edit]: e.target.value }).eq('id', business.id); setBusiness((b: any) => b ? { ...b, [edit]: e.target.value } : b); } }} />
                  <span className="absolute -bottom-4 right-0 text-[10px]" style={{ color: dm ? '#9ca3af' : '#9ca3af' }}>{String(val || '').length}/{edit === 'phone' ? 20 : edit === 'website' ? 200 : 120}</span>
                </div>
              ) : (
                <span className="text-sm" style={{ color: val ? (dm ? '#ebebf0' : '#3a3a3c') : muted }}>{val || <em>Not set</em>}</span>
              )}
            </div>
          ))}
        </div>

        {/* Photos in modal tab */}
        {photoStrip(editingModal)}

        {/* Book CTA */}
        <div className="rounded-xl py-3.5 text-center text-sm font-bold" style={{ background: 'linear-gradient(135deg,#007e6d 0%,#1e554c 100%)', color: 'white' }}>
          Book {business?.name}
        </div>
        <p className="text-xs text-center" style={{ color: muted }}>Calendar availability and reviews appear in the live modal</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {modalPreview}

      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden"
        onChange={e => { uploadFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
    </div>
  );
}


const BusinessDashboard: NextPage = () => {
  const router = useRouter();
  const { dm, toggle: toggleDarkMode } = useDm();
  const VALID_TABS: TabId[] = ['overview','bookings','messages','clients','calendar','services','edit','settings'];
  const [tab, setTab] = useState<TabId>('overview');
  const [previewEditMode, setPreviewEditMode] = useState(false);
  const [previewKey, setPreviewKey] = useState(() => Date.now());
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [services, setServices] = useState([]);
  const [svcLoading, setSvcLoading] = useState(false);
  const [svcName, setSvcName] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcPrice, setSvcPrice] = useState('');
  const [svcDuration, setSvcDuration] = useState('60');
  const [svcRequiresTime, setSvcRequiresTime] = useState(true);
  const [svcError, setSvcError] = useState('');
  const [svcSaving, setSvcSaving] = useState(false);
  const [editingSvc, setEditingSvc] = useState(null);
  
  // Read tab from URL hash on mount and on hash change
  useEffect(() => {
    function readHash() {
      const rawHash = window.location.hash.replace('#', '');
      const hash = rawHash === 'preview' ? 'edit' : rawHash;
      if (VALID_TABS.includes(hash as TabId)) setTab(hash as TabId);
    }
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);
  const [business, setBusiness] = useState<Business | null>(null);

  // Sync tab changes to URL hash so refresh restores position
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.replace('#','') !== tab) {
      try {
        window.history.replaceState(null, '', '#' + tab);
      } catch {}
    }
  }, [tab]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (typeof event.data !== 'object' || event.data === null) return;
      if (event.data?.type === 'scheduleme-dashboard-preview-state') {
        setPreviewEditMode(!!event.data.editMode);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  function sendPreviewAction(action: 'enter-edit' | 'save-edit' | 'cancel-edit') {
    previewFrameRef.current?.contentWindow?.postMessage(
      { type: 'scheduleme-dashboard-preview-action', action },
      window.location.origin
    );
  }
  function sendPreviewFocus(section: 'coreProfile' | 'media') {
    previewFrameRef.current?.contentWindow?.postMessage(
      { type: 'scheduleme-dashboard-preview-action', action: 'focus-section', section },
      window.location.origin
    );
  }

  function jumpToPublishRequirement(section: 'coreProfile' | 'services' | 'media' | 'stripe') {
    if (section === 'services') {
      setTab('services');
      return;
    }
    if (section === 'stripe') {
      setTab('settings');
      return;
    }
    setTab('edit');
    window.setTimeout(() => {
      sendPreviewAction('enter-edit');
      window.setTimeout(() => sendPreviewFocus(section), 180);
    }, 120);
  }
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeConnectError, setStripeConnectError] = useState('');
  const [stripeStatusMsg, setStripeStatusMsg] = useState('');
  const [stripePolling, setStripePolling] = useState(false);
  const [stripeFallbackUrl, setStripeFallbackUrl] = useState('');
  const [showDisconnectStripe, setShowDisconnectStripe] = useState(false);
  const [disconnectStripeText, setDisconnectStripeText] = useState('');
  const [disconnectStripeLoading, setDisconnectStripeLoading] = useState(false);
  const [disconnectStripeError, setDisconnectStripeError] = useState('');
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteAccountText, setDeleteAccountText] = useState('');
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [payoutBalance, setPayoutBalance] = useState<{ available: number; pending: number } | null>(null);
  const stripeSuccess = router.query.stripe === 'success';
  const stripeCta = business?.stripe_account_id ? 'Continue Stripe setup →' : 'Connect bank & get paid →';
  const [campusEduEmail, setCampusEduEmail] = useState('');
  const [campusCodeSent, setCampusCodeSent] = useState(false);
  const [campusBannerDismissed, setCampusBannerDismissed] = useState(false);
  const [campusAffilDismissed, setCampusAffilDismissed] = useState(false);
  const [bookingPrices, setBookingPrices] = useState<Record<string, string>>({});
  const [campusCode, setCampusCode] = useState('');
  const [campusVerifying, setCampusVerifying] = useState(false);
  const [campusSending, setCampusSending] = useState(false);
  const [campusVerifyError, setCampusVerifyError] = useState('');
  const [campusVerifySuccess, setCampusVerifySuccess] = useState('');
  const [showCampusModal, setShowCampusModal] = useState(false);
  const [showDisconnectEdu, setShowDisconnectEdu] = useState(false);
  const [disconnectText, setDisconnectText] = useState('');
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [disconnectError, setDisconnectError] = useState('');
  const [bkFilter, setBkFilter] = useState<'all'|'pending'|'disputed'|'active'|'completed'|'cancelled'>('pending');
  const [bkFilterTouched, setBkFilterTouched] = useState(false);
  const [calendarDay, setCalendarDay] = useState<number | null>(null);
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [confirmComplete, setConfirmComplete] = useState<Booking | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ booking: Booking; action: 'confirm' | 'cancel' | 'dispute' | 'accept_price'; priceCents?: number } | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmAcknowledge, setConfirmAcknowledge] = useState(false);
  const [completeAcknowledge, setCompleteAcknowledge] = useState(false);
  const [completeSubmitting, setCompleteSubmitting] = useState(false);
  const [completeProofNote, setCompleteProofNote] = useState('');
  const [completeProofPhotos, setCompleteProofPhotos] = useState<string[]>([]);
  const [completeProofUploading, setCompleteProofUploading] = useState(false);
  const [actionDone, setActionDone] = useState<{ title: string; message: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const didAutoTabRef = useRef(false);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    if (didAutoTabRef.current || bkFilterTouched) return;
    if (bookings.length === 0) return;
    const pendingCount = bookings.filter(b => b.status === 'pending').length;
    if (pendingCount > 0) {
      setBkFilter('pending');
    } else {
      setBkFilter('active');
    }
    didAutoTabRef.current = true;
  }, [bookings, bkFilterTouched]);

  useEffect(() => {
    setConfirmAcknowledge(false);
  }, [confirmAction?.booking?.id, confirmAction?.action]);

  useEffect(() => {
    setCompleteAcknowledge(false);
    setCompleteProofNote('');
    setCompleteProofPhotos([]);
  }, [confirmComplete?.id]);

  // Messages state
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [msgDraft, setMsgDraft] = useState('');
  const msgPollRef = useRef<NodeJS.Timeout | null>(null);
  const [msgThreads, setMsgThreads] = useState<any[]>([]);
  const [activeMsgThread, setActiveMsgThread] = useState<any>(null);
  const [threadMessages, setThreadMessages] = useState<any[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [uploadingMsgImage, setUploadingMsgImage] = useState(false);
  const [pendingMsgImage, setPendingMsgImage] = useState<File | null>(null);
  const [pendingMsgPreview, setPendingMsgPreview] = useState<string | null>(null);
  const [msgLightboxUrl, setMsgLightboxUrl] = useState<string | null>(null);
  const [blockedCustomers, setBlockedCustomers] = useState<Record<string, boolean>>({});
  const [blockConfirm, setBlockConfirm] = useState<{ userId: string; name: string; bookingIds: string[] } | null>(null);
  const msgBottomRef = useRef<HTMLDivElement>(null);
  const msgInputRef = useRef<HTMLTextAreaElement>(null);
  const msgFileInputRef = useRef<HTMLInputElement>(null);
  const msgPollRef2 = useRef<NodeJS.Timeout | null>(null);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editZip, setEditZip] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editServices, setEditServices] = useState('');
  const [editAvailability, setEditAvailability] = useState('open');
  const [editBreakUntil, setEditBreakUntil] = useState('');
  const [editHours, setEditHours] = useState<Record<string, string>>({});
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [mediaImages, setMediaImages] = useState<string[]>([]);
  const [mediaVideo, setMediaVideo] = useState<string | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsNotice, setSettingsNotice] = useState('');
  const [publicVisibility, setPublicVisibility] = useState(false);
  const [publicShowName, setPublicShowName] = useState(false);
  const [publicShowPhotos, setPublicShowPhotos] = useState(false);
  const [campusShowName, setCampusShowName] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [publishChecklist, setPublishChecklist] = useState<any>(null);
  const [publishReady, setPublishReady] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const HOURS_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  function hoursToMap(hours: any): Record<string, string> {
    if (!hours) return {};
    if (Array.isArray(hours)) {
      const map: Record<string, string> = {};
      for (const h of hours) {
        if (h?.day && typeof h?.time === 'string') map[h.day] = h.time;
      }
      return map;
    }
    return hours || {};
  }
  function mapToHoursArray(map: Record<string, string>): { day: string; time: string }[] {
    return HOURS_DAYS
      .map(day => (map[day] ? { day, time: map[day] } : null))
      .filter(Boolean) as { day: string; time: string }[];
  }

  async function refreshPublishStatus() {
    try {
      const res = await fetch('/api/provider-publish', { headers: await getAuthHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setPublishChecklist(data.checklist || null);
      setPublishReady(!!data.checklist?.readyToPublish);
    } catch {}
  }

  const loadData = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/business/auth/login'); return; }
      const email = session.user.email || '';
      const normalizedEmail = String(email || '').toLowerCase().trim();
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

      let biz: any = null;
      let bizErr: any = null;

      const byOwnerID = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', session.user.id)
        .maybeSingle();
      biz = byOwnerID.data;
      bizErr = byOwnerID.error;

      // Legacy safety fallback: if owner_id is missing but owner_email matches this account,
      // self-heal by linking owner_id for future strict ownership checks.
      if (!biz && normalizedEmail) {
        const byLegacyEmail = await supabase
          .from('businesses')
          .select('*')
          .ilike('owner_email', normalizedEmail)
          .maybeSingle();
        if (byLegacyEmail.data) {
          if (!byLegacyEmail.data.owner_id) {
            await supabase.from('businesses').update({ owner_id: session.user.id }).eq('id', byLegacyEmail.data.id);
          }
          biz = { ...byLegacyEmail.data, owner_id: session.user.id };
        } else if (byLegacyEmail.error) {
          bizErr = byLegacyEmail.error;
        }
      }
      if (bizErr || !biz) {
        await supabase.auth.signOut();
        router.replace('/business/auth/login?error=not_a_business');
        return;
      }

      // Ensure profile is marked as business
      try {
        const nextRole = profile?.role === 'admin' ? 'admin' : 'business';
        await supabase.from('profiles').upsert({
          id: session.user.id,
          email,
          role: nextRole,
          has_seen_welcome: true,
        }, { onConflict: 'id', ignoreDuplicates: false });
      } catch {}
      const safeBiz = normalizeBusiness(biz);
      if (!safeBiz?.id) {
        await supabase.auth.signOut();
        router.replace('/business/auth/login?error=not_a_business');
        return;
      }

      setBusiness(safeBiz);
      loadBlockedCustomers(safeBiz.id);
      setEditName(safeBiz.name || ''); setEditPhone(safeBiz.phone || ''); setEditAddress(safeBiz.address || '');
      setEditCity(safeBiz.city || '');
      setEditZip(safeBiz.zip || '');
      setEditDesc(safeBiz.description || ''); setEditWebsite(safeBiz.website || '');
      setEditAvailability(safeBiz.availability_status || 'open');
      setEditBreakUntil(safeBiz.break_until ? String(safeBiz.break_until).slice(0, 10) : '');
      const serviceTags = Array.isArray(safeBiz.service_tags) ? safeBiz.service_tags : [];
      setEditServices(serviceTags.map((tag: string) => serviceTagToLabel(tag)).join(', '));
      setEditHours(hoursToMap(safeBiz.hours));
      setMediaImages(toStringArray(safeBiz.media_urls).length ? toStringArray(safeBiz.media_urls) : (safeBiz.cover_url ? [toStringSafe(safeBiz.cover_url)] : []));
      setMediaVideo(safeBiz.video_url ? toStringSafe(safeBiz.video_url) : null);
      setPublicVisibility(Boolean(safeBiz.public_visibility));
      setPublicShowName(Boolean(safeBiz.public_show_name));
      setPublicShowPhotos(Boolean(safeBiz.public_show_photos));
      setCampusShowName(Boolean(safeBiz.campus_show_name));
      refreshPublishStatus();

      const authHeaders = await getAuthHeaders();
      const [bkgRes, msgsRes, balRes] = await Promise.allSettled([
        fetch('/api/bookings?business_id=' + safeBiz.id, { headers: authHeaders }),
        fetch('/api/messages?business_id=' + safeBiz.id, { headers: authHeaders }),
        fetch('/api/stripe-balance', { method: 'POST', headers: authHeaders }),
      ]);

      let resolvedBookings: any[] = [];

      if (bkgRes.status === 'fulfilled' && bkgRes.value?.ok) {
        const bkgData = await bkgRes.value.json().catch(() => ({}));
        resolvedBookings = normalizeBookings(bkgData?.bookings);
        setBookings(resolvedBookings);
      } else {
        const { data: fallbackBookings } = await supabase
          .from('bookings')
          .select(`
            id,
            business_id,
            user_id,
            service,
            status,
            created_at,
            scheduled_start,
            scheduled_end,
            amount_cents,
            paid_at,
            customer_proposed_price_cents,
            provider_proposed_price_cents,
            price_accepted_by_customer,
            price_accepted_by_provider,
            price_accepted_at,
            dispute_amount_cents,
            dispute_note,
            dispute_at,
            profiles(id, name, phone, email, avatar_url)
          `)
          .eq('business_id', safeBiz.id)
          .order('created_at', { ascending: false });
        resolvedBookings = normalizeBookings(fallbackBookings);
        setBookings(resolvedBookings);
      }

      if (msgsRes.status === 'fulfilled' && msgsRes.value?.ok) {
        const md = await msgsRes.value.json().catch(() => ({}));
        const normalized = normalizeThreads(md?.threads);
        setMsgThreads(normalized);
        setThreads(normalized);
      } else {
        const fallbackThreads = normalizeThreads(buildThreadFallbackFromBookings(resolvedBookings, safeBiz.id));
        setMsgThreads(fallbackThreads);
        setThreads(fallbackThreads);
      }

      if (balRes.status === 'fulfilled' && balRes.value?.ok) {
        try {
          const b = await balRes.value.json();
          if (typeof b?.available === 'number' && typeof b?.pending === 'number') setPayoutBalance({ available: b.available, pending: b.pending });
        } catch {}
      }
    } catch (err) {
      console.error('Provider dashboard loadData failed', err);
      setBookings([]);
      setMsgThreads([]);
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (tab !== 'services' || !business) return;
    setSvcLoading(true);
    fetch('/api/services?business_id=' + business.id)
      .then(r => r.json())
      .then(data => { setServices(data.services || []); setSvcLoading(false); })
      .catch(() => setSvcLoading(false));
  }, [tab, business]);

  useEffect(() => {
    if (!business?.id) return;
    refreshPublishStatus();
  }, [
    business?.id,
    business?.description,
    business?.address,
    business?.phone,
    business?.website,
    business?.stripe_onboarded,
    mediaImages.length,
    mediaVideo,
    services.length,
  ]);

  useEffect(() => { loadData(); if (router.query.stripe === 'success') loadData(); }, [loadData, router.query]);

  useEffect(() => {
    if (!business?.id) return;
    if (typeof window === 'undefined') return;
    const key = 'sm_biz_tour_seen';
    try {
      if (localStorage.getItem(key) === '1') return;
    } catch {}
    setShowTour(true);
  }, [business?.id]);

  useEffect(() => {
    if (!business) return;
    if (!router.query.stripe) return;
    if (!['success', 'refresh'].includes(String(router.query.stripe))) return;
    let cancelled = false;
    const poll = async () => {
      setStripePolling(true);
      setStripeStatusMsg('Finishing Stripe setup…');
      for (let i = 0; i < 4; i++) {
        const onboarded = await refreshStripeStatus();
        if (cancelled) return;
        if (onboarded) {
          setStripeStatusMsg('Stripe connected. You’re ready to get paid.');
          setStripePolling(false);
          return;
        }
        await new Promise(r => setTimeout(r, 3000));
      }
      setStripeStatusMsg('Stripe setup is still processing. It can take a few minutes — refresh this page if it doesn’t update.');
      setStripePolling(false);
      if (business?.stripe_account_id && typeof window !== 'undefined') {
        const autoKey = `sm_stripe_autocontinue_${business.id}`;
        try {
          if (!localStorage.getItem(autoKey)) {
            localStorage.setItem(autoKey, '1');
            setTimeout(() => handleStripeConnect('update'), 1200);
          }
        } catch {}
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [business?.id, router.query?.stripe]);

  useEffect(() => {
    if (!business || business.stripe_onboarded) return;
    if (stripeLoading) return;
    if (router.query.stripe) return;
    if (router.query.onboard !== 'stripe') return;
    const key = `sm_stripe_autostart_${business.id}`;
    if (typeof window !== 'undefined') {
      try {
        if (localStorage.getItem(key) === '1') return;
        localStorage.setItem(key, '1');
      } catch {}
    }
    handleStripeConnect();
  }, [business, stripeLoading, router.query, handleStripeConnect]);

  useEffect(() => {
    setCalendarDay(null);
  }, [calendarMonthOffset]);

  // Load + subscribe to thread list when on messages tab
  useEffect(() => {
    if (tab !== 'messages' || !business) return;
    loadThreads();
    // Poll thread list every 10s for new conversations
    const interval = setInterval(loadThreads, 10000);
    return () => clearInterval(interval);
  }, [tab, business]);

  const threadMessagesUrl = useCallback((thread: any, businessId?: string | null) => {
    const bid = businessId || business?.id;
    if (!thread) return null;
    if (thread?.customer_id && isValidUuid(thread.customer_id) && bid) {
      return `/api/messages?thread_customer_id=${thread.customer_id}&business_id=${bid}`;
    }
    const fallbackBookingId = thread?.booking_id || thread?.booking_ids?.[0];
    if (fallbackBookingId && isValidUuid(fallbackBookingId)) {
      return `/api/messages?booking_id=${fallbackBookingId}`;
    }
    return null;
  }, [business?.id]);

  // Polling for active thread messages (merged by customer)
  useEffect(() => {
    if (!activeMsgThread || !business) return;
    const businessId = business.id;

    const loadMessages = async () => {
      const url = threadMessagesUrl(activeMsgThread, businessId);
      if (!url) return;
      const headers = await getAuthHeaders();
      const res = await fetch(url, { headers });
      if (res.ok) {
        const d = await res.json();
        setThreadMessages((prev: any[]) => {
          const incoming = d.messages || [];
          const pending = prev.filter((m: any) => typeof m.id === 'string' && m.id.startsWith('temp-'));
          if (!pending.length) return incoming;
          const incomingIds = new Set(incoming.map((m: any) => m.id));
          const merged = incoming.concat(pending.filter((m: any) => !incomingIds.has(m.id)));
          return merged;
        });
        if (d.thread) setActiveMsgThread((t: any) => t ? { ...t, ...d.thread } : t);
      }
    };

    loadMessages();

    if (msgPollRef2.current) clearInterval(msgPollRef2.current);
    msgPollRef2.current = setInterval(() => {
      loadMessages();
    }, 3000);

    return () => {
      if (msgPollRef2.current) { clearInterval(msgPollRef2.current); msgPollRef2.current = null; }
    };
  }, [activeMsgThread?.id, activeMsgThread?.customer_id, business?.id, threadMessagesUrl]);

  useEffect(() => {
    msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages]);

  async function loadThreads() {
    if (!business) return;
    const res = await fetch('/api/messages?business_id=' + business.id, { headers: await getAuthHeaders() });
    if (res.ok) {
      const d = await res.json().catch(() => ({}));
      const normalized = normalizeThreads(d?.threads);
      setThreads(normalized);
      setMsgThreads(normalized);
    }
  }

  async function loadBlockedCustomers(businessId: string) {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/blocks?business_id=${businessId}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, boolean> = {};
      for (const b of data.blocks || []) map[b.user_id] = true;
      setBlockedCustomers(map);
    } catch {}
  }

  async function loadThreadMessages(thread: any) {
    const url = threadMessagesUrl(thread);
    if (!url) return;
    const res = await fetch(url, { headers: await getAuthHeaders() });
    if (res.ok) { const d = await res.json(); setThreadMessages(d.messages || []); if (d.thread) setActiveMsgThread((t: any) => t ? { ...t, ...d.thread } : t); }
  }


  function attachBizImage(file: File) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPendingMsgImage(file);
    setPendingMsgPreview(url);
  }

  function clearPendingBizImage() {
    if (pendingMsgPreview) URL.revokeObjectURL(pendingMsgPreview);
    setPendingMsgImage(null);
    setPendingMsgPreview(null);
  }

  async function sendBizMessage(raw: string) {
    if (pendingMsgImage) {
      await sendBizImage(pendingMsgImage);
      return;
    }
    if (!activeMsgThread || !raw.trim() || msgSending) return;
    const bookingId = activeMsgThread.booking_id || activeMsgThread.booking_ids?.[0];
    if (!bookingId) return;
    const activeCustomerId = activeMsgThread.profiles?.id || activeMsgThread.customer_id;
    if (activeCustomerId && blockedCustomers[activeCustomerId]) {
      showToast('Messaging blocked for this customer.', false);
      return;
    }
    setMsgSending(true);
    const content = raw.trim();
    setMsgInput('');
    const tempId = `temp-${Date.now()}`;
    const tempMsg = { id: tempId, booking_id: bookingId, sender_type: 'business', content, created_at: new Date().toISOString() };
    setThreadMessages((m: any[]) => [...m, tempMsg]);
    setMsgThreads((ts: any[]) => ts.map((t: any) => t.id === activeMsgThread.id ? { ...t, lastMessage: tempMsg } : t));
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { ...await getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, sender_type: 'business', content }),
      });
      if (res.ok) {
        const data = await res.json();
        setThreadMessages((m: any[]) => m.map((msg: any) => msg.id === tempId ? data.message : msg));
        setMsgThreads((ts: any[]) => ts.map((t: any) => t.id === activeMsgThread.id ? { ...t, lastMessage: data.message } : t));
        setTimeout(() => msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      } else {
        setThreadMessages((m: any[]) => m.filter((msg: any) => msg.id != tempId));
        const err = await res.json().catch(() => ({}));
        showToast(err?.error || 'Message failed to send.', false);
      }
    } finally {
      setMsgSending(false);
      msgInputRef.current?.focus();
    }
  }

  async function sendBizImage(file: File) {
    if (!activeMsgThread || !file || uploadingMsgImage) return;
    const bookingId = activeMsgThread.booking_id || activeMsgThread.booking_ids?.[0];
    if (!bookingId) return;
    const activeCustomerId = activeMsgThread.profiles?.id || activeMsgThread.customer_id;
    if (activeCustomerId && blockedCustomers[activeCustomerId]) {
      showToast('Messaging blocked for this customer.', false);
      return;
    }
    setUploadingMsgImage(true);
    try {
      const content = msgInput.trim();
      const tempId = `temp-${Date.now()}`;
      const tempMsg = { id: tempId, booking_id: bookingId, sender_type: 'business', content, image_url: pendingMsgPreview || undefined, message_type: 'image', created_at: new Date().toISOString() };
      setThreadMessages((m: any[]) => [...m, tempMsg]);
      setMsgThreads((ts: any[]) => ts.map((t: any) => t.id === activeMsgThread.id ? { ...t, lastMessage: tempMsg } : t));

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const uploadRes = await fetch('/api/upload-message-media', {
        method: 'POST',
        headers: { ...await getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId,
          file_data: dataUrl,
          file_type: file.type,
          file_name: file.name || 'image.jpg',
        }),
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        showToast(uploadData?.error || 'Image upload failed', false);
        setThreadMessages((m: any[]) => m.filter((msg: any) => msg.id !== tempId));
        return;
      }
      const imageUrl = uploadData.url;
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { ...await getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, sender_type: 'business', content, image_url: imageUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setMsgInput('');
        clearPendingBizImage();
        setThreadMessages((m: any[]) => m.map((msg: any) => msg.id === tempId ? data.message : msg));
        setMsgThreads((ts: any[]) => ts.map((t: any) => t.id === activeMsgThread.id ? { ...t, lastMessage: data.message } : t));
      } else {
        setThreadMessages((m: any[]) => m.filter((msg: any) => msg.id !== tempId));
        const err = await res.json().catch(() => ({}));
        showToast(err?.error || 'Message failed to send.', false);
      }
    } finally {
      setUploadingMsgImage(false);
      if (msgFileInputRef.current) msgFileInputRef.current.value = '';
    }
  }

  function getBookingIdsForUser(userId: string) {
    if (activeMsgThread && (activeMsgThread.profiles?.id === userId || activeMsgThread.customer_id === userId)) {
      const ids = activeMsgThread.booking_ids || (activeMsgThread.booking_id ? [activeMsgThread.booking_id] : []);
      if (ids.length) return ids;
    }
    return bookings
      .filter(b => (b.profiles?.id === userId) && ['pending','confirmed','payment_pending'].includes(b.status))
      .map(b => b.id);
  }

  async function applyBlock(userId: string, block: boolean, bookingIds: string[]) {
    if (!business) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: business.id,
          user_id: userId,
          action: block ? 'block' : 'unblock',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data?.error || 'Unable to update block', false);
        return;
      }
      if (block && bookingIds.length) {
        await Promise.all(bookingIds.map((id) =>
          fetch('/api/bookings', {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ booking_id: id, status: 'cancelled' }),
          })
        ));
        setBookings(bs => bs.map(b => bookingIds.includes(b.id) ? { ...b, status: 'cancelled' } : b));
      }
      setBlockedCustomers((m) => ({ ...m, [userId]: block }));
      showToast(block ? 'Customer blocked.' : 'Customer unblocked.', true);
    } catch {
      showToast('Unable to update block', false);
    }
  }

  async function toggleBlockCustomer() {
    if (!activeMsgThread) return;
    const userId = activeMsgThread.profiles?.id || activeMsgThread.customer_id;
    if (!userId) return;
    const isBlocked = !!blockedCustomers[userId];
    if (isBlocked) {
      await applyBlock(userId, false, []);
    } else {
      const bookingIds = getBookingIdsForUser(userId);
      setBlockConfirm({
        userId,
        name: activeMsgThread.profiles?.name || 'customer',
        bookingIds,
      });
    }
  }

  async function openCustomerThread(userId: string) {
    if (!business?.id) return;
    const existing = msgThreads.find((t: any) => t.profiles?.id === userId || t.customer_id === userId || t.id === userId);
    setTab('messages');
    if (existing) {
      if (activeMsgThread?.id === existing.id) return;
      setActiveMsgThread(existing);
      setThreadMessages([]);
      await loadThreadMessages(existing);
      setTimeout(() => msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      return;
    }
    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/messages?thread_customer_id=' + userId + '&business_id=' + business.id, { headers: authHeaders });
    if (res.ok) {
      const d = await res.json();
      if (d.thread) {
        setMsgThreads((ts: any[]) => ts.find((x) => x.id === d.thread.id) ? ts : [d.thread, ...ts]);
        setActiveMsgThread(d.thread);
      }
      setThreadMessages(d.messages || []);
    }
    setTimeout(() => msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  async function openCustomerThreadByEmail(email: string) {
    const existing = msgThreads.find((t: any) => {
      const threadEmail = String(t?.profiles?.email || '').toLowerCase();
      return threadEmail && threadEmail === String(email || '').toLowerCase();
    });
    if (!existing) return;
    setTab('messages');
    try {
      window.history.replaceState(null, '', '#messages');
    } catch {}
    if (activeMsgThread?.id === existing.id) return;
    setActiveMsgThread(existing);
    setThreadMessages([]);
    await loadThreadMessages(existing);
    setTimeout(() => msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  async function sendBusinessMessage() {
    if (!msgDraft.trim() || !selectedThread || msgSending) return;
    setMsgSending(true);
    const text = msgDraft.trim(); setMsgDraft('');
    const res = await fetch('/api/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: selectedThread, sender_type: 'business', content: text }),
    });
    if (res.ok) { const d = await res.json(); setThreadMessages(m => [...m, d.message]); }
    setMsgSending(false);
  }

  async function handleStripeConnect(mode: 'onboarding' | 'update' = 'onboarding') {
    if (!business) return;
    setStripeLoading(true);
    setStripeConnectError('');
    setStripeFallbackUrl('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/stripe-connect', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId: business.id, mode }) });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        setStripeConnectError(data?.error || 'Failed to start Stripe onboarding.');
        return;
      }
      setStripeFallbackUrl(data.url);
      window.location.href = data.url;
    } catch {
      setStripeConnectError('Failed to connect Stripe.');
    } finally {
      setStripeLoading(false);
    }
  }

  async function refreshStripeStatus(): Promise<boolean> {
    if (!business?.id) return false;
    setStripeLoading(true);
    setStripeConnectError('');
    setStripeStatusMsg('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/stripe-connect-status', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStripeConnectError(data?.error || 'Could not refresh Stripe status.');
        return false;
      }
      setBusiness(b => b ? { ...b, stripe_onboarded: !!data?.onboarded } : b);
      try {
        const balRes = await fetch('/api/stripe-balance', { method: 'POST', headers });
        if (balRes.ok) {
          const b = await balRes.json();
          if (typeof b?.available === 'number' && typeof b?.pending === 'number') setPayoutBalance({ available: b.available, pending: b.pending });
        }
      } catch {}
      if (!data?.onboarded) {
        setStripeStatusMsg('Stripe setup isn’t finished yet. Click “Continue Stripe setup” to complete it.');
      }
      if (router.query?.stripe) {
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        router.replace(`/business/dashboard${hash || ''}`, undefined, { shallow: true });
      }
      return !!data?.onboarded;
    } catch {
      setStripeConnectError('Could not refresh Stripe status.');
      return false;
    } finally {
      setStripeLoading(false);
    }
  }


  async function handleCampusSendCode() {
    setCampusSending(true); setCampusVerifyError(''); setCampusVerifySuccess('');
    try {
      const headers = await getAuthHeaders();
      const normalizedEmail = normalizeDomain(campusEduEmail)?.includes('.edu')
        ? String(campusEduEmail).trim().toLowerCase()
        : String(campusEduEmail).trim();
      const res = await fetch('/api/verify-edu', {
        method: 'POST',
        headers,
        body: JSON.stringify({ school_email: normalizedEmail, account_type: 'business', business_id: business?.id || null }),
      });
      const data = await res.json();
      if (!res.ok) { setCampusVerifyError(data.error || 'Failed to send code'); return; }
      setCampusCodeSent(true);
      setCampusEduEmail(normalizedEmail);
      setCampusVerifySuccess(data.message || `Code sent to ${normalizedEmail}`);
    } catch { setCampusVerifyError('Something went wrong.'); }
    finally { setCampusSending(false); }
  }

  async function handleCampusVerify() {
    setCampusVerifying(true); setCampusVerifyError('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/verify-edu', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'verify', code: campusCode, account_type: 'business', business_id: business?.id || null }),
      });
      const data = await res.json();
      if (!res.ok) { setCampusVerifyError(data.error); return; }
      setBusiness(b => b ? {
        ...b,
        edu_verified: true,
        school_email: campusEduEmail,
        school_domain: data.school_domain || normalizeDomain(campusEduEmail),
        campus_provider: data.campus_provider !== false,
        campus_key: data.campus_key || b.campus_key,
        campus_school_name: data.campus_school_name || b.campus_school_name,
        public_show_name: true,
        public_show_photos: true,
        campus_show_name: true,
      } : b);
      setCampusShowName(true);
      setPublicShowName(true);
      setPublicShowPhotos(true);
      setShowCampusModal(false);
      showToast('Campus verification complete. Your provider is now tagged to that campus.', true);
    } catch { setCampusVerifyError('Something went wrong.'); }
    finally { setCampusVerifying(false); }
  }

  async function handleAddService() {
    if (!business || !svcName.trim() || !svcPrice) { setSvcError('Name and price are required'); return; }
    const priceCents = parseInt(svcPrice, 10);
    if (!Number.isFinite(priceCents) || priceCents < 500) { setSvcError('Minimum price is $5.00'); return; }
    setSvcSaving(true); setSvcError('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/services', { method: 'POST', headers, body: JSON.stringify({ business_id: business.id, name: svcName.trim(), description: svcDesc.trim() || null, price_cents: priceCents, duration_min: parseInt(svcDuration) || 60, requires_time: svcRequiresTime }) });
      let data: any = null;
      try { data = await res.json(); } catch { data = null; }
      if (!res.ok) { setSvcError(data?.error || 'Failed to add service'); return; }
      setServices(s => [...s, data.service]);
      setSvcName(''); setSvcDesc(''); setSvcPrice(''); setSvcDuration('60'); setSvcRequiresTime(true);
    } catch {
      setSvcError('Network error. Please try again.');
    } finally {
      setSvcSaving(false);
    }
  }

  async function handleDeleteService(id) {
    if (!business) return;
    const headers = await getAuthHeaders();
    await fetch('/api/services', { method: 'DELETE', headers, body: JSON.stringify({ id, business_id: business.id }) });
    setServices(s => s.filter(sv => sv.id !== id));
  }

  async function handleUpdateService(id, updates) {
    if (!business) return;
    const headers = await getAuthHeaders();
    const res = await fetch('/api/services', { method: 'PATCH', headers, body: JSON.stringify({ id, business_id: business.id, ...updates }) });
    const data = await res.json();
    if (res.ok) { setServices(s => s.map(sv => sv.id === id ? data.service : sv)); setEditingSvc(null); }
  }

  async function handleCustomRequiresTime(next: boolean) {
    if (!business) return;
    try {
      const { error } = await getSupabase().from('businesses').update({ custom_requires_time: next }).eq('id', business.id);
      if (error) throw new Error(error.message);
      setBusiness(b => b ? { ...b, custom_requires_time: next } : b);
      showToast('Custom request scheduling updated', true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update custom request settings', false);
    }
  }

  async function handleSaveHours() {
    if (!business) return;
    setSettingsSaving(true);
    try {
      const breakUntilIso = editBreakUntil ? new Date(editBreakUntil + 'T23:59:59').toISOString() : null;
      const { error } = await getSupabase().from('businesses').update({
        hours: mapToHoursArray(editHours),
        availability_status: editAvailability,
        break_until: breakUntilIso,
      }).eq('id', business.id);
      if (error) throw error;
      setBusiness((b: any) => b ? {
        ...b,
        hours: mapToHoursArray(editHours),
        availability_status: editAvailability,
        break_until: breakUntilIso,
      } : b);
      showToast('Business hours saved.', true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save business hours', false);
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleSetPrice(bookingId: string, amountCents: number) {
    try {
      const current = bookings.find(b => b.id === bookingId);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/set-booking-amount', {
        method: 'POST',
        headers,
        body: JSON.stringify({ booking_id: bookingId, amount_cents: amountCents, notify_customer: true }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to set price'); return false; }
      const nextAmount = data?.amount_cents ?? amountCents;
      const inferredCounterOffer =
        !!current
        && current.status === 'price_disputed'
        && current.customer_proposed_price_cents != null
        && amountCents !== current.customer_proposed_price_cents;
      const nextStatus = data?.status || (inferredCounterOffer ? 'price_disputed' : (current?.status === 'price_disputed' ? 'price_disputed' : 'payment_pending'));
      setBookings(bs => bs.map(b => b.id === bookingId
        ? {
          ...b,
          amount_cents: nextAmount,
          status: nextStatus,
          price_accepted_by_provider: data?.price_accepted_by_provider ?? b.price_accepted_by_provider,
          provider_proposed_price_cents: data?.provider_proposed_price_cents ?? b.provider_proposed_price_cents,
          price_accepted_at: data?.price_accepted_at ?? b.price_accepted_at,
        }
        : b
      ));
      try { await loadData(); } catch {}
      return true;
    } catch {
      alert('Failed to set price. Please try again.');
      return false;
    }
  }

  async function handleUpdateBooking(id: string, status: string, extraPayload: Record<string, any> = {}) {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ booking_id: id, status, ...extraPayload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update booking');
      setBookings(b => b.map(bk => bk.id === id ? { ...bk, status } : bk));
      showToast(status === 'cancelled' ? 'Booking cancelled' : 'Booking updated', true);
      // Refresh from server to ensure filters + counts update
      try { await loadData(); } catch {}
      return true;
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update booking. Please try again.', false);
      return false;
    }
  }

  async function uploadCompleteProofPhoto(bookingId: string, file: File) {
    if (!file) return;
    setCompleteProofUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const uploadRes = await fetch('/api/upload-message-media', {
        method: 'POST',
        headers: { ...await getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId,
          file_data: dataUrl,
          file_type: file.type || 'image/jpeg',
          file_name: file.name || `completion-proof-${Date.now()}.jpg`,
        }),
      });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok || !uploadData?.url) {
        showToast(uploadData?.error || 'Failed to upload proof photo', false);
        return;
      }
      setCompleteProofPhotos((prev) => [...prev, uploadData.url]);
    } catch {
      showToast('Failed to upload proof photo', false);
    } finally {
      setCompleteProofUploading(false);
    }
  }

  async function handleDisputePrice(bookingId: string, disputeAmountCents: number) {
    try {
      if (!Number.isFinite(disputeAmountCents) || disputeAmountCents < 500) {
        showToast('Minimum dispute price is $5.00', false);
        return false;
      }
      const headers = await getAuthHeaders();
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          booking_id: bookingId,
          status: 'price_disputed',
          dispute_amount_cents: disputeAmountCents,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to dispute price');
      setBookings(bs => bs.map(b => b.id === bookingId
        ? { ...b, status: 'price_disputed', dispute_amount_cents: disputeAmountCents, provider_proposed_price_cents: disputeAmountCents, price_accepted_by_customer: false, price_accepted_by_provider: false }
        : b
      ));
      showToast('Price disputed. Customer was notified.', true);
      try { await loadData(); } catch {}
      return true;
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to dispute price. Please try again.', false);
      return false;
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault(); if (!business) return;
    setSettingsSaving(true); setSettingsError(''); setSettingsNotice('');
    const tags = normalizeServiceTags(editServices.split(',').map(s => s.trim()).filter(Boolean));

    const breakUntilIso = editBreakUntil ? new Date(editBreakUntil + 'T23:59:59').toISOString() : null;
    try {
      const res = await fetch('/api/provider-settings', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          business_id: business.id,
          phone: editPhone,
          website: editWebsite,
          city: editCity,
          zip: editZip,
          service_tags: tags,
          hours: mapToHoursArray(editHours),
          availability_status: editAvailability,
          break_until: breakUntilIso,
          public_visibility: publicVisibility,
          public_show_name: publicShowName,
          public_show_photos: publicShowPhotos,
          campus_show_name: campusShowName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      const saved = normalizeBusiness({ ...business, ...(data.business || {}) });
      if (saved) {
        setBusiness((b) => b ? { ...b, ...saved } : saved);
        setEditAddress(saved.address || '');
      }
      setSettingsNotice('Settings saved. Your location now updates your provider coordinates automatically.');
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  }

  async function persistVisibility(nextVisibility: boolean, nextShowName: boolean, nextShowPhotos: boolean, nextCampusShowName: boolean) {
    if (!business) return;
    const prev = { publicVisibility, publicShowName, publicShowPhotos, campusShowName };
    setPublicVisibility(nextVisibility);
    setPublicShowName(nextShowName);
    setPublicShowPhotos(nextShowPhotos);
    setCampusShowName(nextCampusShowName);
    setVisibilitySaving(true);
    let error: any = null;
    try {
      const res = await fetch('/api/provider-visibility', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          business_id: business.id,
          public_visibility: nextVisibility,
          public_show_name: nextShowName,
          public_show_photos: nextShowPhotos,
          campus_show_name: nextCampusShowName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        error = new Error(data.error || 'Failed to save visibility settings');
      }
    } catch (err) {
      error = err;
    }
    setVisibilitySaving(false);
    if (error) {
      setPublicVisibility(prev.publicVisibility);
      setPublicShowName(prev.publicShowName);
      setPublicShowPhotos(prev.publicShowPhotos);
      setCampusShowName(prev.campusShowName);
      showToast(error.message || 'Failed to save visibility settings', false);
      return;
    }
    setBusiness(b => b ? {
      ...b,
      public_visibility: nextVisibility,
      public_show_name: nextShowName,
      public_show_photos: nextShowPhotos,
      campus_show_name: nextCampusShowName,
    } : b);
    showToast('Visibility settings saved', true);
  }

  async function handlePublish(action: 'publish' | 'unpublish') {
    setPublishLoading(true);
    try {
      const res = await fetch('/api/provider-publish', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Failed to update publish status', false);
        if (data.checklist) {
          setPublishChecklist(data.checklist);
          setPublishReady(!!data.checklist.readyToPublish);
        }
        return;
      }
      if (action === 'publish') {
        setBusiness((b: any) => b ? { ...b, is_onboarded: true, public_visibility: true, public_show_name: true, public_show_photos: true, campus_show_name: true } : b);
        setPublicVisibility(true);
        setPublicShowName(true);
        setPublicShowPhotos(true);
        setCampusShowName(true);
        showToast('Profile published and now bookable.', true);
      } else {
        setBusiness((b: any) => b ? { ...b, public_visibility: false } : b);
        setPublicVisibility(false);
        showToast('Profile unpublished.', true);
      }
      await refreshPublishStatus();
    } finally {
      setPublishLoading(false);
    }
  }

  async function handleSignOut() { await getSupabase().auth.signOut(); router.push('/business/auth/login'); }
  async function handleDeleteProviderAccount() {
    setDeleteAccountError('');
    setDeleteAccountLoading(true);
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.access_token },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete account');
      setSigningOut(true);
      await supabase.auth.signOut();
      router.push('/?deleted=1');
    } catch (err) {
      setDeleteAccountLoading(false);
      setDeleteAccountError(err instanceof Error ? err.message : 'Failed to delete account.');
    }
  }

  if (loading) {
    return <BrandRouteLoader audience="provider" />;
  }

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: dm ? '#0a0a0a' : '#f8fafc' }}>
        <div className="w-full max-w-md rounded-2xl border p-6 text-center" style={{ background: dm ? '#171717' : '#fff', borderColor: dm ? '#262626' : '#e5e7eb' }}>
          <p className="text-base font-bold mb-2" style={{ color: dm ? '#f5f5f5' : '#111827' }}>Couldn’t load your provider account</p>
          <p className="text-sm mb-4" style={{ color: dm ? '#a3a3a3' : '#6b7280' }}>Please refresh, or sign in again.</p>
          <div className="flex justify-center gap-2">
            <button onClick={() => window.location.reload()} className="text-sm font-semibold px-4 py-2 rounded-lg bg-accent text-white">
              Refresh
            </button>
            <button onClick={handleSignOut} className="text-sm font-semibold px-4 py-2 rounded-lg border" style={{ borderColor: dm ? '#3f3f46' : '#d1d5db', color: dm ? '#e5e7eb' : '#374151' }}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const platformFeeRate = business?.founder50 ? 0.06 : 0.12;
  const toProviderNet = (grossCents: number) => Math.max(0, Math.round(grossCents * (1 - platformFeeRate)));
  const isProviderPendingBooking = (b: any) => b.status === 'pending' || b.status === 'paid';
  // Only completed jobs count as earned payout.
  const totalCompletedGross = bookings
    .filter(b => b.status === 'completed' && b.amount_cents)
    .reduce((s, b) => s + (b.amount_cents || 0), 0);
  const totalEarned = toProviderNet(totalCompletedGross);
  const totalUnreadMsgs = (Array.isArray(msgThreads) ? msgThreads : []).reduce((s: number, t: any) => s + (Number(t?.unreadCount) || 0), 0);
  const pendingCount = bookings.filter(b => isProviderPendingBooking(b)).length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;
  const isRevenueBooking = (b: any) => (b.status === 'paid' || b.status === 'completed' || !!b.paid_at);
  const isActiveOrCompleted = (b: any) => ['confirmed', 'payment_pending', 'price_disputed', 'paid', 'completed'].includes(b.status);
  const thisMonthGross = bookings
    .filter(b => b.status === 'completed' && b.amount_cents && new Date(b.created_at).getMonth() === new Date().getMonth() && new Date(b.created_at).getFullYear() === new Date().getFullYear())
    .reduce((s, b) => s + (b.amount_cents || 0), 0);
  const thisMonthEarned = toProviderNet(thisMonthGross);
  // Amounts still awaiting release:
  // 1) customer not yet charged, or 2) charged but still not marked complete.
  const pendingPaymentGross = bookings
    .filter(b => ['confirmed', 'payment_pending'].includes(b.status) && b.amount_cents && !b.paid_at)
    .reduce((s, b) => s + (b.amount_cents || 0), 0);
  const heldInStripeGross = bookings
    .filter(b => b.status === 'paid' && b.amount_cents)
    .reduce((s, b) => s + (b.amount_cents || 0), 0);
  const pendingPaymentAmount = toProviderNet(pendingPaymentGross);
  const heldInStripeAmount = toProviderNet(heldInStripeGross);
  const awaitingReleaseAmount = pendingPaymentAmount + heldInStripeAmount;
  const stripeShowsZeroButHeld =
    !!business?.stripe_onboarded
    && !!payoutBalance
    && payoutBalance.available === 0
    && payoutBalance.pending === 0
    && awaitingReleaseAmount > 0;

  const isDisputedPricingFlow = (b: any) => {
    if (b.status === 'price_disputed') return true;
    if (b.status !== 'payment_pending') return false;
    if (!isCustomPricingBooking(b)) return false;
    const waitingOnCustomer = !!b.provider_proposed_price_cents && !b.price_accepted_by_customer;
    const providerHasNotAcceptedCustomer = b.price_accepted_by_provider !== true;
    return waitingOnCustomer || providerHasNotAcceptedCustomer;
  };
  const isActiveBookingFlow = (b: any) =>
    b.status === 'confirmed'
    || (b.status === 'payment_pending' && !isDisputedPricingFlow(b));

  const filteredBookings = bookings.filter(b => {
    if (bkFilter === 'all') return true;
    if (bkFilter === 'pending') return isProviderPendingBooking(b);
    if (bkFilter === 'disputed') return isDisputedPricingFlow(b);
    if (bkFilter === 'active') return isActiveBookingFlow(b);
    if (bkFilter === 'completed') return b.status === 'completed';
    if (bkFilter === 'cancelled') return b.status === 'cancelled';
    return true;
  });

  const today = new Date();
  const calendarBase = new Date(today.getFullYear(), today.getMonth() + calendarMonthOffset, 1);
  const calendarYear = calendarBase.getFullYear();
  const calendarMonth = calendarBase.getMonth();
  const calendarMonthLabel = calendarBase.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
  const isViewingCurrentMonth = calendarYear === today.getFullYear() && calendarMonth === today.getMonth();
  const bookingDates = new Map<number, number>();
  bookings.filter(b => b.status !== 'cancelled').forEach(b => {
    const d = b.scheduled_start ? new Date(b.scheduled_start) : new Date(b.created_at);
    if (d.getMonth() !== calendarMonth || d.getFullYear() !== calendarYear) return;
    const day = d.getDate();
    bookingDates.set(day, (bookingDates.get(day) || 0) + 1);
  });
  const calendarEvents = bookings
    .filter(b => b.status !== 'cancelled' && b.scheduled_start)
    .map(b => ({
      title: `${b.service || 'Booking'} — ${business?.name || 'ScheduleMe'}`,
      details: b.note || '',
      location: b.address || business?.address || '',
      start: new Date(b.scheduled_start),
      end: new Date(b.scheduled_end || new Date(new Date(b.scheduled_start).getTime() + 60 * 60 * 1000)),
    }));

  const clientMap = new Map<string, { id?: string; name: string; email: string; phone: string; avatar_url?: string; bookingCount: number; totalSpent: number; lastBooking: string }>();
  bookings.forEach(b => {
    if (!b.profiles?.email) return;
    if (!isActiveOrCompleted(b)) return;
    const ex = clientMap.get(b.profiles.email);
    const addSpend = isRevenueBooking(b) ? toProviderNet(b.amount_cents || 0) : 0;
    if (ex) { ex.bookingCount++; ex.totalSpent += addSpend; if (b.created_at > ex.lastBooking) ex.lastBooking = b.created_at; }
    else clientMap.set(b.profiles.email, { id: b.profiles.id, name: b.profiles.name || 'Customer', email: b.profiles.email, phone: b.profiles.phone, avatar_url: b.profiles.avatar_url, bookingCount: 1, totalSpent: addSpend, lastBooking: b.created_at });
  });
  const clients = Array.from(clientMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  const uniqueClients = clients.length;
  const campusLabel = formatCampusLabel(business?.school_domain);
  const initials = (business?.name || 'B').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  const activeCustomerId = activeMsgThread?.profiles?.id || activeMsgThread?.customer_id;
  const isCustomerBlocked = activeCustomerId ? !!blockedCustomers[activeCustomerId] : false;
  const TOUR_STEPS = [
    { title: 'Welcome to your dashboard', body: 'This is your provider HQ. Use the sidebar to switch between Overview, Bookings, Messages, and Settings.' },
    { title: 'Bookings & calendar', body: 'Confirm or complete bookings here. The calendar tab helps you see upcoming work at a glance.' },
    { title: 'Messages', body: 'Chat with customers, share photos, and keep everything in one place.' },
    { title: 'Settings & payouts', body: 'Update your listing, hours, and connect Stripe to get paid.' },
    { title: 'Visibility controls', body: 'In Settings, decide if you show on public browse/search or stay campus-only. You also control which details (name/photos) are visible to students vs the public, so set these before you share your listing.' },
    { title: 'Switch views fast', body: 'Use the Consumer site link in the left sidebar to preview the customer experience, and return via the Provider landing page link.' },
  ];
  const tour = TOUR_STEPS[tourStep];

  function finishTour() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('sm_biz_tour_seen', '1');
      } catch {}
    }
    setShowTour(false);
  }

  return (
    <>
      {signingOut && (
        <div className="fixed inset-0 z-[9999]">
          <BrandRouteLoader audience="provider" message="Signing out..." />
        </div>
      )}
      {showTour && tour && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl" style={{ background: dm ? '#0f1115' : 'white', border: `1px solid ${dm ? '#1f2937' : '#e5e7eb'}` }}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: dm ? 'rgba(255,255,255,0.4)' : '#94a3b8' }}>
              Step {tourStep + 1} of {TOUR_STEPS.length}
            </p>
            <p className="text-lg font-black mb-2" style={{ color: dm ? '#f3f4f6' : '#111827' }}>{tour.title}</p>
            <p className="text-sm" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>{tour.body}</p>
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={finishTour}
                className="text-xs font-semibold px-3 py-2 rounded-xl border"
                style={{ borderColor: dm ? '#2a2a2e' : '#e5e7eb', color: dm ? '#9ca3af' : '#6b7280' }}
              >
                Skip
              </button>
              <div className="flex items-center gap-2">
                {tourStep > 0 && (
                  <button
                    onClick={() => setTourStep(s => Math.max(0, s - 1))}
                    className="text-xs font-semibold px-3 py-2 rounded-xl border"
                    style={{ borderColor: dm ? '#2a2a2e' : '#e5e7eb', color: dm ? '#e5e7eb' : '#374151' }}
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={() => {
                    if (tourStep >= TOUR_STEPS.length - 1) finishTour();
                    else setTourStep(s => s + 1);
                  }}
                  className="text-xs font-semibold px-4 py-2 rounded-xl text-white"
                  style={{ background: '#007e6d' }}
                >
                  {tourStep >= TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Head><title>{business?.name || 'Dashboard'} — ScheduleMe for Providers</title></Head>
      <div className="provider-dashboard-shell min-h-screen flex" data-provider-theme={dm ? 'dark' : 'light'} style={{ background: 'var(--section-bg, #f8fafc)' }}>

        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-white border-r border-neutral-100 fixed left-0 top-0 bottom-0 z-30">
          <div className="px-5 py-5 border-b border-neutral-100">
            <Link href="/provider">
              <span className="text-[17px] font-black" style={{ letterSpacing: '-0.03em' }}>
                <span className="text-neutral-900">Schedule</span>
                <span className="text-accent">Me</span>
              </span>
              <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-accent mt-0.5">for Providers</span>
            </Link>
          </div>
          <div className="px-4 py-4 border-b border-neutral-100">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0"
                style={{ background: 'linear-gradient(135deg, #0f766e 0%, #16a394 100%)' }}>{initials}</div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-neutral-900 truncate">{business?.name}</p>
                <p className="text-[10px] text-neutral-400 truncate">{business?.owner_email}</p>
              </div>
            </div>
            {business?.edu_verified && (
              <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg"
                style={{ background: 'rgba(0,126,109,0.10)', border: '1px solid rgba(0,126,109,0.18)' }}>
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="#007e6d" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 8.25L12 4.5l8.25 3.75L12 12 3.75 8.25z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 10.5V14c0 1.5 2.015 3 4.5 3s4.5-1.5 4.5-3v-3.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 9.75v4.5" />
                </svg>
                <p className="text-[11px] font-semibold text-[#0f766e] truncate">Campus verified · {campusLabel || formatCampusLabel(business.school_domain)}</p>
              </div>
            )}
          </div>
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {NAV.map(item => (
              <button key={item.id} onClick={() => {
                setTab(item.id);
                try {
                  window.history.replaceState(null, '', '#' + item.id);
                } catch {}
              }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left ${tab === item.id ? 'bg-accent text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}`}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={tab === item.id ? 2.5 : 1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.d} />
                </svg>
                {item.label}
                {item.id === 'bookings' && pendingCount > 0 && (
                  <span className={`ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full ${tab === item.id ? 'bg-white/25 text-white' : 'bg-accent/10 text-accent'}`}>{pendingCount}</span>
                )}
                {item.id === 'messages' && totalUnreadMsgs > 0 && (
                  <span className={`ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full ${tab === item.id ? 'bg-white/25 text-white' : 'bg-accent/10 text-accent'}`}>{totalUnreadMsgs}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="px-3 py-4 border-t border-neutral-100 space-y-3">
            <div className="px-3">
              <button
                type="button"
                onClick={toggleDarkMode}
                aria-label="Toggle dark mode"
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors"
              >
                <span className="text-sm font-semibold text-neutral-700">{dm ? 'Dark mode' : 'Light mode'}</span>
                <div className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: dm ? '#0f766e' : '#525252' }}>
                    {dm
                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                      : <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                    }
                  </svg>
                  <div className="relative h-4 w-8 rounded-full" style={{ background: dm ? '#0f766e' : '#d1d5db' }}>
                    <div className="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm" style={{ left: dm ? '17px' : '2px', transition: 'left 0.25s ease' }} />
                  </div>
                </div>
              </button>
            </div>
            <p className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">Quick Links</p>
            <Link href="/provider" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l8.25-8.25L19.5 12M5.25 9.75v9a.75.75 0 00.75.75h3.75v-5.25a.75.75 0 01.75-.75h3a.75.75 0 01.75.75v5.25H18a.75.75 0 00.75-.75v-9" /></svg>
              Provider landing page
            </Link>
            <Link href="/home" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
              Open consumer app
            </Link>
            <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex-1 lg:ml-60 flex flex-col min-h-screen pb-20 lg:pb-0">
          {/* Mobile topbar — just the business name */}
          <header className="lg:hidden border-b px-4 py-3 flex items-center sticky top-0 z-20"
            style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#f0f0f0' }}>
            <div className="w-full flex items-center justify-between gap-3">
              <span className="text-base font-black" style={{ letterSpacing: '-0.02em', color: dm ? '#f3f4f6' : '#171717' }}>{business?.name || 'Dashboard'}</span>
              <button
                type="button"
                onClick={toggleDarkMode}
                aria-label="Toggle dark mode"
                className="flex items-center gap-1.5 px-2 py-1 rounded-full border transition-colors"
                style={{ borderColor: dm ? '#2c2c2e' : '#e5e7eb', background: dm ? '#111' : '#fff' }}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: dm ? '#d1fae5' : '#525252' }}>
                  {dm
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                  }
                </svg>
                <div className="relative h-4 w-8 rounded-full" style={{ background: dm ? '#0f766e' : '#d1d5db' }}>
                  <div className="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm" style={{ left: dm ? '17px' : '2px', transition: 'left 0.25s ease' }} />
                </div>
              </button>
            </div>
          </header>

          {/* Mobile bottom tab bar */}
          {/* Mobile FAB — floating draggable nav button */}
          <MobileFAB
            tab={tab}
            setTab={(t) => {
              setTab(t);
              try {
                window.history.replaceState(null, '', '#' + t);
              } catch {}
            }}
            pendingCount={pendingCount}
            totalUnreadMsgs={totalUnreadMsgs}
            dm={dm}
          />

                    {/* Stripe banner */}
          {business && tab === 'overview' && !business.stripe_onboarded && (
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-5xl mx-auto">
                <div className="flex items-center gap-2.5 text-sm">
                  <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <span className="text-amber-800 font-semibold">Step 1/2: Connect bank & get paid</span>
                </div>
                <button onClick={handleStripeConnect} disabled={stripeLoading} className="shrink-0 text-sm font-bold px-4 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                  {stripeLoading ? 'Loading…' : stripeCta}
                </button>
              </div>
              {stripeConnectError && (
                <p className="text-xs text-amber-700 mt-2 max-w-5xl mx-auto">{stripeConnectError}</p>
              )}
              {stripeStatusMsg && !stripeConnectError && (
                <p className="text-xs text-amber-700 mt-2 max-w-5xl mx-auto">{stripeStatusMsg}</p>
              )}
            </div>
          )}
          {business && tab === 'overview' && business.stripe_onboarded && stripeSuccess && (
            <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-5xl mx-auto">
                <div className="flex items-center gap-2.5 text-sm">
                  <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-emerald-800 font-semibold">Step 2/2: Your profile is live.</span>
                </div>
                <button onClick={() => setTab('bookings')} className="shrink-0 text-sm font-bold px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                  See leads →
                </button>
              </div>
            </div>
          )}

          {/* Campus verification banner */}
          {business?.school_domain && !business?.edu_verified && !campusBannerDismissed && (
            <div className="rounded-2xl border p-4 relative" style={{ background: dm ? 'rgba(139,92,246,0.1)' : '#f5f3ff', borderColor: dm ? 'rgba(139,92,246,0.3)' : '#ddd6fe' }}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold mb-0.5" style={{ color: dm ? '#c4b5fd' : '#6d28d9' }}>
                    Complete your campus verification
                  </p>
                  <p className="text-xs mb-3" style={{ color: dm ? '#a78bfa' : '#7c3aed' }}>
                    Verify your <strong>{business.school_domain}</strong> email to go live on the campus feed.
                    You must use an @{business.school_domain} email address.
                  </p>
                  {!campusCodeSent ? (
                    <div className="flex gap-2">
                      <input type="email" placeholder={`you@${business.school_domain}`}
                        value={campusEduEmail} onChange={e => setCampusEduEmail(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500"
                        style={{ background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : '#ddd6fe', color: dm ? '#f3f4f6' : '#171717' }} />
                      <button onClick={handleCampusSendCode}
                        disabled={campusSending || !campusEduEmail.endsWith(business.school_domain || '')}
                        className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                        style={{ background: '#7c3aed', color: 'white' }}>
                        {campusSending ? 'Sending…' : 'Send Code'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input type="text" placeholder="6-digit code" maxLength={6}
                        value={campusCode} onChange={e => setCampusCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="flex-1 px-3 py-2 text-sm rounded-xl border text-center tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                        style={{ background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : '#ddd6fe', color: dm ? '#f3f4f6' : '#171717' }} />
                      <button onClick={handleCampusVerify}
                        disabled={campusVerifying || campusCode.length !== 6}
                        className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                        style={{ background: '#7c3aed', color: 'white' }}>
                        {campusVerifying ? 'Verifying…' : 'Verify'}
                      </button>
                    </div>
                  )}
                  {campusVerifyError && <p className="text-xs text-red-500 mt-2">{campusVerifyError}</p>}
                </div>
              </div>
              <button onClick={() => setCampusBannerDismissed(true)} className="absolute top-3 right-3 h-6 w-6 rounded-full flex items-center justify-center" style={{ background: dm ? '#262626' : '#ede9fe', color: dm ? '#a78bfa' : '#7c3aed' }}>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}


          <main className="flex-1 px-6 py-7 max-w-[1320px] mx-auto w-full">
            {tab === 'overview' && !business?.school_domain && !business?.edu_verified && !campusAffilDismissed && (
              <div className="rounded-2xl border px-5 py-4 flex items-start justify-between gap-4" style={{ background: dm ? '#1c1c1e' : 'white', borderColor: dm ? '#2c2c2e' : '#e5e7eb' }}>
                <div>
                  <p className="text-sm font-bold" style={{ color: dm ? '#f2f2f7' : '#111' }}>Want to be affiliated with your campus?</p>
                  <p className="text-xs mt-1" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>Link your .edu email to appear on the campus marketplace.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowCampusModal(true)} className="text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: '#007e6d', color: 'white' }}>Add .edu</button>
                  <button onClick={() => setCampusAffilDismissed(true)} className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: dm ? '#262626' : '#f3f4f6', color: dm ? '#d4d4d8' : '#6b7280' }}>×</button>
                </div>
              </div>
            )}

            <div className="mb-7">
              <h1 className="text-[1.5rem] font-black" style={{ letterSpacing: '-0.025em', color: dm ? '#f2f2f7' : '#1c1c1e' }}>{NAV.find(n => n.id === tab)?.label}</h1>
              {tab === 'overview' && <p className="text-sm mt-0.5" style={{ color: dm ? '#8e8e93' : '#9ca3af' }}>Welcome back, {business?.owner_name?.split(' ')[0] || 'there'}</p>}
              {tab === 'bookings' && <p className="text-sm mt-0.5" style={{ color: dm ? '#8e8e93' : '#9ca3af' }}>{bookings.length} total · {pendingCount} pending</p>}
              {tab === 'clients' && <p className="text-sm mt-0.5" style={{ color: dm ? '#8e8e93' : '#9ca3af' }}>{clients.length} unique clients</p>}
            {tab === 'messages' && <p className="text-sm mt-0.5" style={{ color: dm ? '#8e8e93' : '#9ca3af' }}>{msgThreads.length} conversation{msgThreads.length !== 1 ? 's' : ''}</p>}
            </div>

            {/* Dismissed campus banner — show small indicator in overview */}
            {campusBannerDismissed && business?.school_domain && !business?.edu_verified && tab === 'overview' && (
              <button onClick={() => setCampusBannerDismissed(false)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg mb-4 self-start" style={{ background: dm ? 'rgba(139,92,246,0.12)' : '#f5f3ff', border: `1px solid ${dm ? 'rgba(139,92,246,0.2)' : '#ddd6fe'}` }}>
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <p className="text-xs font-semibold" style={{ color: dm ? '#c4b5fd' : '#6d28d9' }}>Campus verification pending — tap to complete</p>
              </button>
            )}

            {/* OVERVIEW */}
            {tab === 'overview' && (
              <div className="space-y-5">
                {(() => {
                  const platformFeeLabel = business?.founder50 ? 'after 6% platform fee (Founder50)' : 'after 12% platform fee';
                  const availabilityLabel = business?.availability_status === 'busy'
                    ? 'Busy'
                    : business?.availability_status === 'closed'
                      ? 'Closed'
                      : 'Open';
                  const availabilityTone = business?.availability_status === 'busy'
                    ? { bg: '#fff7ed', border: '#fdba74', text: '#c2410c', dot: '#f59e0b' }
                    : business?.availability_status === 'closed'
                      ? { bg: '#fff1f2', border: '#fda4af', text: '#be123c', dot: '#fb7185' }
                      : { bg: '#f0fdf4', border: '#a7f3d0', text: '#0f766e', dot: '#14b8a6' };
                  const overviewMetrics = [
                    {
                      label: 'Total Payout',
                      value: fmt(totalEarned),
                      sub: platformFeeLabel,
                      icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
                      color: '#14b8a6',
                    },
                    {
                      label: 'This Month',
                      value: fmt(thisMonthEarned),
                      sub: 'current month payout',
                      icon: 'M3 3v18h18M7.5 14.25l3-3 2.25 2.25L16.5 9',
                      color: '#0ea5a4',
                    },
                    {
                      label: 'Awaiting Payout',
                      value: fmt(awaitingReleaseAmount),
                      sub: 'paid bookings pending release',
                      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
                      color: '#0f766e',
                    },
                    {
                      label: 'Clients',
                      value: String(uniqueClients),
                      sub: `${completedCount} jobs completed`,
                      icon: 'M17 20h5v-1a4 4 0 00-5-3.87M9 20H4v-1a4 4 0 015-3.87m8-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 2a3 3 0 11-6 0 3 3 0 016 0zM6 10a3 3 0 11-6 0 3 3 0 016 0z',
                      color: '#2cb39b',
                    },
                  ];
                  return (
                    <div className="space-y-5">
                      <div className="rounded-[28px] border bg-white p-6 shadow-[0_10px_30px_rgba(32,136,122,0.05)]">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <h2 className="text-[2rem] font-black leading-none text-neutral-900" style={{ letterSpacing: '-0.04em' }}>
                              {business?.name || 'Your business'}
                            </h2>
                            <p className="mt-2 max-w-xl text-sm text-neutral-500">
                              Run your bookings, messages, services, and payouts from one place.
                            </p>
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              <span
                                className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold"
                                style={{ background: availabilityTone.bg, borderColor: availabilityTone.border, color: availabilityTone.text }}
                              >
                                <span className="h-2 w-2 rounded-full" style={{ background: availabilityTone.dot }} />
                                Status: {availabilityLabel}
                              </span>
                              {business?.edu_verified && campusLabel && (
                                <span
                                  className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold"
                                  style={{ background: 'rgba(0,126,109,0.10)', borderColor: 'rgba(0,126,109,0.22)', color: '#007e6d' }}
                                >
                                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 8.25L12 4.5l8.25 3.75L12 12 3.75 8.25z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 10.5V14c0 1.5 2.015 3 4.5 3s4.5-1.5 4.5-3v-3.5" />
                                  </svg>
                                  EDU verified provider: {campusLabel}
                                </span>
                              )}
                              {pendingCount > 0 && (
                                <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: 'rgba(0,126,109,0.18)', background: '#f5fbf8', color: '#0f766e' }}>
                                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                                  {pendingCount} booking{pendingCount !== 1 ? 's' : ''} need attention
                                </span>
                              )}
                              {totalUnreadMsgs > 0 && (
                                <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: '#d9d6fe', background: '#f5f3ff', color: '#6d28d9' }}>
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#8b5cf6' }} />
                                  {totalUnreadMsgs} unread message{totalUnreadMsgs !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setTab('edit');
                              }}
                              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                            >
                              Edit Listing
                            </button>
                            <button
                              type="button"
                              onClick={() => setTab('bookings')}
                              className="btn-primary rounded-full px-4 py-2 text-sm font-semibold text-white"
                            >
                              Open Bookings
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {overviewMetrics.map((s) => (
                          <div key={s.label} className="rounded-[24px] border bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]" style={{ borderColor: dm ? '#2c2c2e' : '#ebe1d3' }}>
                            <div className="h-10 w-10 rounded-2xl flex items-center justify-center mb-4" style={{ background: dm ? 'rgba(255,255,255,0.06)' : '#f3f8f6' }}>
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: s.color }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                              </svg>
                            </div>
                            <p className="text-[2rem] font-black leading-none text-neutral-900" style={{ letterSpacing: '-0.04em' }}>{s.value}</p>
                            <p className="mt-2 text-sm font-semibold text-neutral-900">{s.label}</p>
                            <p className="mt-1 text-xs text-neutral-500">{s.sub}</p>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.95fr]">
                        <div className="rounded-[28px] border bg-white p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h2 className="text-base font-bold text-neutral-900">Revenue</h2>
                              <p className="mt-1 text-xs text-neutral-500">Weekly revenue across your past 3 months.</p>
                            </div>
                          </div>
                          <div className="mt-5">
                            <RevenueChart bookings={bookings} dm={dm} />
                          </div>
                        </div>

                        <div className="provider-premium-panel rounded-[30px] border bg-white p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h2 className="text-base font-bold text-neutral-900">Publish Checklist</h2>
                              <p className="mt-1 text-xs text-neutral-500">Finish these launch blockers to publish your provider page.</p>
                            </div>
                            <span
                              className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
                              style={{ background: publishReady ? '#ecfdf5' : '#fff7ed', color: publishReady ? '#047857' : '#9a3412' }}
                            >
                              {publishReady ? 'Ready to Publish' : 'Incomplete'}
                            </span>
                          </div>
                          <div className="mt-5 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                            {[
                              { key: 'coreProfile', label: 'Core profile fields', hint: 'Business name, description, and contact details.' },
                              { key: 'services', label: 'At least one service', hint: 'Add your first offer so students can book.' },
                              { key: 'media', label: 'Photo or media uploaded', hint: 'Use real photos so the profile feels trustworthy.' },
                              { key: 'stripe', label: 'Stripe connected', hint: 'Connect payouts before you publish publicly.' },
                            ].map((item) => {
                              const ok = !!publishChecklist?.[item.key];
                              return (
                                <button
                                  key={item.key}
                                  type="button"
                                  onClick={() => !ok && jumpToPublishRequirement(item.key as 'coreProfile' | 'services' | 'media' | 'stripe')}
                                  className="rounded-[24px] border px-4 py-4 text-left transition-transform hover:-translate-y-0.5 disabled:cursor-default"
                                  disabled={ok}
                                  style={{ borderColor: ok ? '#b7e5ce' : '#f2d39a', background: ok ? '#eef9f3' : '#fff6e7' }}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-semibold" style={{ color: ok ? '#166534' : '#9a3412' }}>{item.label}</p>
                                      <p className="mt-1 text-[11px] leading-relaxed" style={{ color: ok ? '#3f6f58' : '#9a3412' }}>{item.hint}</p>
                                      {!ok && <p className="mt-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#d97706' }}>Open section →</p>}
                                    </div>
                                    <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: ok ? 'rgba(22,101,52,0.10)' : 'rgba(154,52,18,0.10)', color: ok ? '#166534' : '#9a3412' }}>
                                      {ok ? 'Done' : 'Needed'}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          <div className="mt-5 flex flex-wrap gap-2">
                            <button
                              onClick={() => handlePublish('publish')}
                              disabled={publishLoading || !publishReady}
                              className="btn-primary rounded-full px-4 py-2.5 text-sm disabled:opacity-50"
                            >
                              {publishLoading ? 'Updating…' : 'Publish Profile'}
                            </button>
                            <button
                              onClick={() => handlePublish('unpublish')}
                              disabled={publishLoading || !business?.public_visibility}
                              className="rounded-full border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 disabled:opacity-50"
                            >
                              Unpublish
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
                  <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-neutral-900">Recent Bookings</h2>
                    <button onClick={() => setTab('bookings')} className="text-xs font-semibold text-accent hover:opacity-70 transition-opacity">View all →</button>
                  </div>
                  {bookings.length === 0
                    ? <div className="px-5 py-10 text-center text-neutral-400 text-sm">No bookings yet.</div>
                    : <div className="divide-y divide-neutral-50">
                        {bookings.slice(0, 4).map(b => (
                          <div key={b.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-neutral-900 truncate">{b.profiles?.name || 'Customer'}</p>
                              <p className="text-xs text-neutral-400 mt-0.5 truncate">{b.service || 'Custom Request'} · {fmtDate(b.created_at)}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {b.amount_cents ? <span className="text-sm font-bold text-neutral-700">{fmt(b.amount_cents)}</span> : null}
                              <StatusBadge status={b.status} />
                            </div>
                          </div>
                        ))}
                      </div>
                  }
                </div>

                <div className="rounded-2xl border border-neutral-100 px-5 py-4 flex items-center justify-between gap-4" style={{ background: dm ? '#1c1c1e' : 'white' }}>
                  <div>
                    <p className="text-sm font-bold text-neutral-900">Payments and payouts</p>
                    <p className="text-xs mt-0.5" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                      Manage Stripe connection and payout details in Settings.
                    </p>
                  </div>
                  <button type="button" onClick={() => setTab('settings')} className="text-xs font-semibold px-3 py-2 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50">
                    Open Settings
                  </button>
                </div>
              </div>
            )}

            {/* BOOKINGS */}
            {tab === 'bookings' && (
              <div className="space-y-5">
                <div className="provider-segment-shell flex gap-2 flex-wrap">
                  {([
                    { key: 'all', label: 'All (' + bookings.length + ')' },
                    { key: 'pending', label: 'Pending (' + bookings.filter(b => isProviderPendingBooking(b)).length + ')' },
                    { key: 'disputed', label: 'Disputed (' + bookings.filter(b => isDisputedPricingFlow(b)).length + ')' },
                    { key: 'active', label: 'Active (' + bookings.filter(b => isActiveBookingFlow(b)).length + ')' },
                    { key: 'completed', label: 'Completed (' + bookings.filter(b => b.status === 'completed').length + ')' },
                    { key: 'cancelled', label: 'Cancelled (' + bookings.filter(b => b.status === 'cancelled').length + ')' },
                  ] as const).map(f => (
                    <button key={f.key} onClick={() => { setBkFilterTouched(true); setBkFilter(f.key); }}
                      className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all border ${bkFilter === f.key ? 'bg-accent text-white border-accent shadow-sm' : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300 hover:text-neutral-700'}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
                {filteredBookings.length === 0
                  ? <div className="provider-premium-panel bg-white rounded-[28px] border border-neutral-100 py-14 text-center text-neutral-400 text-sm">No bookings in this category.</div>
                  : <div className="space-y-3">
                      {filteredBookings.map((b, i) => {
                        const isCustom = isCustomPricingBooking(b);
                        const isPricingDisputedFlow = isDisputedPricingFlow(b);
                        const inferredProviderProposedCents =
                          b.provider_proposed_price_cents != null
                            ? b.provider_proposed_price_cents
                            : (
                              isPricingDisputedFlow
                              && b.customer_proposed_price_cents != null
                              && b.dispute_amount_cents != null
                              && b.dispute_amount_cents !== b.customer_proposed_price_cents
                            )
                              ? b.dispute_amount_cents
                              : null;
                        const waitingOnCustomerPriceDecision =
                          isPricingDisputedFlow
                          && inferredProviderProposedCents != null
                          && !b.price_accepted_by_customer;
                        const payoutFeeRate = business?.founder50 ? 0.06 : 0.12;
                        const providerNetPayoutCents = b.amount_cents ? Math.max(0, Math.round(b.amount_cents * (1 - payoutFeeRate))) : 0;
                        const scheduledSource = b.scheduled_start || b.scheduled_end || null;
                        const scheduledLabel = scheduledSource
                          ? (b.scheduled_exact ? fmtTime(scheduledSource) : fmtShortDate(scheduledSource))
                          : null;
                        const canComplete = canMarkComplete(b, business?.hours);
                        return (
                        <div key={b.id} className="provider-list-card bg-white rounded-[30px] border border-neutral-100 px-6 py-5">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                                {b.profiles?.avatar_url
                                  ? <img src={b.profiles.avatar_url} alt={b.profiles?.name || 'Customer'} className="h-full w-full object-cover" />
                                  : <span className="text-accent text-sm font-black">{(b.profiles?.name || '?').charAt(0).toUpperCase()}</span>
                                }
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold" style={{ color: dm ? '#f2f2f7' : '#1c1c1e' }}>{b.profiles?.name || 'Customer'}</p>
                                <p className="text-[12px] mt-0.5 line-clamp-1" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>{b.service || 'Custom Request'}</p>
                              </div>
                            </div>
                            <StatusBadge status={b.status} />
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3" style={{ color: dm ? '#636366' : '#8e978f' }}>
                            <span>{fmtTime(b.created_at)}</span>
                            {b.profiles?.phone && <span>{b.profiles.phone}</span>}
                            {b.profiles?.email && <span>{b.profiles.email}</span>}
                            {b.amount_cents && <span className="text-neutral-700 font-semibold">{fmt(b.amount_cents)}</span>}
                            {scheduledLabel && <span>{b.scheduled_exact ? 'Requested for ' : 'Due by '}{scheduledLabel}</span>}
                          </div>
                          {isCustom && b.customer_proposed_price_cents != null && (
                            <div className="mb-2 text-xs font-semibold" style={{ color: '#b45309' }}>
                              Customer proposed: {fmt(b.customer_proposed_price_cents)}
                            </div>
                          )}
                          {isPricingDisputedFlow && inferredProviderProposedCents != null && (
                            <div className="mb-2 text-xs font-semibold" style={{ color: '#0f766e' }}>
                              Your disputed price: {fmt(inferredProviderProposedCents)}
                            </div>
                          )}
                          {b.note && <p className="text-xs mb-3 leading-relaxed" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>Note: {b.note}</p>}
                          {isCustom && b.amount_cents && b.status !== 'price_disputed' && (
                            <div className="mb-3 rounded-xl border px-3 py-2 text-[11px]" style={{ borderColor: '#e5e7eb', background: '#f8fafc', color: '#374151' }}>
                              Your set price {fmt(b.amount_cents)}
                            </div>
                          )}
                          {isPricingDisputedFlow && waitingOnCustomerPriceDecision && (
                            <div className="mb-3 rounded-xl border px-3 py-2 text-[11px]" style={{ borderColor: '#cfe7de', background: '#f5fbf8', color: '#0f766e' }}>
                              <p className="mb-2">Waiting for customer response to your price {fmt(inferredProviderProposedCents ?? 0)}.</p>
                              {b.customer_proposed_price_cents != null && (
                                <button
                                  onClick={() => setConfirmAction({ booking: b, action: 'accept_price', priceCents: b.customer_proposed_price_cents })}
                                  className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white"
                                  style={{ background: '#0f766e' }}
                                >
                                  Accept customer price {fmt(b.customer_proposed_price_cents)}
                                </button>
                              )}
                            </div>
                          )}
                          {isPricingDisputedFlow && (b.customer_proposed_price_cents || b.dispute_amount_cents) && !b.price_accepted_by_provider && !waitingOnCustomerPriceDecision && (
                            <div className="mb-3 mt-2">
                              <div className="w-full max-w-xl rounded-2xl border px-4 py-3" style={{ borderColor: dm ? '#2c2c2e' : '#e5e7eb', background: dm ? '#111' : '#f9fafb' }}>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: dm ? '#6b7280' : '#9ca3af' }}>
                                  Resolve price
                                </div>
                                <div className="flex flex-col gap-2.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="rounded-xl border px-3 py-2 text-[11px]" style={{ borderColor: '#f4d9c7', background: '#fff9f4', color: '#b45309' }}>
                                      Customer proposed {fmt(b.customer_proposed_price_cents ?? b.dispute_amount_cents)}
                                    </div>
                                    <button
                                      onClick={() => setConfirmAction({ booking: b, action: 'accept_price', priceCents: b.customer_proposed_price_cents ?? b.dispute_amount_cents ?? 0 })}
                                      className="shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl bg-accent text-white hover:opacity-95 transition-colors">
                                      Accept price
                                    </button>
                                  </div>
                                  <div className="text-[10px] font-semibold uppercase text-neutral-400">or set your price</div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="w-24 flex items-center rounded-xl border overflow-hidden" style={{ borderColor: dm ? '#404040' : '#e5e7eb', background: dm ? '#0d0d0d' : 'white' }}>
                                      <span className="px-2.5 text-sm font-semibold" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>$</span>
                                      <input
                                        type="text" inputMode="numeric" placeholder="0.00"
                                        className="flex-1 py-1.5 pr-2 text-sm bg-transparent focus:outline-none"
                                        style={{ color: dm ? '#f2f2f7' : '#1c1c1e' }}
                                        value={bookingPrices[b.id] ? digitsToDollars(bookingPrices[b.id]) : (b.customer_proposed_price_cents ? (b.customer_proposed_price_cents / 100).toFixed(2) : (b.dispute_amount_cents ? (b.dispute_amount_cents / 100).toFixed(2) : (b.amount_cents ? (b.amount_cents / 100).toFixed(2) : '')))}
                                        onChange={e => setBookingPrices(p => ({ ...p, [b.id]: onlyDigits(e.target.value) }))}
                                      />
                                    </div>
                                    <button
                                      onClick={() => {
                                        const rawDigits = onlyDigits(bookingPrices[b.id] || '');
                                        const typedCents = rawDigits ? parseInt(rawDigits, 10) : 0;
                                        const fallbackCents = b.customer_proposed_price_cents ?? b.dispute_amount_cents ?? b.amount_cents ?? 0;
                                        const cents = typedCents > 0 ? typedCents : fallbackCents;
                                        if (cents < 500) { showToast('Minimum price is $5.00', false); return; }
                                        setConfirmAction({ booking: b, action: 'confirm', priceCents: cents });
                                      }}
                                      disabled={!bookingPrices[b.id] && !b.amount_cents && !b.customer_proposed_price_cents && !b.dispute_amount_cents}
                                      className="shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl h-9 bg-accent text-white disabled:opacity-40">
                                      Send Price
                                    </button>
                                    <button onClick={() => setConfirmAction({ booking: b, action: 'cancel' })} className="text-xs font-bold px-3.5 py-2 rounded-xl h-9" style={{ background: dm ? '#2c2c2e' : '#f5f5f5', color: dm ? '#8e8e93' : '#6b7280' }}>Cancel</button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          {b.status === 'price_disputed' && b.price_accepted_by_provider && b.customer_proposed_price_cents && (
                            <div className="mb-3 rounded-xl border px-3 py-2 text-[11px]" style={{ borderColor: '#bbf7d0', background: '#f0fdf4', color: '#166534' }}>
                              Set price accepted
                            </div>
                          )}
                          {b.status === 'price_disputed' && b.price_accepted_by_customer && b.provider_proposed_price_cents && (
                            <div className="mb-3 rounded-xl border px-3 py-2 text-[11px]" style={{ borderColor: '#bbf7d0', background: '#f0fdf4', color: '#166534' }}>
                              Customer accepted your price {fmt(b.provider_proposed_price_cents)}
                            </div>
                          )}
                          
                          {(['pending', 'confirmed', 'active', 'paid', 'payment_pending', 'price_disputed'].includes(b.status)) && (
                            <div className="flex items-start gap-2">
                              {/* Price setting — required before confirm */}
                              {(b.status === 'pending') && isCustom && (
                                <div className={`w-full ${b.status === 'price_disputed' && (b.customer_proposed_price_cents || b.dispute_amount_cents) && !b.price_accepted_by_provider ? 'hidden' : ''}`}>
                                  <div className="flex items-start gap-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => {
                                            const rawDigits = onlyDigits(bookingPrices[b.id] || '');
                                            const typedCents = rawDigits ? parseInt(rawDigits, 10) : 0;
                                            const fallbackCents = b.customer_proposed_price_cents ?? b.dispute_amount_cents ?? b.amount_cents ?? 0;
                                            const cents = typedCents > 0 ? typedCents : fallbackCents;
                                            if (cents < 500) { showToast('Minimum price is $5.00', false); return; }
                                            setConfirmAction({ booking: b, action: 'confirm', priceCents: cents });
                                          }}
                                          disabled={!bookingPrices[b.id] && !b.amount_cents && !b.customer_proposed_price_cents && !b.dispute_amount_cents}
                                          className="shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl h-9 bg-accent text-white disabled:opacity-40">
                                          {b.status === 'price_disputed' ? 'Send Price' : 'Confirm & Set Price'}
                                        </button>
                                        <span className="text-[10px] font-semibold uppercase text-neutral-400">or</span>
                                        <div className="w-32 flex items-center rounded-xl border overflow-hidden" style={{ borderColor: dm ? '#404040' : '#e5e7eb' }}>
                                          <span className="px-2.5 text-sm font-semibold" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>$</span>
                                          <input
                                            type="text" inputMode="numeric" placeholder="0.00"
                                            className="flex-1 py-1.5 pr-2 text-sm bg-transparent focus:outline-none"
                                            style={{ color: dm ? '#f2f2f7' : '#1c1c1e' }}
                                            value={bookingPrices[b.id] ? digitsToDollars(bookingPrices[b.id]) : (b.customer_proposed_price_cents ? (b.customer_proposed_price_cents / 100).toFixed(2) : (b.dispute_amount_cents ? (b.dispute_amount_cents / 100).toFixed(2) : (b.amount_cents ? (b.amount_cents / 100).toFixed(2) : '')))}
                                            onChange={e => setBookingPrices(p => ({ ...p, [b.id]: onlyDigits(e.target.value) }))}
                                          />
                                        </div>
                                        {!!(b.customer_proposed_price_cents || b.dispute_amount_cents) && (
                                        <button
                                          onClick={() => {
                                            const rawDigits = onlyDigits(bookingPrices[b.id] || '');
                                            const typedCents = rawDigits ? parseInt(rawDigits, 10) : 0;
                                            const fallbackCents = b.customer_proposed_price_cents ?? b.dispute_amount_cents ?? b.amount_cents ?? 0;
                                            const cents = typedCents > 0 ? typedCents : fallbackCents;
                                            if (cents < 500) { showToast('Minimum price is $5.00', false); return; }
                                            setConfirmAction({ booking: b, action: 'dispute', priceCents: cents });
                                          }}
                                          disabled={!bookingPrices[b.id] && !b.amount_cents && !b.customer_proposed_price_cents && !b.dispute_amount_cents}
                                          className="shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl h-9 disabled:opacity-40"
                                          style={{ background: '#fff7ed', border: '1px solid #f4d9c7', color: '#b45309' }}>
                                          Dispute price
                                        </button>
                                        )}
                                      </div>
                                      <p className="text-[10px] mt-1" style={{ color: dm ? '#636366' : '#9ca3af' }}>Set the price — customer will be prompted to pay after confirmation</p>
                                    </div>
                                    <button
                                      onClick={() => setConfirmAction({ booking: b, action: 'cancel' })}
                                      className="text-xs font-bold px-3.5 py-2 rounded-xl h-9"
                                      style={{ background: dm ? '#2c2c2e' : '#f5f5f5', color: dm ? '#8e8e93' : '#6b7280' }}>
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                              {b.status === 'pending' && !isCustom && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setConfirmAction({ booking: b, action: 'confirm' })}
                                    className="shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl bg-accent text-white">
                                    Confirm booking
                                  </button>
                                  <p className="text-[10px]" style={{ color: dm ? '#636366' : '#9ca3af' }}>No price required — standard service</p>
                                </div>
                              )}
                              {b.status === 'confirmed' && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setConfirmComplete(b)}
                                    disabled={!canComplete}
                                    title={!canComplete && b.scheduled_start ? `Available after ${fmtTime(b.scheduled_start)}` : 'Mark booking complete'}
                                    className="text-xs font-bold px-3.5 py-2 rounded-xl text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ background: '#007e6d' }}>
                                    Mark Complete
                                  </button>
                                  {b.paid_at && (
                                    <span className="text-xs font-bold px-1" style={{ color: '#007e6d' }}>
                                      ✓ Payment secured
                                      {providerNetPayoutCents > 0 ? ` · est. payout ${fmt(providerNetPayoutCents)}` : ''}
                                    </span>
                                  )}
                                </div>
                              )}
                              {b.status === 'paid' && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setConfirmAction({ booking: b, action: 'confirm' })}
                                    className="shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl bg-accent text-white">
                                    Accept booking
                                  </button>
                                  <span className="text-xs font-bold px-1" style={{ color: '#007e6d' }}>
                                    ✓ Payment secured
                                    {providerNetPayoutCents > 0 ? ` · est. payout ${fmt(providerNetPayoutCents)}` : ''}
                                  </span>
                                </div>
                              )}
                              {b.status !== 'confirmed' && b.status !== 'paid' && b.paid_at && (
                                <span className="text-xs font-bold px-1" style={{ color: '#007e6d' }}>
                                  ✓ Payment secured
                                  {providerNetPayoutCents > 0 ? ` · est. payout ${fmt(providerNetPayoutCents)}` : ''}
                                </span>
                              )}
                              {(b.status !== 'price_disputed' || !isCustom) && !(b.status === 'pending' && isCustom) && (
                                <button
                                  onClick={() => setConfirmAction({ booking: b, action: 'cancel' })}
                                  className="text-xs font-bold px-3.5 py-2 rounded-xl h-9 ml-auto"
                                  style={{ background: dm ? '#2c2c2e' : '#f5f5f5', color: dm ? '#8e8e93' : '#6b7280' }}>
                                  Cancel
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                }
              </div>
            )}

            {/* MESSAGES */}
            {tab === 'messages' && (
              <div className="flex gap-4" style={{ height: 'calc(100vh - 280px)', minHeight: 500 }}>
                {/* Thread list */}
                <div className={`${activeMsgThread ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-80 shrink-0 rounded-2xl border overflow-hidden`} style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#f5f5f5' }}>
                  <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: dm ? '#262626' : '#f5f5f5' }}>
                    <p className="text-xs font-black uppercase tracking-[0.1em]" style={{ color: dm ? 'rgba(255,255,255,0.4)' : '#a3a3a3' }}>{msgThreads.length} client thread{msgThreads.length !== 1 ? 's' : ''}</p>
                    {totalUnreadMsgs > 0 && <span className="text-[10px] font-black bg-accent text-white px-2 py-0.5 rounded-full">{totalUnreadMsgs} unread</span>}
                  </div>
                  <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                    {loading ? (
                    <div>
                      {Array.from({ length: 4 }).map((_, i) => <SkeletonThread key={i} dm={dm} />)}
                    </div>
                    ) : msgThreads.length === 0 ? (
                      <div className="p-6 text-center text-neutral-400 text-sm">No conversations yet.</div>
                    ) : msgThreads.map((t: any) => (
                      <button key={t.id} onClick={async () => {
                        if (activeMsgThread?.id === t.id) return;
                        setActiveMsgThread(t);
                        setThreadMessages([]);
                        const authHeaders = await getAuthHeaders();
                        const url = threadMessagesUrl(t, business?.id);
                        if (!url) return;
                        const res = await fetch(url, { headers: authHeaders });
                        if (res.ok) { const d = await res.json(); setThreadMessages(d.messages || []); if (d.thread) setActiveMsgThread((t: any) => t ? { ...t, ...d.thread } : t); }
                        if (t.unreadCount > 0) {
                          const ids = t.booking_ids || (t.booking_id ? [t.booking_id] : []);
                          await Promise.all(ids.map((bid: string) =>
                            fetch('/api/messages', { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ booking_id: bid, reader_type: 'business' }) })
                          ));
                          setMsgThreads((ts: any[]) => ts.map((x: any) => x.id === t.id ? { ...x, unreadCount: 0 } : x));
                        }
                        setTimeout(() => msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                      }}
                        className="w-full text-left px-4 py-3.5 border-b transition-colors" style={{ borderColor: dm ? '#1e1e1e' : '#fafafa', background: activeMsgThread?.id === t.id ? (dm ? '#1e2130' : '#eff6ff') : 'transparent' }}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                              {t.profiles?.avatar_url
                                ? <img src={t.profiles.avatar_url} alt={t.profiles?.name || 'Customer'} className="h-full w-full object-cover" />
                                : <span className="text-accent text-[10px] font-black">{(t.profiles?.name || 'U').charAt(0).toUpperCase()}</span>
                              }
                            </div>
                            <p className="text-sm font-bold truncate" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{t.profiles?.name || 'Customer'}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {t.unreadCount > 0 && <span className="h-4 w-4 rounded-full bg-accent flex items-center justify-center text-[9px] font-black text-white">{t.unreadCount}</span>}
                            {t.lastMessage && <span className="text-[10px] text-neutral-400">{fmtShortDate(t.lastMessage.created_at)}</span>}
                          </div>
                        </div>
                        <p className="text-[11px] truncate mb-0.5 pl-9" style={{ color: dm ? '#9ca3af' : '#737373' }}>
                          {(t.booking_ids?.length || 1)} booking{(t.booking_ids?.length || 1) === 1 ? '' : 's'} · {t.service || 'Conversation'}
                        </p>
                        {t.lastMessage
                          ? <p className={`text-[11px] truncate pl-9 ${t.unreadCount > 0 ? 'font-semibold text-neutral-700' : 'text-neutral-400'}`}>
                              {t.lastMessage.sender_type === 'business' ? 'You: ' : ''}
                              {t.lastMessage.image_url ? (t.lastMessage.content || 'Photo') : t.lastMessage.content}
                            </p>
                          : <p className="text-[11px] text-neutral-300 italic pl-9">No messages yet</p>
                        }
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active thread */}
                {activeMsgThread ? (
                  <div className="flex-1 flex flex-col rounded-2xl border overflow-hidden" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#f5f5f5' }}>
                    {/* Header — customer + booking info */}
                    <div className="px-5 py-3.5 border-b" style={{ borderColor: dm ? '#262626' : '#f5f5f5' }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <button onClick={() => setActiveMsgThread(null)} className="lg:hidden p-1.5 rounded-lg hover:bg-neutral-100 mr-1 shrink-0">
                            <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                          </button>
                          <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                            {activeMsgThread.profiles?.avatar_url
                              ? <img src={activeMsgThread.profiles.avatar_url} alt={activeMsgThread.profiles?.name || 'Customer'} className="h-full w-full object-cover" />
                              : <span className="text-accent font-black text-sm">{(activeMsgThread.profiles?.name || 'U').charAt(0).toUpperCase()}</span>
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold" style={{ color: dm ? '#f3f4f6' : '#171717' }}>{activeMsgThread.profiles?.name || 'Customer'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {activeMsgThread.profiles?.phone && (
                            <a href={`tel:${activeMsgThread.profiles.phone}`} className="text-xs font-semibold text-accent bg-[#f5fbf8] px-3 py-1.5 rounded-xl border border-accent/15 hover:bg-[#edf8f4] transition-colors flex items-center gap-1.5">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                              {activeMsgThread.profiles.phone}
                            </a>
                          )}
                          {activeCustomerId && (
                            <button
                              onClick={toggleBlockCustomer}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${isCustomerBlocked ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'}`}>
                              {isCustomerBlocked ? 'Unblock' : 'Block'}
                            </button>
                          )}
                          <button onClick={() => setTab('bookings')} className="text-xs font-semibold text-neutral-500 bg-neutral-50 px-3 py-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 transition-colors">
                            View booking
                          </button>
                        </div>
                      </div>
                      {/* Booking summary strip */}
                      <div className="mt-3 flex items-center gap-3 px-3 py-2 rounded-xl border" style={{ background: dm ? '#0d0d0d' : '#fafafa', borderColor: dm ? '#262626' : '#f5f5f5' }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-neutral-700 truncate">{activeMsgThread.service}</p>
                          <p className="text-[10px] text-neutral-400 mt-0.5">{fmtDate(activeMsgThread.created_at)}</p>
                        </div>
                        <StatusBadge status={activeMsgThread.status} />
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ scrollbarWidth: 'none', background: dm ? '#0d0d0d' : '#f8fafc' }}>
                      {threadMessages.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-sm text-neutral-400">No messages yet.</p>
                          <p className="text-xs text-neutral-300 mt-1">Send a message to start the conversation.</p>
                        </div>
                      )}
                      {threadMessages.map((msg: any, i: number) => {
                        const isBiz = msg.sender_type === 'business';
                        const hasImage = Boolean(msg.image_url);
                        const hasText = Boolean(msg.content);
                        const currentMsgTime = safeDate(msg.created_at)?.getTime() ?? 0;
                        const prevMsgTime = i > 0 ? (safeDate(threadMessages[i - 1]?.created_at)?.getTime() ?? 0) : 0;
                        const showTime = i === 0 || (currentMsgTime > 0 && prevMsgTime > 0 && currentMsgTime - prevMsgTime > 300000);
                        return (
                          <div key={msg.id}>
                            {showTime && <p className="text-center text-[10px] text-neutral-400 py-1">{fmtClockTime(msg.created_at)}</p>}
                            <div className={`flex ${isBiz ? 'justify-end' : 'justify-start'}`}>
                              {hasImage && !hasText ? (
                                <button
                                  onClick={() => setMsgLightboxUrl(msg.image_url as string)}
                                  className="max-w-[75%] rounded-2xl overflow-hidden focus:outline-none"
                                  title="View image"
                                >
                                  <img src={msg.image_url as string} alt="Message attachment" className="rounded-2xl max-h-64 object-cover" />
                                </button>
                              ) : (
                                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isBiz ? 'bg-accent text-white rounded-br-md' : (dm ? 'bg-neutral-800 text-neutral-100 border border-neutral-700 rounded-bl-md' : 'bg-white text-neutral-800 border border-neutral-200 rounded-bl-md')}`}>
                                  {hasImage && (
                                    <button
                                      onClick={() => setMsgLightboxUrl(msg.image_url as string)}
                                      className="mb-2 block rounded-lg overflow-hidden"
                                      title="View image"
                                    >
                                      <img
                                        src={msg.image_url as string}
                                        alt="Message attachment"
                                        className="rounded-lg max-h-64 object-cover"
                                      />
                                    </button>
                                  )}
                                  {msg.content}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={msgBottomRef} />
                    </div>
                    {msgLightboxUrl && (
                      <div
                        className="fixed inset-0 z-[1200] flex items-center justify-center px-4"
                        style={{ background: 'rgba(0,0,0,0.8)' }}
                        onClick={() => setMsgLightboxUrl(null)}
                      >
                        <img src={msgLightboxUrl} alt="Full size" className="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-2xl" />
                      </div>
                    )}

                    {/* Input */}
                    <div className="px-4 py-3 border-t" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#f5f5f5' }}>
                      {pendingMsgPreview && (
                        <div className="mb-3 rounded-xl border p-2 flex items-center gap-3"
                          style={{ borderColor: dm ? '#262626' : '#e5e7eb', background: dm ? '#0d0d0d' : '#f8fafc' }}>
                          <img src={pendingMsgPreview} alt="Attachment preview" className="h-14 w-14 rounded-lg object-cover" />
                          <div className="flex-1">
                            <p className="text-xs font-semibold" style={{ color: dm ? '#e5e7eb' : '#111' }}>Image ready to send</p>
                            <p className="text-[11px]" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>Send now or remove.</p>
                          </div>
                          <button
                            onClick={clearPendingBizImage}
                            className="h-8 w-8 rounded-full flex items-center justify-center"
                            style={{ background: dm ? '#1f2937' : '#eef2f7', color: dm ? '#d1d5db' : '#64748b' }}
                            title="Remove image"
                          >
                            ×
                          </button>
                        </div>
                      )}
                      <div className="flex items-end gap-2">
                        <input
                          ref={msgFileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) attachBizImage(file);
                          }}
                        />
                        <button
                          type="button"
                          disabled={isCustomerBlocked || uploadingMsgImage}
                          onClick={() => msgFileInputRef.current?.click()}
                          className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-all border"
                          style={{ background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : '#e5e5e5', opacity: (isCustomerBlocked || uploadingMsgImage) ? 0.4 : 1 }}>
                          <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75V6.75a4.5 4.5 0 10-9 0v9a3.75 3.75 0 007.5 0V8.25a2.25 2.25 0 00-4.5 0v7.5" /></svg>
                        </button>
                        <textarea
                          ref={msgInputRef}
                          value={msgInput}
                          onChange={e => setMsgInput(e.target.value)}
                          onKeyDown={async e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              await sendBizMessage(msgInput);
                            }
                          }}
                          placeholder={isCustomerBlocked ? 'Messaging is blocked for this customer.' : `Reply to ${activeMsgThread.profiles?.name || 'customer'}…`}
                          rows={1}
                          disabled={isCustomerBlocked}
                          className="flex-1 resize-none rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all leading-relaxed"
                          style={{ maxHeight: 100, background: dm ? '#0d0d0d' : 'white', borderColor: dm ? '#262626' : '#e5e5e5', color: dm ? '#f3f4f6' : '#171717' }}
                        />
                        <button
                          disabled={isCustomerBlocked || (!msgInput.trim() && !pendingMsgPreview) || uploadingMsgImage || msgSending}
                          onClick={async () => {
                            await sendBizMessage(msgInput);
                          }}
                          className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
                          style={{ background: (msgInput.trim() || pendingMsgPreview) ? '#007e6d' : '#e5e7eb' }}>
                          {uploadingMsgImage ? (
                            <div className="h-4 w-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
                          ) : (
                            <svg className={`h-4 w-4 ${msgInput.trim() || pendingMsgPreview ? 'text-white' : 'text-neutral-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                            </svg>
                          )}
                        </button>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-1.5 px-1">↵ to send · Shift+↵ for new line</p>
                    </div>
                  </div>
                ) : (
                  <div className="hidden lg:flex flex-1 items-center justify-center rounded-2xl border" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#262626' : '#f5f5f5' }}>
                    <div className="text-center">
                      <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                        <svg className="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
                      </div>
                      <p className="text-sm font-semibold" style={{ color: dm ? '#9ca3af' : '#525252' }}>Select a conversation</p>
                      <p className="text-xs mt-1" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>Choose a customer thread to reply</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CLIENTS */}
            {tab === 'clients' && (
              <div className="space-y-4">
                {clients.length === 0
                  ? <div className="provider-premium-panel bg-white rounded-[28px] border border-neutral-100 py-14 text-center text-neutral-400 text-sm">No clients yet.</div>
                  : clients.map(c => {
                      const linkedThread = msgThreads.find((t: any) => {
                        const threadEmail = String(t?.profiles?.email || '').toLowerCase();
                        return threadEmail && threadEmail === String(c.email || '').toLowerCase();
                      });
                      const userId = c.id || linkedThread?.profiles?.id || linkedThread?.customer_id;
                      const avatarUrl = c.avatar_url || linkedThread?.profiles?.avatar_url;
                      const isBlocked = userId ? !!blockedCustomers[userId] : false;
                      const cb = bookings.filter(b => b.profiles?.email === c.email && isActiveOrCompleted(b));
                      return (
                        <div key={c.email} className="provider-list-card bg-white rounded-[30px] border border-neutral-100 px-6 py-5">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                                {avatarUrl
                                  ? <img src={avatarUrl} alt={c.name} className="h-full w-full object-cover" />
                                  : <span className="text-accent font-black text-sm">{c.name.charAt(0).toUpperCase()}</span>
                                }
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-neutral-900">{c.name || 'Customer'}</p>
                                {c.phone && <p className="text-xs text-neutral-400">{c.phone}</p>}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-black text-neutral-900">{fmt(c.totalSpent)}</p>
                              <p className="text-xs text-neutral-400">{c.bookingCount} booking{c.bookingCount !== 1 ? 's' : ''}</p>
                              <p className="text-[10px] text-neutral-300 mt-0.5">Last: {fmtDate(c.lastBooking)}</p>
                            </div>
                          </div>
                          {cb.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {cb.slice(0, 3).map(b => (
                                <span key={b.id} className="text-[10px] bg-white border px-2.5 py-1 rounded-full font-semibold" style={{ borderColor: '#bfe5db', color: '#0f766e' }}>
                                  {b.service.length > 32 ? b.service.slice(0, 32) + '…' : b.service}
                                </span>
                              ))}
                              {cb.length > 3 && <span className="text-[10px] text-neutral-400 py-1">+{cb.length - 3} more</span>}
                            </div>
                          )}
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              onClick={() => {
                                if (userId) {
                                  openCustomerThread(userId);
                                  return;
                                }
                                if (c.email) openCustomerThreadByEmail(c.email);
                              }}
                              disabled={!userId && !linkedThread}
                              className="text-xs font-semibold px-3.5 py-2 rounded-xl border text-white transition-colors disabled:opacity-40"
                              style={{ borderColor: '#007e6d', background: '#007e6d' }}>
                              Message
                            </button>
                            <button
                              onClick={() => {
                                if (!userId) return;
                                if (isBlocked) {
                                  applyBlock(userId, false, []);
                                } else {
                                  const bookingIds = getBookingIdsForUser(userId);
                                  setBlockConfirm({ userId, name: c.name || c.email, bookingIds });
                                }
                              }}
                              disabled={!userId}
                              className={`text-xs font-semibold px-3.5 py-2 rounded-xl border transition-colors disabled:opacity-40 ${isBlocked ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}>
                              {isBlocked ? 'Unblock' : 'Block'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                }
              </div>
            )}

            {/* CALENDAR — interactive grid + daily list */}
            {tab === 'calendar' && (
              <div className="space-y-5">
                {/* Calendar */}
                <div className="provider-premium-panel bg-white rounded-[30px] border border-neutral-100 p-6 w-full">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Previous month"
                        onClick={() => setCalendarMonthOffset(v => v - 1)}
                        className="h-8 w-8 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 transition-colors"
                      >
                        ‹
                      </button>
                      <h2 className="text-base font-black text-neutral-900 min-w-[150px] text-center">{calendarMonthLabel}</h2>
                      <button
                        type="button"
                        aria-label="Next month"
                        onClick={() => setCalendarMonthOffset(v => v + 1)}
                        className="h-8 w-8 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 transition-colors"
                      >
                        ›
                      </button>
                    </div>
                    <span className="text-xs text-neutral-400 bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-100">{bookingDates.size} days</span>
                  </div>
                  <div className="grid grid-cols-7 mb-2">
                    {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className="text-center text-[11px] font-bold text-neutral-400 py-0.5">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: firstDay }).map((_, i) => <div key={'e'+i} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const isToday = isViewingCurrentMonth && day === today.getDate();
                      const isSelected = calendarDay === day;
                      const count = bookingDates.get(day) || 0;
                      const cellDate = new Date(calendarYear, calendarMonth, day);
                      const hasHours = hasBusinessHoursOnDate(business?.hours, cellDate);
                      const dayBookings = bookings.filter(b => {
                        if (b.status === 'cancelled') return false;
                        const d = b.scheduled_start ? new Date(b.scheduled_start) : new Date(b.created_at);
                        return d.getDate() === day && d.getMonth() === calendarMonth && d.getFullYear() === calendarYear;
                      });
                      return (
                        <button
                          key={day}
                          type="button"
                          title={count > 0 ? dayBookings.map(b => b.profiles?.name || 'Customer').join(', ') : ''}
                          onClick={() => hasHours && setCalendarDay(isSelected ? null : day)}
                          className={`h-11 rounded-xl text-[12px] relative transition-all duration-200 flex items-center justify-center ${
                            !hasHours ? 'text-neutral-300 cursor-not-allowed' :
                            isSelected ? 'bg-accent text-white font-black shadow-md' :
                            isToday ? 'bg-accent/10 text-accent font-bold' :
                            count > 0 ? 'bg-[#f5fbf8] text-accent font-bold ring-1 ring-[#cfe7de] hover:bg-[#edf8f4]' :
                            'text-neutral-900 hover:bg-[#fbf8f2]'
                          }`}
                        >
                          {day}
                          {count > 0 && !isSelected && (
                            <span
                              className="absolute -top-1.5 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center"
                              style={hasHours
                                ? { background: isToday ? '#007e6d' : '#e6f4ef', color: isToday ? 'white' : '#0f766e' }
                                : { background: '#f3f4f6', color: '#9ca3af' }}
                            >
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center gap-4 text-[10px] text-neutral-400">
                    <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-accent" />Today</div>
                    <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-[#d7efe8]" />Has bookings</div>
                  </div>
                </div>

                {/* Booking list */}
                <div className="provider-premium-panel bg-white rounded-[30px] border border-neutral-100 overflow-hidden w-full">
                  <div className="px-5 py-4 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-neutral-900">
                        {calendarDay ? `Schedule for ${calendarBase.toLocaleDateString('en-US', { month: 'short' })} ${calendarDay}` : `Scheduled in ${calendarBase.toLocaleDateString('en-US', { month: 'short' })}`}
                      </h2>
                      <p className="text-[11px] text-neutral-400 mt-0.5">Click a day to filter this list.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-400">{bookings.filter(b => b.status === 'pending' || b.status === 'confirmed').length} active</span>
                      <button
                        onClick={() => downloadIcsBatch('scheduleme-calendar.ics', calendarEvents)}
                        disabled={calendarEvents.length === 0}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[#f5fbf8] text-accent border border-[#cfe7de] disabled:opacity-40">
                        Export calendar
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const list = bookings
                      .filter(b => b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'paid')
                      .filter(b => {
                        const d = b.scheduled_start ? new Date(b.scheduled_start) : new Date(b.created_at);
                        if (d.getMonth() !== calendarMonth || d.getFullYear() !== calendarYear) return false;
                        if (!calendarDay) return true;
                        return d.getDate() === calendarDay;
                      });
                    if (list.length === 0) {
                      return <div className="px-5 py-10 text-center text-neutral-400 text-sm">No bookings for this day.</div>;
                    }
                    return (
                      <div className="divide-y divide-neutral-50 overflow-y-auto" style={{ maxHeight: 520 }}>
                        {list.map(b => {
                          const bookingDay = b.scheduled_start ? new Date(b.scheduled_start) : new Date(b.created_at);
                          const canComplete = canMarkComplete(b, business?.hours);
                          const isCustomBooking = isCustomPricingBooking(b);
                          return (
                            <div key={b.id} className="px-5 py-4">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-start gap-3 min-w-0">
                                  <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                                    {b.profiles?.avatar_url
                                      ? <img src={b.profiles.avatar_url} alt={b.profiles?.name || 'Customer'} className="h-full w-full object-cover" />
                                      : <span className="text-accent text-xs font-black">{(b.profiles?.name || '?').charAt(0).toUpperCase()}</span>
                                    }
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold" style={{ color: dm ? '#f2f2f7' : '#1c1c1e' }}>{b.profiles?.name || 'Customer'}</p>
                                    <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-1">{b.service || 'Custom Request'}</p>
                                  </div>
                                </div>
                                <StatusBadge status={b.status} />
                              </div>
                              <div className="flex items-center gap-3 pl-11 text-[10px] text-neutral-400">
                                <span>{bookingDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}</span>
                                {b.profiles?.phone && <span>{b.profiles.phone}</span>}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 pl-11 mt-2 text-[10px]">
                                {b.scheduled_start && (
                                  <span className="font-semibold" style={{ color: '#007e6d' }}>
                                    Scheduled
                                  </span>
                                )}
                                {b.scheduled_start && (
                                  <span className="text-neutral-400">
                                    {fmtShortDate(b.scheduled_start)} {fmtClockTime(b.scheduled_start)}
                                  </span>
                                )}
                              </div>
                              {(b.status === 'pending' || b.status === 'confirmed') && (
                                <div className="flex gap-1.5 mt-2.5 pl-11">
                                  <button
                                    onClick={() => setConfirmComplete(b)}
                                    disabled={!canComplete}
                                    title={!canComplete && b.scheduled_start ? `Available after ${fmtTime(b.scheduled_start)}` : 'Mark booking complete'}
                                    className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ background: '#007e6d' }}>
                                    Complete
                                  </button>
                                  {b.status === 'pending' && isCustomBooking && (
                                    <button onClick={() => handleUpdateBooking(b.id, 'confirmed')}
                                      className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-[#f5fbf8] text-accent border border-[#cfe7de] hover:bg-[#edf8f4] transition-colors">
                                      Confirm
                                    </button>
                                  )}
                                  <button onClick={() => handleUpdateBooking(b.id, 'cancelled')}
                                    className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-neutral-100 text-neutral-500 border border-neutral-200 hover:bg-neutral-200 transition-colors ml-auto">
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* MESSAGES */}
            {/* SETTINGS */}
            {tab === 'services' && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
              <div className="space-y-5">
                <div className="provider-premium-panel rounded-[30px] p-6" style={{ background: dm ? '#1c1c1e' : 'white', border: '1px solid ' + (dm ? '#2c2c2e' : '#f0f0f0') }}>
                  <h3 className="font-bold text-base mb-4" style={{ color: dm ? '#f2f2f7' : '#111' }}>Add Service</h3>
                  <div className="flex flex-col gap-3">
                    <div className="relative">
                        <input value={svcName} maxLength={60} onChange={e => setSvcName(e.target.value)} placeholder="Service name (e.g. Haircut, Oil Change)" className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: dm ? '#2c2c2e' : '#ffffff', color: dm ? '#f2f2f7' : '#111', border: '1px solid ' + (dm ? '#3c3c3e' : '#e5e7eb') }} />
                      <span className="absolute bottom-2 right-3 text-[10px]" style={{ color: dm ? '#9ca3af' : '#9ca3af' }}>{svcName.length}/60</span>
                    </div>
                    <div className="relative">
                        <textarea value={svcDesc} maxLength={300} onChange={e => setSvcDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none" style={{ background: dm ? '#2c2c2e' : '#ffffff', color: dm ? '#f2f2f7' : '#111', border: '1px solid ' + (dm ? '#3c3c3e' : '#e5e7eb') }} />
                      <span className="absolute bottom-2 right-3 text-[10px]" style={{ color: dm ? '#9ca3af' : '#9ca3af' }}>{svcDesc.length}/300</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold mb-1 block" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>Price ($)</label>
                        <div className="flex items-center rounded-2xl border px-3 py-3" style={{ background: dm ? '#2c2c2e' : '#ffffff', color: dm ? '#f2f2f7' : '#111', border: '1px solid ' + (dm ? '#3c3c3e' : '#e5e7eb') }}>
                          <span className="text-sm font-semibold" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={digitsToDollars(svcPrice)}
                            onChange={e => setSvcPrice(onlyDigits(e.target.value))}
                            placeholder="0.00"
                            className="flex-1 ml-2 text-sm outline-none bg-transparent"
                            style={{ color: dm ? '#f2f2f7' : '#111' }}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold mb-1 block" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>Duration (min)</label>
                        <input type="number" min="5" step="5" value={svcDuration} onChange={e => setSvcDuration(e.target.value)} placeholder="60" className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: dm ? '#2c2c2e' : '#ffffff', color: dm ? '#f2f2f7' : '#111', border: '1px solid ' + (dm ? '#3c3c3e' : '#e5e7eb') }} />
                      </div>
                    </div>
                    <label className="flex items-center justify-between rounded-2xl border px-4 py-3 text-xs font-semibold" style={{ borderColor: dm ? '#2c2c2e' : '#cfe7de', color: dm ? '#e5e7eb' : '#0f766e', background: dm ? '#111' : '#f5fbf8' }}>
                      Requires exact time
                      <input type="checkbox" checked={svcRequiresTime} onChange={e => setSvcRequiresTime(e.target.checked)} className="h-5 w-5 rounded-full accent-[#007e6d]" />
                    </label>
                    {svcError && <p className="text-red-500 text-sm">{svcError}</p>}
                    <button onClick={handleAddService} disabled={svcSaving} className="w-full py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: svcSaving ? '#9ca3af' : '#007e6d' }}>{svcSaving ? 'Adding...' : '+ Add Service'}</button>
                  </div>
                </div>
                <div className="provider-premium-panel rounded-[30px] overflow-hidden self-start" style={{ background: dm ? '#1c1c1e' : 'white', border: '1px solid ' + (dm ? '#2c2c2e' : '#f0f0f0') }}>
                <div className="px-5 py-4" style={{ borderBottom: '1px solid ' + (dm ? '#2c2c2e' : '#f0f0f0') }}>
                  <h3 className="font-bold text-base" style={{ color: dm ? '#f2f2f7' : '#111' }}>Your Services ({services.length})</h3>
                </div>
                {svcLoading ? <div className="p-6 text-center text-sm" style={{ color: dm ? '#8e8e93' : '#9ca3af' }}>Loading...</div>
                : services.length === 0 ? <div className="p-6 text-center text-sm" style={{ color: dm ? '#8e8e93' : '#9ca3af' }}>No services yet — add your first one above</div>
                : <div>{services.map(svc => (
                    <div key={svc.id} className="px-5 py-4 flex items-center justify-between gap-3 provider-service-row" style={{ borderBottom: '1px solid ' + (dm ? '#2c2c2e' : '#f0f0f0') }}>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm" style={{ color: dm ? '#f2f2f7' : '#111' }}>{svc.name}</p>
                        {svc.description && <p className="text-xs mt-0.5" style={{ color: dm ? '#8e8e93' : '#9ca3af' }}>{svc.description}</p>}
                        <p className="text-xs mt-1" style={{ color: dm ? '#8e8e93' : '#9ca3af' }}>
                          {svc.duration_min} min · {svc.requires_time === false ? 'No exact time' : 'Exact time'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-bold text-[15px]" style={{ color: '#007e6d' }}>{'$'}{(svc.price_cents/100).toFixed(2)}</span>
                        <button
                          onClick={() => handleUpdateService(svc.id, { requires_time: svc.requires_time === false ? true : false })}
                          className="text-[11px] font-bold px-3 py-1.5 rounded-full border"
                          style={{ borderColor: dm ? '#2c2c2e' : '#cfe7de', color: dm ? '#e5e7eb' : '#0f766e', background: dm ? '#111' : '#f5fbf8' }}
                          title={svc.requires_time === false ? 'Enable exact time' : 'Disable exact time'}
                        >
                          {svc.requires_time === false ? 'Enable time' : 'No time'}
                        </button>
                        <button onClick={() => handleDeleteService(svc.id)} className="w-7 h-7 flex items-center justify-center rounded-full" style={{ color: '#ef4444' }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}</div>}
              </div>
              </div>
              <div className="space-y-5">
                <div className="provider-premium-panel rounded-[30px] p-6" style={{ background: dm ? '#1c1c1e' : 'white', border: '1px solid ' + (dm ? '#2c2c2e' : '#f0f0f0') }}>
                  <h3 className="font-bold text-base mb-4" style={{ color: dm ? '#f2f2f7' : '#111' }}>Availability</h3>
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    {[
                      { key: 'open', label: 'Open', activeBg: '#007e6d', activeColor: '#fff', border: '#bfe5db', color: '#0f766e' },
                      { key: 'busy', label: 'Busy', activeBg: '#fff7ed', activeColor: '#b45309', border: '#f4d9c7', color: '#b45309' },
                      { key: 'closed', label: 'Closed', activeBg: '#fff7f7', activeColor: '#b42318', border: '#f3d0d0', color: '#b42318' },
                    ].map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setEditAvailability(option.key)}
                        className="rounded-full border px-3 py-2 text-sm font-semibold transition-colors"
                        style={editAvailability === option.key
                          ? { background: option.activeBg, borderColor: option.border, color: option.activeColor }
                          : { background: '#fff', borderColor: '#e5e7eb', color: '#4b5563' }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <h4 className="font-semibold text-sm mb-3" style={{ color: dm ? '#f2f2f7' : '#111' }}>Business Hours</h4>
                  <div className="space-y-2">
                    {HOURS_DAYS.map((day) => {
                      const current = editHours[day] || '';
                      const open = !!current && current.toLowerCase() !== 'closed';
                      return (
                        <div key={day} className="flex items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: dm ? '#2c2c2e' : '#e5e7eb', background: dm ? '#111' : '#fff' }}>
                          <div className="min-w-[96px] text-sm font-medium" style={{ color: dm ? '#f2f2f7' : '#111' }}>{day}</div>
                          <div className="flex-1 text-xs" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                            {open ? 'Open' : 'Closed'}
                          </div>
                          <input
                            type="checkbox"
                            checked={open}
                            onChange={(e) => setEditHours((prev) => ({ ...prev, [day]: e.target.checked ? (prev[day] && prev[day].toLowerCase() !== 'closed' ? prev[day] : '9 AM - 5 PM') : 'Closed' }))}
                            className="h-5 w-5 rounded-full accent-[#007e6d]"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveHours}
                    disabled={settingsSaving}
                    className="mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                    style={{ background: settingsSaving ? '#9ca3af' : '#007e6d' }}
                  >
                    {settingsSaving ? 'Saving…' : 'Save Hours'}
                  </button>
                </div>
                <div className="provider-premium-panel rounded-[30px] p-6" style={{ background: dm ? '#1c1c1e' : 'white', border: '1px solid ' + (dm ? '#2c2c2e' : '#f0f0f0') }}>
                  <h3 className="font-bold text-base mb-2" style={{ color: dm ? '#f2f2f7' : '#111' }}>Custom Request Scheduling</h3>
                  <p className="text-xs mb-3" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>Choose whether custom requests need an exact time or just a due date.</p>
                  <label className="flex items-center justify-between rounded-2xl border px-4 py-3 text-xs font-semibold" style={{ borderColor: dm ? '#2c2c2e' : '#cfe7de', color: dm ? '#e5e7eb' : '#0f766e', background: dm ? '#111' : '#f5fbf8' }}>
                    Requires exact time
                    <input type="checkbox" checked={business?.custom_requires_time !== false} onChange={e => handleCustomRequiresTime(e.target.checked)} className="h-5 w-5 rounded-full accent-[#007e6d]" />
                  </label>
                </div>
              </div>
            </div>
            )}
            {tab === 'edit' && (
              <div className="provider-premium-panel bg-white rounded-[30px] border border-neutral-100 overflow-hidden">
                <div
                  className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between"
                  style={{
                    background: dm ? '#131415' : '#fffdfa',
                    boxShadow: dm ? 'inset 0 -1px 0 rgba(255,255,255,0.05), 0 12px 28px rgba(0,0,0,0.14)' : '0 10px 26px rgba(15,23,42,0.05)',
                  }}
                >
                  <div>
                    <p
                      className="text-[11px] font-bold uppercase tracking-[0.14em]"
                      style={{ color: dm ? '#5eead4' : '#007e6d' }}
                    >
                      Edit Listing
                    </p>
                    <p
                      className="text-sm font-bold mt-1"
                      style={{ color: dm ? '#ffffff' : '#111827' }}
                    >
                      Live Preview
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {previewEditMode ? (
                      <>
                        <button
                          onClick={() => sendPreviewAction('cancel-edit')}
                          className="text-xs font-bold px-3.5 py-2 rounded-xl border transition-colors shadow-sm"
                          style={{
                            borderColor: dm ? '#6b7280' : '#c8d4ce',
                            background: dm ? '#23262a' : '#ffffff',
                            color: dm ? '#ffffff' : '#1f2937',
                            boxShadow: dm ? '0 8px 18px rgba(0,0,0,0.24)' : '0 10px 22px rgba(15, 23, 42, 0.08)',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => sendPreviewAction('save-edit')}
                          className="text-xs font-bold px-3.5 py-2 rounded-xl text-white transition-colors shadow-sm"
                          style={{ background: '#007e6d', boxShadow: '0 14px 28px rgba(0,126,109,0.28)' }}
                        >
                          Save changes
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => sendPreviewAction('enter-edit')}
                        className="text-xs font-bold px-3.5 py-2 rounded-xl border transition-colors shadow-sm"
                        style={{ borderColor: dm ? 'rgba(94,234,212,0.34)' : 'rgba(0,126,109,0.24)', background: dm ? 'rgba(0,126,109,0.18)' : 'rgba(0,126,109,0.12)', color: dm ? '#d1fae5' : '#007e6d', boxShadow: dm ? '0 8px 18px rgba(0,0,0,0.22)' : '0 10px 22px rgba(15, 23, 42, 0.06)' }}
                      >
                        Edit mode
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-5" key={previewKey}>
                  {business?.slug ? (
                    <iframe
                      ref={previewFrameRef}
                      title="ScheduleMe Live Preview"
                      src={`/biz/${encodeURIComponent(business.slug)}?edit=1&from=dashboard&bid=${business.id}&embedded=1&k=${previewKey}`}
                      className="w-full rounded-[24px] border border-neutral-100 bg-white"
                      style={{ minHeight: '82vh' }}
                    />
                  ) : (
                    <div className="p-6 text-sm text-neutral-500">Editor unavailable until your provider slug is ready.</div>
                  )}
                </div>
              </div>
            )}

            {tab === 'settings' && (
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
                <div className="provider-premium-panel bg-white rounded-[30px] border border-neutral-100 p-6 lg:col-span-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-bold text-neutral-900">Visibility & Discovery</h2>
                      <p className="text-xs mt-1" style={{ color: dm ? '#6b7280' : '#6b7280' }}>
                        Provider cards appear across ScheduleMe by default. Use these controls to fine-tune how much of your identity is shown.
                      </p>
                    </div>
                    <div className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: publicVisibility ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)', color: publicVisibility ? '#059669' : '#b91c1c' }}>
                      {publicVisibility ? 'Visible on ScheduleMe' : 'Hidden from public browse'}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 border-neutral-300 text-accent focus:ring-accent"
                        style={{ accentColor: '#007e6d', borderRadius: 6 }}
                        checked={campusShowName}
                        onChange={e => persistVisibility(publicVisibility, publicShowName, publicShowPhotos, e.target.checked)}
                        disabled={visibilitySaving}
                      />
                      <div>
                        <p className="font-semibold text-neutral-900">Show my personal name to students</p>
                        <p className="text-xs text-neutral-500">Turn this off if you want students to see only your business name.</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 border-neutral-300 text-accent focus:ring-accent"
                        style={{ accentColor: '#007e6d', borderRadius: 6 }}
                        checked={publicVisibility}
                        onChange={e => {
                          const nextVis = e.target.checked;
                          persistVisibility(nextVis, publicShowName, publicShowPhotos, campusShowName);
                        }}
                        disabled={visibilitySaving}
                      />
                      <div>
                        <p className="font-semibold text-neutral-900">List my provider card on ScheduleMe</p>
                        <p className="text-xs text-neutral-500">Controls whether your card appears on home, browse, and search surfaces.</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 border-neutral-300 text-accent focus:ring-accent"
                        style={{ accentColor: '#007e6d', borderRadius: 6 }}
                        checked={publicShowName}
                        onChange={e => persistVisibility(publicVisibility, e.target.checked, publicShowPhotos, campusShowName)}
                        disabled={!publicVisibility || visibilitySaving}
                      />
                      <div style={!publicVisibility ? { opacity: 0.6 } : undefined}>
                        <p className="font-semibold text-neutral-900">Show my personal name to non-students</p>
                        <p className="text-xs text-neutral-500">Keep this off if you only want your personal name visible inside campus contexts.</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 border-neutral-300 text-accent focus:ring-accent"
                        style={{ accentColor: '#007e6d', borderRadius: 6 }}
                        checked={publicShowPhotos}
                        onChange={e => persistVisibility(publicVisibility, publicShowName, e.target.checked, campusShowName)}
                        disabled={!publicVisibility || visibilitySaving}
                      />
                      <div style={!publicVisibility ? { opacity: 0.6 } : undefined}>
                        <p className="font-semibold text-neutral-900">Show my photos on public cards</p>
                        <p className="text-xs text-neutral-500">If this is off, ScheduleMe will use a simpler card presentation instead.</p>
                      </div>
                    </label>
                  </div>
                </div>
                <div className="space-y-5">
                  <form onSubmit={handleSaveSettings} className="provider-premium-panel bg-white rounded-[30px] border border-neutral-100 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-sm font-bold text-neutral-900">Location & Contact</h2>
                        <p className="text-xs mt-1" style={{ color: dm ? '#6b7280' : '#6b7280' }}>
                          Set your city and ZIP. ScheduleMe will derive your provider coordinates from the ZIP code you enter.
                        </p>
                      </div>
                      {business?.lat != null && business?.lng != null && (
                        <div className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(0,126,109,0.10)', color: '#007e6d' }}>
                          Coordinates ready
                        </div>
                      )}
                    </div>
                      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="text-sm">
                        <span className="block text-xs font-semibold text-neutral-500 mb-1.5">City</span>
                        <input
                          type="text"
                          value={editCity}
                          onChange={(e) => setEditCity(e.target.value)}
                          placeholder="Santa Cruz"
                          className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                          style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#404040' : '#d1d5db', color: dm ? '#f3f4f6' : '#171717' }}
                        />
                      </label>
                      <label className="text-sm">
                        <span className="block text-xs font-semibold text-neutral-500 mb-1.5">ZIP Code</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editZip}
                          onChange={(e) => setEditZip(e.target.value.replace(/[^\d-]/g, '').slice(0, 10))}
                          placeholder="95060"
                          className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                          style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#404040' : '#d1d5db', color: dm ? '#f3f4f6' : '#171717' }}
                        />
                      </label>
                      <label className="text-sm">
                        <span className="block text-xs font-semibold text-neutral-500 mb-1.5">Phone</span>
                        <input
                          type="text"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="(555) 555-5555"
                          className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                          style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#404040' : '#d1d5db', color: dm ? '#f3f4f6' : '#171717' }}
                        />
                      </label>
                      <label className="text-sm">
                        <span className="block text-xs font-semibold text-neutral-500 mb-1.5">Website</span>
                        <input
                          type="text"
                          value={editWebsite}
                          onChange={(e) => setEditWebsite(e.target.value)}
                          placeholder="https://"
                          className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                          style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#404040' : '#d1d5db', color: dm ? '#f3f4f6' : '#171717' }}
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="min-h-[18px] text-xs">
                        {settingsError ? <span className="text-red-500">{settingsError}</span> : null}
                        {!settingsError && settingsNotice ? <span style={{ color: '#007e6d' }}>{settingsNotice}</span> : null}
                        {!settingsError && !settingsNotice && settingsSaved ? <span style={{ color: '#007e6d' }}>Saved.</span> : null}
                      </div>
                      <button
                        type="submit"
                        disabled={settingsSaving}
                        className="rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-60"
                        style={{ background: '#007e6d' }}
                      >
                        {settingsSaving ? 'Saving…' : 'Save Location'}
                      </button>
                    </div>
                  </form>
                  <div className="provider-premium-panel bg-white rounded-[30px] border border-neutral-100 p-6">
                    <h2 className="text-sm font-bold text-neutral-900 mb-4">Account Info</h2>
                    <div className="space-y-3">
                      {[
                        { label: 'Owner', value: business?.owner_name },
                        { label: 'Email', value: business?.owner_email },
                        { label: 'Provider type', value: business?.campus_provider ? `Campus provider${business?.campus_school_name || business?.school_domain ? ` · ${business?.campus_school_name || formatCampusLabel(business?.school_domain) || business?.school_domain}` : ''}` : 'Independent provider' },
                        { label: 'Status', value: business?.public_visibility ? '✓ Live on ScheduleMe' : 'Incomplete' },
                        { label: 'Rating', value: business?.rating ? business.rating + ' ★' : 'No ratings yet' },
                      ].map(r => (
                        <div key={r.label} className="flex items-start justify-between gap-4 py-2 border-b border-neutral-50 last:border-0">
                          <span className="text-xs text-neutral-400 font-medium shrink-0">{r.label}</span>
                          <span className="text-sm text-neutral-700 text-right">{r.value || '—'}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs font-semibold text-neutral-500 mt-4">Want to affiliate with your campus?</p>
                    <div className="mt-4 grid grid-cols-1 gap-2">
                      <button type="button" onClick={() => setShowCampusModal(true)} className="w-full py-2.5 rounded-xl text-sm font-semibold border"
                        style={{ borderColor: '#007e6d', color: '#007e6d', background: dm ? 'rgba(0,126,109,0.12)' : '#f5fbf8' }}>
                        {business?.edu_verified ? 'View EDU Verification' : 'Verify .edu Email'}
                      </button>
                      {Boolean((business?.school_email || '').trim() || business?.edu_verified) && (
                        <button type="button" onClick={() => { setDisconnectText(''); setDisconnectError(''); setShowDisconnectEdu(true); }}
                          className="w-full py-2.5 rounded-xl text-sm font-semibold border"
                          style={{ borderColor: '#ef4444', color: '#ef4444', background: dm ? 'rgba(239,68,68,0.08)' : '#FEF2F2' }}>
                          Disconnect .edu Email
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-5">
                  <div className="provider-premium-panel bg-white rounded-[30px] border border-neutral-100 p-6">
                    <h2 className="text-sm font-bold text-neutral-900 mb-2">Payment Account</h2>
                    <p className="text-xs text-neutral-400 mb-4">{business?.stripe_onboarded ? 'Step 2/2: Connected via Stripe. Payouts live.' : 'Step 1/2: Connect bank & get paid.'}</p>
                    {business?.stripe_onboarded ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Bank account connected
                        </div>
                        <button
                          type="button"
                          onClick={() => handleStripeConnect('update')}
                          disabled={stripeLoading}
                          className="w-full text-sm font-semibold px-4 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">
                          Configure Stripe settings
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDisconnectStripeText(''); setDisconnectStripeError(''); setShowDisconnectStripe(true); }}
                          className="w-full text-sm font-semibold px-4 py-2.5 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                          Disconnect Stripe
                        </button>
                        <p className="text-[11px] text-neutral-400">Add a debit card in Stripe to enable instant payouts. New Stripe accounts may take up to 7 days for the first payout to arrive.</p>
                        {stripeConnectError && <p className="text-[11px] text-amber-700">{stripeConnectError}</p>}
                        {stripeStatusMsg && <p className="text-[11px] text-neutral-500">{stripeStatusMsg}</p>}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <button onClick={() => handleStripeConnect('onboarding')} disabled={stripeLoading} className="btn-primary text-sm px-5 py-2.5 w-full">
                          {stripeLoading ? 'Loading…' : stripeCta}
                        </button>
                        {business?.stripe_account_id && (
                          <button
                            type="button"
                            onClick={() => { setDisconnectStripeText(''); setDisconnectStripeError(''); setShowDisconnectStripe(true); }}
                            className="w-full text-sm font-semibold px-4 py-2.5 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                            Disconnect Stripe
                          </button>
                        )}
                        {stripeConnectError && <p className="text-[11px] text-amber-700">{stripeConnectError}</p>}
                        {stripeStatusMsg && <p className="text-[11px] text-neutral-500">{stripeStatusMsg}</p>}
                      </div>
                    )}
                  </div>
                  <div className="provider-premium-panel bg-white rounded-[30px] border border-neutral-100 p-6">
                    <h2 className="text-sm font-bold text-neutral-900 mb-2">Session</h2>
                    <p className="text-xs text-neutral-400 mb-4">Signed in as {business?.owner_email}</p>
                    <div className="grid grid-cols-1 gap-2">
                      <button onClick={handleSignOut} className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors">Sign Out</button>
                      <button
                        type="button"
                        onClick={() => { setDeleteAccountText(''); setDeleteAccountError(''); setShowDeleteAccount(true); }}
                        className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                      >
                        Delete Account
                      </button>
                    </div>
                  </div>
                  <div className="provider-premium-panel bg-white rounded-[30px] border border-neutral-100 p-6">
                    <h2 className="text-sm font-bold text-neutral-900 mb-2">Legal & Support</h2>
                    <p className="text-xs text-neutral-400 mb-4">Review the latest policies and contact support.</p>
                    <div className="grid grid-cols-1 gap-2">
                      <Link href="/privacy" className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors">
                        Privacy Policy
                      </Link>
                      <Link href="/terms" className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors">
                        Terms of Service
                      </Link>
                      <Link href="/support" className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors">
                        Support
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
      {toast && (
        <div className={`fixed top-6 right-6 z-[600] px-5 py-3 rounded-xl text-sm font-semibold shadow-xl ${toast.ok ? 'bg-accent text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}
      {stripeFallbackUrl && (
        <div className="fixed bottom-6 right-6 z-[600] max-w-sm rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-xl">
          <p className="text-sm font-semibold text-amber-800">Stripe didn’t open?</p>
          <p className="text-xs text-amber-700 mt-1">Some browsers or blockers stop the Stripe page from loading. Use the button below to open it in a new tab.</p>
          <div className="mt-3 flex items-center gap-2">
            <a
              href={stripeFallbackUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Open Stripe in new tab
            </a>
            <button
              type="button"
              onClick={() => setStripeFallbackUrl('')}
              className="text-xs font-semibold text-amber-700 hover:text-amber-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {showDisconnectEdu && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="relative w-full max-w-md rounded-2xl p-6 border" style={{ background: dm ? '#141414' : 'white', borderColor: dm ? '#262626' : '#e5e7eb' }}>
            <button onClick={() => setShowDisconnectEdu(false)} className="absolute top-3 right-3 h-7 w-7 rounded-full flex items-center justify-center" style={{ background: dm ? '#262626' : '#f3f4f6', color: dm ? '#d4d4d8' : '#6b7280' }}>×</button>
            <span className="sm-eyebrow mb-2 block">Provider Type</span>
            <h2 className="font-bold mb-1" style={{ letterSpacing: '-0.01em', color: dm ? '#f3f4f6' : '#111' }}>Disconnect .edu Email</h2>
            <p className="text-xs mt-2" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
              This removes your campus verification so you can re-verify with a new school. Type <strong>confirm</strong> to continue.
            </p>
            <div className="mt-4 space-y-3">
              <input type="text" value={disconnectText} onChange={(e) => setDisconnectText(e.target.value)} placeholder="confirm"
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#404040' : '#d1d5db', color: dm ? '#f3f4f6' : '#171717' }} />
              {disconnectError && <p className="text-xs text-red-500">{disconnectError}</p>}
              <button
                type="button"
                disabled={disconnectText.trim().toLowerCase() !== 'confirm' || disconnectLoading}
                onClick={async () => {
                  if (disconnectText.trim().toLowerCase() !== 'confirm') return;
                  setDisconnectLoading(true);
                  setDisconnectError('');
                  try {
                    const sb = getSupabaseClient();
                    const { data: { session } } = await sb.auth.getSession();
                    const res = await fetch('/api/disconnect-edu', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + session?.access_token,
                      },
                    });
                    const d = await res.json();
                    if (!res.ok) {
                      setDisconnectError(d.error || 'Failed to disconnect.');
                    } else {
                      setBusiness((b) => b ? { ...b, edu_verified: false } : b);
                      setCampusCodeSent(false);
                      setCampusEduEmail('');
                      setCampusCode('');
                      setShowDisconnectEdu(false);
                    }
                  } catch (e) {
                    setDisconnectError('Network error.');
                  } finally {
                    setDisconnectLoading(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: disconnectText.trim().toLowerCase() === 'confirm' ? '#ef4444' : (dm ? '#2c2c2e' : '#e5e7eb'), color: disconnectText.trim().toLowerCase() === 'confirm' ? 'white' : (dm ? '#6b7280' : '#9ca3af') }}
              >
                {disconnectLoading ? 'Disconnecting…' : 'Disconnect'}
              </button>
              <button type="button" onClick={() => setShowDisconnectEdu(false)} className="w-full text-xs text-center" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showDisconnectStripe && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="relative w-full max-w-md rounded-2xl p-6 border" style={{ background: dm ? '#141414' : 'white', borderColor: dm ? '#262626' : '#e5e7eb' }}>
            <button onClick={() => setShowDisconnectStripe(false)} className="absolute top-3 right-3 h-7 w-7 rounded-full flex items-center justify-center" style={{ background: dm ? '#262626' : '#f3f4f6', color: dm ? '#d4d4d8' : '#6b7280' }}>×</button>
            <span className="sm-eyebrow mb-2 block">Payments</span>
            <h2 className="font-bold mb-1" style={{ letterSpacing: '-0.01em', color: dm ? '#f3f4f6' : '#111' }}>Disconnect Stripe</h2>
            <p className="text-xs mt-2" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
              This removes your Stripe connection and pauses payouts. Type <strong>disconnect</strong> to continue.
            </p>
            <div className="mt-4 space-y-3">
              <input type="text" value={disconnectStripeText} onChange={(e) => setDisconnectStripeText(e.target.value)} placeholder="disconnect"
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#404040' : '#d1d5db', color: dm ? '#f3f4f6' : '#171717' }} />
              {disconnectStripeError && <p className="text-xs text-red-500">{disconnectStripeError}</p>}
              <button
                type="button"
                disabled={disconnectStripeText.trim().toLowerCase() !== 'disconnect' || disconnectStripeLoading}
                onClick={async () => {
                  if (!business) return;
                  if (disconnectStripeText.trim().toLowerCase() !== 'disconnect') return;
                  setDisconnectStripeLoading(true);
                  setDisconnectStripeError('');
                  try {
                    const headers = await getAuthHeaders();
                    const res = await fetch('/api/disconnect-stripe', {
                      method: 'POST',
                      headers: { ...headers, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ businessId: business.id }),
                    });
                    const d = await res.json();
                    if (!res.ok) {
                      setDisconnectStripeError(d.error || 'Failed to disconnect.');
                    } else {
                      setBusiness(b => b ? { ...b, stripe_account_id: null, stripe_onboarded: false } : b);
                      setStripeStatusMsg('Stripe disconnected.');
                      setShowDisconnectStripe(false);
                    }
                  } catch {
                    setDisconnectStripeError('Network error.');
                  } finally {
                    setDisconnectStripeLoading(false);
                  }
                }}
                style={{ background: disconnectStripeText.trim().toLowerCase() === 'disconnect' ? '#ef4444' : (dm ? '#2c2c2e' : '#e5e7eb'), color: disconnectStripeText.trim().toLowerCase() === 'disconnect' ? 'white' : (dm ? '#6b7280' : '#9ca3af') }}
                className="w-full py-2.5 rounded-xl font-semibold text-sm">
                {disconnectStripeLoading ? 'Disconnecting…' : 'Disconnect Stripe'}
              </button>
              <button type="button" onClick={() => setShowDisconnectStripe(false)} className="w-full text-xs text-center" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteAccount && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="relative w-full max-w-md rounded-2xl p-6 border" style={{ background: dm ? '#141414' : 'white', borderColor: dm ? '#262626' : '#e5e7eb' }}>
            <button onClick={() => { if (!deleteAccountLoading) setShowDeleteAccount(false); }} className="absolute top-3 right-3 h-7 w-7 rounded-full flex items-center justify-center" style={{ background: dm ? '#262626' : '#f3f4f6', color: dm ? '#d4d4d8' : '#6b7280' }}>×</button>
            <span className="sm-eyebrow mb-2 block">Danger Zone</span>
            <h2 className="font-bold mb-1" style={{ letterSpacing: '-0.01em', color: dm ? '#f3f4f6' : '#111' }}>Delete Provider Account</h2>
            <p className="text-xs mt-2" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
              This permanently deletes your provider account, business listing, and sign-in access. This action cannot be undone.
            </p>
            <div className="mt-4 space-y-3">
              <p className="text-xs" style={{ color: dm ? '#d1d5db' : '#374151' }}>
                Type <strong>DELETE</strong> to continue.
              </p>
              <input
                type="text"
                value={deleteAccountText}
                onChange={(e) => setDeleteAccountText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#404040' : '#d1d5db', color: dm ? '#f3f4f6' : '#171717' }}
                disabled={deleteAccountLoading}
              />
              {deleteAccountError && <p className="text-xs text-red-500">{deleteAccountError}</p>}
              <button
                type="button"
                disabled={deleteAccountText.trim().toUpperCase() !== 'DELETE' || deleteAccountLoading}
                onClick={handleDeleteProviderAccount}
                className="w-full py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-40"
                style={{ background: '#ef4444' }}
              >
                {deleteAccountLoading ? 'Deleting…' : 'Delete My Account'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteAccount(false)}
                disabled={deleteAccountLoading}
                className="w-full text-xs text-center"
                style={{ color: dm ? '#9ca3af' : '#6b7280' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {blockConfirm && (
        <div className="fixed inset-0 z-[650] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 border" style={{ background: dm ? '#141414' : 'white', borderColor: dm ? '#262626' : '#e5e7eb' }}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-bold" style={{ color: dm ? '#f3f4f6' : '#111' }}>Block this customer?</p>
                <p className="text-xs mt-1" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                  This will cancel their current booking and prevent future bookings.
                </p>
              </div>
              <button onClick={() => setBlockConfirm(null)} className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: dm ? '#262626' : '#f3f4f6', color: dm ? '#d4d4d8' : '#6b7280' }}>×</button>
            </div>
            <div className="text-xs mb-4" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>{blockConfirm.name}</div>
            <div className="flex gap-2">
              <button onClick={() => setBlockConfirm(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: dm ? '#1f2937' : '#f3f4f6', color: dm ? '#d1d5db' : '#374151' }}>Back</button>
              <button
                onClick={async () => {
                  await applyBlock(blockConfirm.userId, true, blockConfirm.bookingIds);
                  setBlockConfirm(null);
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: '#ef4444' }}>
                Block customer
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmAction && (() => {
        const b = confirmAction.booking;
        const isCustom = isCustomPricingBooking(b);
        const priceCents = confirmAction.priceCents ?? b.amount_cents ?? 0;
        const needsPrice = (confirmAction.action === 'confirm' || confirmAction.action === 'dispute') && isCustom && !(priceCents > 0);
        return (
          <div className="fixed inset-0 z-[500] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="w-full max-w-md rounded-2xl p-6 border" style={{ background: dm ? '#141414' : 'white', borderColor: dm ? '#262626' : '#e5e7eb' }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-bold" style={{ color: dm ? '#f3f4f6' : '#111' }}>
                    {confirmAction.action === 'confirm'
                      ? (confirmAction.booking.status === 'price_disputed' ? 'Send price to customer?' : 'Confirm booking?')
                      : confirmAction.action === 'dispute'
                        ? 'Dispute price?'
                        : confirmAction.action === 'accept_price'
                          ? 'Accept customer price?'
                          : 'Cancel booking?'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                    {confirmAction.action === 'confirm'
                      ? (confirmAction.booking.status === 'price_disputed'
                        ? 'This will keep the booking disputed and send your price to the customer to confirm.'
                        : 'This will move the request into confirmed.')
                      : confirmAction.action === 'dispute'
                        ? 'This keeps the booking pending and sends your counter price for customer approval.'
                        : confirmAction.action === 'accept_price'
                          ? 'This accepts the customer price and keeps the request moving forward immediately.'
                          : 'This will notify the customer and mark it cancelled. Refunds can be triggered automatically for paid bookings.'}
                  </p>
                </div>
                <button onClick={() => setConfirmAction(null)} className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: dm ? '#262626' : '#f3f4f6', color: dm ? '#d4d4d8' : '#6b7280' }}>×</button>
              </div>
              <div className="text-xs mb-4" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                {b.service || 'Custom Request'}{b.scheduled_start ? ` • ${fmtTime(b.scheduled_start)}` : ''}
              </div>
              {(confirmAction.action === 'confirm' || confirmAction.action === 'dispute' || confirmAction.action === 'accept_price') && isCustom && (
                <div className="text-xs mb-4" style={{ color: needsPrice ? '#ef4444' : (dm ? '#9ca3af' : '#6b7280') }}>
                  {needsPrice ? 'Set a price before confirming.' : `Price: ${fmt(priceCents)}`}
                </div>
              )}
              {(confirmAction.action === 'confirm' || confirmAction.action === 'cancel') && (
                <label className="flex items-start gap-2 mb-4 text-xs" style={{ color: dm ? '#d1d5db' : '#374151' }}>
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={confirmAcknowledge}
                    onChange={(e) => setConfirmAcknowledge(e.target.checked)}
                  />
                  <span>
                    {confirmAction.action === 'confirm'
                      ? 'I understand confirming this booking starts the service workflow and may trigger immediate customer charges.'
                      : 'I understand cancelling this booking notifies the customer and may trigger an automatic refund.'}
                  </span>
                </label>
              )}
              <div className="flex gap-2">
                <button onClick={() => setConfirmAction(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: dm ? '#1f2937' : '#f3f4f6', color: dm ? '#d1d5db' : '#374151' }}>Back</button>
                <button
                  disabled={needsPrice || confirmSubmitting || ((confirmAction.action === 'confirm' || confirmAction.action === 'cancel') && !confirmAcknowledge)}
                  onClick={async () => {
                    if (confirmSubmitting) return;
                    setConfirmSubmitting(true);
                    const action = confirmAction.action;
                    const booking = confirmAction.booking;
                    let ok = true;
                    if (action === 'confirm') {
                      if (isCustom) {
                        ok = await handleSetPrice(booking.id, priceCents);
                        if (!ok) { setConfirmSubmitting(false); return; }
                      }
                      if (booking.status !== 'price_disputed') {
                        ok = await handleUpdateBooking(booking.id, 'confirmed');
                      }
                    } else if (action === 'accept_price') {
                      ok = await handleSetPrice(booking.id, priceCents);
                    } else if (action === 'dispute') {
                      if (isCustom) {
                        ok = await handleDisputePrice(booking.id, priceCents);
                        if (!ok) { setConfirmSubmitting(false); return; }
                      }
                    } else {
                      ok = await handleUpdateBooking(booking.id, 'cancelled');
                    }
                    if (ok) {
                      if (action === 'confirm') {
                        setActionDone({
                          title: booking.status === 'price_disputed' ? 'Price sent' : 'Booking confirmed',
                          message: booking.status === 'price_disputed'
                            ? 'Your price was sent to the customer. They must accept it before this booking can continue.'
                            : 'Booking confirmed successfully.',
                        });
                      } else if (action === 'accept_price') {
                        setActionDone({
                          title: 'Price accepted',
                          message: 'You accepted the customer price. The booking can now continue to payment/confirmation.',
                        });
                      } else if (action === 'dispute') {
                        setActionDone({
                          title: 'Price disputed',
                          message: 'Your counter price was sent to the customer. You can update once they respond.',
                        });
                      } else {
                        setActionDone({
                          title: 'Booking cancelled',
                          message: 'The booking was cancelled and the customer has been notified.',
                        });
                      }
                    }
                    setConfirmAction(null);
                    setConfirmSubmitting(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-40"
                  style={{ background: confirmAction.action === 'confirm' || confirmAction.action === 'accept_price' ? '#0f766e' : (confirmAction.action === 'dispute' ? '#dc2626' : '#ef4444') }}>
                  {confirmSubmitting ? 'Working…' : (confirmAction.action === 'confirm' ? 'Confirm' : (confirmAction.action === 'dispute' ? 'Dispute Price' : (confirmAction.action === 'accept_price' ? 'Accept Price' : 'Cancel Booking')))}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {confirmComplete && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 border" style={{ background: dm ? '#141414' : 'white', borderColor: dm ? '#262626' : '#e5e7eb' }}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-bold" style={{ color: dm ? '#f3f4f6' : '#111' }}>Mark booking complete?</p>
                <p className="text-xs mt-1" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>Add proof below. Completion is automatic and opens a short consumer dispute window.</p>
              </div>
              <button onClick={() => setConfirmComplete(null)} className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: dm ? '#262626' : '#f3f4f6', color: dm ? '#d4d4d8' : '#6b7280' }}>×</button>
            </div>
            {confirmComplete.scheduled_start && (
              <div className="text-xs mb-4" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                Scheduled for {fmtTime(confirmComplete.scheduled_start)}
              </div>
            )}
            <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: dm ? '#a1a1aa' : '#6b7280' }}>
              Completion note (or add photo proof)
            </label>
            <textarea
              rows={3}
              value={completeProofNote}
              onChange={(e) => setCompleteProofNote(e.target.value.slice(0, 1000))}
              placeholder="Completed service at 3:42 PM..."
              className="w-full rounded-xl border px-3 py-2 text-sm mb-3"
              style={{ borderColor: dm ? '#262626' : '#e5e7eb', background: dm ? '#0d0d0d' : 'white', color: dm ? '#f3f4f6' : '#111' }}
            />
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer"
                style={{ borderColor: dm ? '#2c2c2e' : '#d1d5db', color: dm ? '#d1d5db' : '#374151' }}>
                {completeProofUploading ? 'Uploading…' : 'Add Photo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await uploadCompleteProofPhoto(confirmComplete.id, file);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
              {completeProofPhotos.length > 0 && (
                <span className="text-xs" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>
                  {completeProofPhotos.length} photo(s) attached
                </span>
              )}
            </div>
            <label className="flex items-start gap-2 mb-4 text-xs" style={{ color: dm ? '#d1d5db' : '#374151' }}>
              <input
                type="checkbox"
                className="mt-0.5"
                checked={completeAcknowledge}
                onChange={(e) => setCompleteAcknowledge(e.target.checked)}
              />
              <span>I understand this completion action cannot be undone.</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => setConfirmComplete(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: dm ? '#1f2937' : '#f3f4f6', color: dm ? '#d1d5db' : '#374151' }}>Cancel</button>
              <button
                onClick={async () => {
                  if (completeSubmitting) return;
                  const note = completeProofNote.trim();
                  if (!note && completeProofPhotos.length === 0) {
                    showToast('Add at least one proof item (note or photo).', false);
                    return;
                  }
                  setCompleteSubmitting(true);
                  const ok = await handleUpdateBooking(confirmComplete.id, 'completed', {
                    proof_note: note || '',
                    proof_photo_urls: completeProofPhotos,
                    proof_geo_metadata: {
                      capturedAt: new Date().toISOString(),
                      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    },
                  });
                  if (ok) {
                    setActionDone({
                      title: 'Booking completed',
                      message: 'This booking is complete. Customer can dispute only within the dispute window.',
                    });
                    setConfirmComplete(null);
                  }
                  setCompleteSubmitting(false);
                }}
                disabled={!completeAcknowledge || completeSubmitting}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40"
              >
                {completeSubmitting ? 'Working…' : 'Mark Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {actionDone && (
        <div className="fixed inset-0 z-[650] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 border" style={{ background: dm ? '#141414' : 'white', borderColor: dm ? '#262626' : '#e5e7eb' }}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-bold" style={{ color: dm ? '#f3f4f6' : '#111' }}>{actionDone.title}</p>
                <p className="text-xs mt-1" style={{ color: dm ? '#9ca3af' : '#6b7280' }}>{actionDone.message}</p>
              </div>
              <button onClick={() => setActionDone(null)} className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: dm ? '#262626' : '#f3f4f6', color: dm ? '#d4d4d8' : '#6b7280' }}>×</button>
            </div>
            <button
              onClick={() => setActionDone(null)}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: '#10b981' }}
            >
              Done
            </button>
          </div>
        </div>
      )}
      {showCampusModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="w-full max-w-md rounded-2xl border p-6 relative" style={{ background: dm ? '#141414' : 'white', borderColor: dm ? '#262626' : '#e5e7eb' }}>
            <button onClick={() => setShowCampusModal(false)} className="absolute top-3 right-3 h-7 w-7 rounded-full flex items-center justify-center" style={{ background: dm ? '#262626' : '#f3f4f6', color: dm ? '#d4d4d8' : '#6b7280' }}>×</button>
            <p className="text-sm font-semibold" style={{ color: dm ? '#f3f4f6' : '#171717' }}>Campus Provider</p>
            <p className="text-xs mt-0.5" style={{ color: dm ? '#6b7280' : '#9ca3af' }}>Link your .edu email to appear on the campus marketplace and assign this provider to that campus automatically.</p>
            {business?.edu_verified && (
              <div className="mt-3 flex items-center gap-2 text-emerald-600 text-sm font-semibold">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Verified for {business?.campus_school_name || formatCampusLabel(business?.school_domain) || business?.school_domain}
              </div>
            )}
            {!business?.edu_verified && (
              <div className="mt-4 space-y-3">
                {!campusCodeSent ? (
                  <div className="flex gap-2">
                    <input type="email" value={campusEduEmail} onChange={e => setCampusEduEmail(e.target.value)} placeholder="you@university.edu" className="flex-1 text-xs px-3 py-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-accent" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#404040' : '#d1d5db', color: dm ? '#f3f4f6' : '#171717' }} />
                    <button type="button" disabled={!campusEduEmail.endsWith('.edu') || campusSending} onClick={handleCampusSendCode} className="text-xs px-3 py-2 rounded-lg font-bold text-white shrink-0" style={{ background: campusEduEmail.endsWith('.edu') ? '#007e6d' : '#9ca3af' }}>{campusSending ? 'Sending…' : 'Send Code'}</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs" style={{ color: dm ? '#8e8e93' : '#6b7280' }}>Enter the 6-digit code sent to {campusEduEmail}</p>
                    <div className="flex gap-2">
                      <input type="text" value={campusCode} onChange={e => setCampusCode(e.target.value)} placeholder="123456" maxLength={6} className="flex-1 text-xs px-3 py-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-accent text-center tracking-widest font-bold" style={{ background: dm ? '#171717' : 'white', borderColor: dm ? '#404040' : '#d1d5db', color: dm ? '#f3f4f6' : '#171717' }} />
                      <button type="button" disabled={campusCode.length !== 6 || campusVerifying} onClick={handleCampusVerify} className="text-xs px-3 py-2 rounded-lg font-bold text-white shrink-0" style={{ background: campusCode.length === 6 ? '#007e6d' : '#9ca3af' }}>{campusVerifying ? 'Verifying…' : 'Verify'}</button>
                    </div>
                    {campusVerifyError && <p className="text-xs text-red-500">{campusVerifyError}</p>}
                    <button type="button" onClick={() => setCampusCodeSent(false)} className="text-xs" style={{ color: dm ? '#6b7280' : '#9ca3af' }}>← Use different email</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <style jsx global>{`
        .provider-dashboard-shell[data-provider-theme='light'] {
          background: #f6f1e6 !important;
        }

        .provider-dashboard-shell[data-provider-theme='light'] aside,
        .provider-dashboard-shell[data-provider-theme='light'] header {
          background: #fffdf8 !important;
          border-color: #e9dfd1 !important;
        }

        .provider-dashboard-shell[data-provider-theme='light'] .bg-white {
          background-color: #fffdfa !important;
        }

        .provider-dashboard-shell[data-provider-theme='light'] main .bg-white.rounded-2xl,
        .provider-dashboard-shell[data-provider-theme='light'] main .bg-white.rounded-\[28px\],
        .provider-dashboard-shell[data-provider-theme='light'] main .bg-white.rounded-\[24px\] {
          box-shadow: 0 14px 34px rgba(60, 79, 72, 0.05), 0 2px 6px rgba(60, 79, 72, 0.04);
        }

        .provider-dashboard-shell[data-provider-theme='light'] .provider-premium-panel,
        .provider-dashboard-shell[data-provider-theme='light'] .provider-list-card {
          position: relative;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,252,247,0.98) 100%) !important;
          border-color: #e7dccd !important;
          box-shadow:
            0 18px 46px rgba(63, 83, 74, 0.07),
            0 2px 10px rgba(63, 83, 74, 0.04) !important;
        }

        .provider-dashboard-shell[data-provider-theme='light'] .provider-segment-shell {
          padding: 10px;
          border-radius: 22px;
          background: rgba(255, 252, 247, 0.84);
          border: 1px solid #e7dccd;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.85);
        }

        .provider-dashboard-shell[data-provider-theme='light'] .provider-list-card {
          position: relative;
          overflow: hidden;
        }

        .provider-dashboard-shell[data-provider-theme='light'] .provider-service-row:hover,
        .provider-dashboard-shell[data-provider-theme='light'] .provider-inline-row:hover {
          background: rgba(246, 239, 228, 0.45);
        }

        .provider-dashboard-shell[data-provider-theme='light'] .border-neutral-100,
        .provider-dashboard-shell[data-provider-theme='light'] .border-neutral-200 {
          border-color: #ebe1d3 !important;
        }

        .provider-dashboard-shell[data-provider-theme='light'] .bg-neutral-50 {
          background-color: #f6efe4 !important;
        }

        .provider-dashboard-shell[data-provider-theme='light'] .text-neutral-900 {
          color: #1b252b !important;
        }

        .provider-dashboard-shell[data-provider-theme='light'] .text-neutral-700 {
          color: #41535a !important;
        }

        .provider-dashboard-shell[data-provider-theme='light'] .text-neutral-500 {
          color: #7f8a85 !important;
        }

        .provider-dashboard-shell[data-provider-theme='light'] .text-neutral-400,
        .provider-dashboard-shell[data-provider-theme='light'] .text-neutral-300 {
          color: #a7afa8 !important;
        }

        .provider-dashboard-shell[data-provider-theme='light'] aside nav button.bg-accent,
        .provider-dashboard-shell[data-provider-theme='light'] .btn-primary {
          background: linear-gradient(135deg, #20887a 0%, #1a7569 100%) !important;
          box-shadow: 0 12px 24px rgba(32, 136, 122, 0.14);
        }

        .provider-dashboard-shell[data-provider-theme='light'] aside nav button:not(.bg-accent):hover,
        .provider-dashboard-shell[data-provider-theme='light'] aside a:hover,
        .provider-dashboard-shell[data-provider-theme='light'] aside button:hover {
          background-color: #f4ede2 !important;
        }

        .provider-dashboard-shell[data-provider-theme='light'] .bg-amber-50 {
          background-color: #fff6e7 !important;
        }

        .provider-dashboard-shell[data-provider-theme='light'] .border-amber-200 {
          border-color: #f2d39a !important;
        }

        .provider-dashboard-shell[data-provider-theme='light'] .bg-emerald-50 {
          background-color: #eef9f3 !important;
        }

        .provider-dashboard-shell[data-provider-theme='light'] .border-emerald-200 {
          border-color: #b7e5ce !important;
        }

        .provider-dashboard-shell[data-provider-theme='light'] main h1,
        .provider-dashboard-shell[data-provider-theme='light'] main h2,
        .provider-dashboard-shell[data-provider-theme='light'] main h3 {
          letter-spacing: -0.03em;
        }

        .provider-dashboard-shell[data-provider-theme='light'] .shadow-\[0_8px_24px_rgba\(15\,23\,42\,0\.04\)\],
        .provider-dashboard-shell[data-provider-theme='light'] .shadow-\[0_10px_30px_rgba\(32\,136\,122\,0\.05\)\] {
          box-shadow: 0 16px 36px rgba(40, 61, 54, 0.06) !important;
        }
      `}</style>
    </>
  );
};

export async function getServerSideProps() {
  return { props: {} };
}

export default BusinessDashboard;
