// pages/api/bookings.ts — SECURED + completion proof + consumer confirmation + disputes
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { validateAndFilter } from '../../lib/profanity';
import { setSecurityHeaders, rateLimit, rateLimitByPrincipal, requireAuth, isValidUuid, isValidEmail } from '../../lib/apiSecurity';
import { canUserTransactWithStudentProvider, isProviderPubliclyVisible } from '../../lib/providerTrust';
import { isAwayWindow } from '../../lib/founder50';
import { PROTECTION_FEE_CENTS } from '../../lib/fees';
import { refundBookingPayment, releaseHeldFundsForBooking } from '../../lib/bookingFunds';

const DEFAULT_CONFIRMATION_WINDOW_HOURS = 24;
const VALID_STATUSES = [
  'pending',
  'confirmed',
  'active',
  'payment_pending',
  'paid',
  'awaiting_consumer_confirmation',
  'disputed',
  'completed',
  'cancelled',
  'payment_failed',
];

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

function parseSlotTo24h(slot?: string): { hours: number; minutes: number } | null {
  if (!slot || typeof slot !== 'string') return null;
  const m = slot.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  const meridiem = m[3].toUpperCase();
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return { hours, minutes };
}

function buildScheduledStart(scheduledDate?: string, scheduledSlot?: string, scheduledStartRaw?: string): string | null {
  if (scheduledStartRaw && typeof scheduledStartRaw === 'string') {
    const parsed = new Date(scheduledStartRaw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (!scheduledDate || typeof scheduledDate !== 'string') return null;
  const normalizedDate = scheduledDate.trim();
  const dateMatch = normalizedDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;
  const year = Number(dateMatch[1]);
  const monthIndex = Number(dateMatch[2]) - 1;
  const day = Number(dateMatch[3]);
  const base = new Date(year, monthIndex, day, 0, 0, 0, 0);
  if (Number.isNaN(base.getTime())) return null;
  const parsed = parseSlotTo24h(scheduledSlot);
  if (parsed) {
    base.setHours(parsed.hours, parsed.minutes, 0, 0);
  }
  return base.toISOString();
}

type HourEntry = { day: string; time: string };
const FULL_DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_ABBREV_TO_FULL: Record<string, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  thur: 'Thursday',
  thurs: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

function normalizeHours(hours: HourEntry[] | Record<string, string> | undefined): HourEntry[] {
  if (!hours) return [];
  if (Array.isArray(hours)) return hours;
  const out: HourEntry[] = [];
  for (const [day, time] of Object.entries(hours)) {
    if (typeof time === 'string' && time.trim()) out.push({ day, time });
  }
  return out;
}

function normalizeDayNameToken(input: string): string {
  const raw = String(input || '').trim().toLowerCase().replace(/\./g, '');
  if (!raw) return '';
  if (DAY_ABBREV_TO_FULL[raw]) return DAY_ABBREV_TO_FULL[raw];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function dayPatternMatchesDate(pattern: string, date: Date): boolean {
  const dayName = FULL_DAY_NAMES[date.getDay()];
  const normalizedPattern = String(pattern || '').trim();
  if (!normalizedPattern) return false;

  const lower = normalizedPattern.toLowerCase();
  if (lower.includes('daily') || lower.includes('every day')) return true;

  const rangeMatch = normalizedPattern.match(/(.+?)\s*(?:–|—|-|\bto\b)\s*(.+)/i);
  if (rangeMatch) {
    const startName = normalizeDayNameToken(rangeMatch[1]);
    const endName = normalizeDayNameToken(rangeMatch[2]);
    const s = FULL_DAY_NAMES.indexOf(startName);
    const e = FULL_DAY_NAMES.indexOf(endName);
    const d = FULL_DAY_NAMES.indexOf(dayName);
    if (s >= 0 && e >= 0 && d >= 0) {
      return s <= e ? (d >= s && d <= e) : (d >= s || d <= e);
    }
  }

  const tokens = normalizedPattern.split(/[,&/]/).map((t) => normalizeDayNameToken(t)).filter(Boolean);
  if (tokens.some((t) => t === dayName)) return true;

  const patternLower = normalizedPattern.toLowerCase();
  const fullLower = dayName.toLowerCase();
  const shortLower = fullLower.slice(0, 3);
  return patternLower.includes(fullLower) || patternLower.includes(shortLower);
}

function parseTimeTokenToMinutes(token: string): number | null {
  const v = String(token || '').trim();
  if (!v) return null;

  let m = v.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const mins = parseInt(m[2], 10);
    const ap = m[3].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h * 60 + mins;
  }

  m = v.match(/^(\d{1,2})\s*(AM|PM)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const ap = m[2].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h * 60;
  }

  m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = parseInt(m[1], 10);
    const mins = parseInt(m[2], 10);
    if (h >= 0 && h <= 23 && mins >= 0 && mins <= 59) return h * 60 + mins;
  }

  return null;
}

function getHoursForDate(hoursInput: HourEntry[] | Record<string, string> | undefined, date: Date): { open: number; close: number } | null {
  const hours = normalizeHours(hoursInput);
  if (!hours.length) return null;
  let sawNonClosedMatch = false;
  for (const h of hours) {
    if (!dayPatternMatchesDate(h.day, date)) continue;
    const timeRaw = String(h.time || '').trim();
    if (!timeRaw) continue;
    const lower = timeRaw.toLowerCase();
    if (lower.includes('closed')) continue;

    sawNonClosedMatch = true;
    if (lower === 'by appointment') return { open: 8 * 60, close: 20 * 60 };
    if (lower === '24 hours' || lower === '24hrs' || lower === '24 hr') return { open: 0, close: 24 * 60 };

    const parts = timeRaw.split(/\s*(?:–|—|-|\bto\b)\s*/i).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const open = parseTimeTokenToMinutes(parts[0]);
      const close = parseTimeTokenToMinutes(parts[1]);
      if (open !== null && close !== null && close > open) return { open, close };
    }
  }
  if (sawNonClosedMatch) return { open: 8 * 60, close: 20 * 60 };
  return null;
}

function isScheduledWithinBusinessAvailability(business: any, scheduledStartIso?: string | null): boolean {
  if (!scheduledStartIso) return true;
  const scheduledDate = new Date(scheduledStartIso);
  if (Number.isNaN(scheduledDate.getTime())) return false;
  if (isAwayWindow(business, scheduledDate)) return false;

  const hoursForDate = getHoursForDate(business?.hours, scheduledDate);
  const normalizedHours = normalizeHours(business?.hours);
  if (normalizedHours.length && !hoursForDate) return false;
  if (!hoursForDate) return true;

  const minutes = scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
  return minutes >= hoursForDate.open && minutes < hoursForDate.close;
}

function parseConfirmationWindowHours() {
  // Provider-protective default: auto-complete on proof with a fixed 24h dispute window.
  return DEFAULT_CONFIRMATION_WINDOW_HOURS;
}

function cleanText(value: unknown, maxLen = 1000): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function cleanUrlArray(value: unknown, maxItems = 8): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const s = item.trim();
    if (!s) continue;
    if (s.length > 1000) continue;
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

function deriveBookingStatus(row: any): string {
  if (row?.status === 'disputed' || row?.disputed_at) return 'disputed';
  const dueAt = row?.consumer_confirmation_due_at ? new Date(row.consumer_confirmation_due_at).getTime() : 0;
  if (row?.status === 'completed' && dueAt > Date.now()) return 'awaiting_consumer_confirmation';
  return row?.status || 'pending';
}

function isMissingColumnError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  const details = String(err?.details || '').toLowerCase();
  return msg.includes('column') || msg.includes('does not exist') || details.includes('does not exist');
}

function isUuidLike(value: unknown): value is string {
  const s = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

async function resolveUserIdsByEmail(
  supabase: ReturnType<typeof getSupabase>,
  email?: string | null
): Promise<string[]> {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return [];
  const ids = new Set<string>();
  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', normalized)
      .limit(50);
    for (const row of profiles || []) {
      if (isUuidLike((row as any)?.id)) ids.add((row as any).id);
    }
  } catch {}
  try {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .ilike('email', normalized)
      .limit(50);
    for (const row of users || []) {
      if (isUuidLike((row as any)?.id)) ids.add((row as any).id);
    }
  } catch {}
  return Array.from(ids);
}

async function buildBusinessByIdMap(
  supabase: ReturnType<typeof getSupabase>,
  rows: any[]
): Promise<Record<string, any>> {
  const ids = Array.from(new Set((rows || []).map((r: any) => r?.business_id).filter((id: any) => isUuidLike(id))));
  if (ids.length === 0) return {};
  let data: any[] | null = null;
  let error: any = null;
  ({ data, error } = await supabase
    .from('businesses')
    .select('id, name, phone, owner_email, email')
    .in('id', ids));

  if (error && isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from('businesses')
      .select('id, name, phone, owner_email')
      .in('id', ids));
  }

  if (error && isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from('businesses')
      .select('id, name, phone')
      .in('id', ids));
  }

  if (error && isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from('businesses')
      .select('id, name')
      .in('id', ids));
  }

  if (error) return {};
  const map: Record<string, any> = {};
  for (const b of data || []) {
    if (isUuidLike((b as any)?.id)) map[(b as any).id] = b;
  }
  return map;
}

async function notifyNewBooking(bookingId: string, supabase: ReturnType<typeof getSupabase>) {
  try {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, service, status, created_at, businesses(name, owner_email, phone), profiles(name, email, phone)')
      .eq('id', bookingId)
      .single();
    if (!booking) return;

    const biz = (booking.businesses as any);
    const user = (booking.profiles as any);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';
    const secret = process.env.NOTIFY_SECRET || '';

    if (biz?.owner_email) {
      await fetch(`${siteUrl}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
        body: JSON.stringify({
          type: 'new_booking_business',
          to: biz.owner_email,
          name: biz.name,
          service: booking.service,
          customerName: user?.name || 'A customer',
          customerPhone: user?.phone || '',
          bookingId,
        }),
      }).catch(() => {});
    }

    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nUrl) {
      await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'new_booking',
          bookingId,
          service: booking.service,
          businessName: biz?.name,
          businessEmail: biz?.owner_email,
          customerName: user?.name,
          customerEmail: user?.email,
          customerPhone: user?.phone,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    }
  } catch {
    // non-fatal
  }
}

async function sendStatusUpdateEmail(to: string | undefined, payload: any) {
  if (!to) return;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';
  await fetch(`${siteUrl}/api/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-notify-secret': process.env.NOTIFY_SECRET || '' },
    body: JSON.stringify({ type: 'status_update', to, ...payload }),
  }).catch(() => {});
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);

  if (req.method === 'POST') {
    if (!(await rateLimit(req, res, { max: 10, windowMs: 10 * 60_000, keyPrefix: 'book-post' }))) return;

    const authUser = await requireAuth(req, res);
    if (!authUser) return;
    if (!(await rateLimitByPrincipal(res, authUser.id, { max: 40, windowMs: 60_000, keyPrefix: 'book-post-user' }))) return;
    const {
      business_id,
      user_id,
      service,
      service_price_cents,
      customer_proposed_price_cents,
      user_name,
      user_phone,
      user_email,
      note,
      address,
      scheduled_date,
      scheduled_slot,
      scheduled_start,
    } = req.body;

    if (!business_id) return res.status(400).json({ error: 'business_id is required' });
    if (!isValidUuid(business_id)) return res.status(400).json({ error: 'Invalid business_id' });
    if (user_id && !isValidUuid(user_id)) return res.status(400).json({ error: 'Invalid user_id' });
    if (user_email && !isValidEmail(user_email)) return res.status(400).json({ error: 'Invalid email' });

    if (service) {
      const svcCheck = validateAndFilter(service, { maxLength: 500, fieldName: 'Service description' });
      if (!svcCheck.ok) return res.status(400).json({ error: 'error' in svcCheck ? svcCheck.error : 'Invalid service description' });
    }

    const safeAddress = typeof address === 'string' ? address.trim().slice(0, 300) : null;
    const safeNote = typeof note === 'string' ? note.trim().slice(0, 2000) : null;
    const scheduledStart = buildScheduledStart(scheduled_date, scheduled_slot, scheduled_start);
    const upfrontServiceAmountCents =
      typeof service_price_cents === 'number' && Number.isFinite(service_price_cents) && service_price_cents >= 0
        ? Math.round(service_price_cents)
        : null;
    const proposedPriceCents =
      typeof customer_proposed_price_cents === 'number' && Number.isFinite(customer_proposed_price_cents) && customer_proposed_price_cents >= 0
        ? Math.round(customer_proposed_price_cents)
        : null;
    const isUpfrontPaidService = !!upfrontServiceAmountCents && upfrontServiceAmountCents >= 100;

    try {
      const supabase = getSupabase();
      const normalizedEmail = typeof user_email === 'string' ? user_email.trim().toLowerCase() : '';
      const authEmail = (authUser?.email || '').trim().toLowerCase();
      if (normalizedEmail && authEmail && normalizedEmail !== authEmail) {
        return res.status(403).json({ error: 'Authenticated email does not match booking email' });
      }

      const { data: businessRow } = await supabase
        .from('businesses')
        .select('id, availability_status, break_until, away_start, away_end, hours, is_onboarded, public_visibility, trust_status, trust_flagged, approved_at, published_at, campus_provider, edu_verified, school_domain, campus_key')
        .eq('id', business_id)
        .maybeSingle();
      if (!businessRow) return res.status(404).json({ error: 'Provider not found' });
      if (!isProviderPubliclyVisible(businessRow)) {
        return res.status(403).json({ error: 'This provider is currently unavailable for booking.' });
      }
      const availabilityStatus = String((businessRow as any).availability_status || '').trim().toLowerCase();
      if (availabilityStatus && availabilityStatus !== 'open') {
        return res.status(409).json({
          error: `Provider is currently ${availabilityStatus} and not accepting bookings.`,
        });
      }
      if (!isScheduledWithinBusinessAvailability(businessRow, scheduledStart)) {
        return res.status(409).json({
          error: 'That time is outside the provider availability window.',
        });
      }

      const { data: profileRow } = await supabase
        .from('profiles')
        .select('edu_verified, school_domain, school_email, campus_key')
        .eq('id', authUser.id)
        .maybeSingle();
      const eligibility = canUserTransactWithStudentProvider({
        business: businessRow,
        profile: profileRow,
      });
      if (!eligibility.ok) {
        return res.status(403).json({
          error: eligibility.message || 'EDU verification required.',
          code: eligibility.code || 'edu_verification_required',
        });
      }

      let resolvedUserId = user_id;
      if (resolvedUserId && resolvedUserId !== authUser.id) {
        return res.status(403).json({ error: 'Authenticated user does not match booking user_id' });
      }
      resolvedUserId = authUser.id;
      await supabase
        .from('profiles')
        .upsert(
          {
            id: authUser.id,
            email: authEmail || normalizedEmail || null,
            name: user_name?.slice(0, 100) || null,
            phone: user_phone?.slice(0, 20) || null,
          },
          { onConflict: 'id' }
        );

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          business_id,
          user_id: resolvedUserId ?? null,
          service: service?.slice(0, 500) ?? 'General Service',
          status: 'pending',
          requires_manual_action: !isUpfrontPaidService,
          notes: safeNote,
          address: safeAddress,
          scheduled_start: scheduledStart,
          amount_cents: isUpfrontPaidService ? upfrontServiceAmountCents : null,
          protection_fee_cents: isUpfrontPaidService ? PROTECTION_FEE_CENTS : null,
          customer_proposed_price_cents: proposedPriceCents,
        })
        .select('id, status, created_at, amount_cents, address, notes, scheduled_start')
        .single();

      if (error) return res.status(500).json({ error: 'Failed to create booking' });

      if (!isUpfrontPaidService) {
        notifyNewBooking(data.id, supabase);
      }

      return res.status(200).json({ booking: data });
    } catch {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PATCH') {
    if (!(await rateLimit(req, res, { max: 120, windowMs: 60_000, keyPrefix: 'book-patch' }))) return;
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!(await rateLimitByPrincipal(res, user.id, { max: 240, windowMs: 60_000, keyPrefix: 'book-patch-user' }))) return;

    const { booking_id, status, action } = req.body;
    if (!isValidUuid(booking_id)) return res.status(400).json({ error: 'Invalid booking_id' });

    const supabase = getSupabase();
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, service, business_id, user_id, paid_at, status, amount_cents, consumer_confirmation_due_at, completion_proof_submitted_at, businesses(owner_id, owner_email, name), profiles(name, email)')
      .eq('id', booking_id)
      .maybeSingle();

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const ownerID = (booking.businesses as any)?.owner_id;
    const ownerEmail = ((booking.businesses as any)?.owner_email || '').toLowerCase().trim();
    const userEmail = (user.email || '').toLowerCase().trim();
    const isBusinessOwner = ownerID === user.id || (!!ownerEmail && !!userEmail && ownerEmail === userEmail);
    const isCustomer = booking.user_id === user.id;
    const consumer = booking.profiles as any;
    const businessName = (booking.businesses as any)?.name || 'Your provider';

    if (!isBusinessOwner && !isCustomer) return res.status(403).json({ error: 'Access denied' });

    // New explicit workflow actions
    if (action === 'provider_submit_completion_proof') {
      if (!isBusinessOwner) return res.status(403).json({ error: 'Only providers can submit completion proof' });
      if (!['confirmed', 'paid', 'payment_pending', 'active'].includes(booking.status)) {
        return res.status(400).json({ error: 'Booking must be confirmed before completion proof can be submitted' });
      }
      if (booking.completion_proof_submitted_at) {
        return res.status(400).json({ error: 'Completion proof already submitted and locked for this booking' });
      }

      const proofNote = cleanText(req.body?.proof_note, 1000);
      const proofPhotos = cleanUrlArray(req.body?.proof_photo_urls, 8);
      if (!proofNote && proofPhotos.length === 0) {
        return res.status(400).json({ error: 'At least one proof item is required (photo or note)' });
      }

      const geoMeta = req.body?.geo_metadata && typeof req.body.geo_metadata === 'object'
        ? req.body.geo_metadata
        : null;

      const nowIso = new Date().toISOString();
      const dueDate = new Date(Date.now() + parseConfirmationWindowHours() * 60 * 60 * 1000).toISOString();

      const { data: updated, error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'completed',
          completed_at: nowIso,
          consumer_confirmation_mode: 'provider_auto_completed',
          completion_proof_note: proofNote || null,
          completion_proof_photo_urls: proofPhotos,
          completion_proof_geo_metadata: geoMeta,
          completion_proof_submitted_at: nowIso,
          completion_proof_submitted_by: user.id,
          consumer_confirmation_due_at: dueDate,
          disputed_at: null,
          dispute_reason: null,
          dispute_details: null,
          dispute_media_urls: null,
        })
        .eq('id', booking_id)
        .is('completion_proof_submitted_at', null)
        .select('id, status, completed_at, consumer_confirmation_due_at, completion_proof_submitted_at')
        .single();

      if (updateError || !updated) {
        return res.status(500).json({ error: 'Failed to submit completion proof' });
      }

      await sendStatusUpdateEmail(consumer?.email, {
        name: consumer?.name || 'there',
        service: booking.service,
        status: 'completed',
        businessName,
      });

      if (process.env.N8N_WEBHOOK_URL) {
        fetch(process.env.N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'booking_completed_with_dispute_window',
            bookingId: booking_id,
            consumerConfirmationDueAt: dueDate,
            timestamp: nowIso,
          }),
        }).catch(() => {});
      }

      return res.status(200).json({ success: true, booking: updated });
    }

    if (action === 'consumer_confirm_completion') {
      if (!isCustomer) return res.status(403).json({ error: 'Only customers can confirm completion' });
      if (booking.status !== 'completed' || !booking.consumer_confirmation_due_at) {
        return res.status(400).json({ error: 'Booking is not waiting for customer confirmation' });
      }
      const released = await releaseHeldFundsForBooking({
        supabase,
        bookingId: booking_id,
        reason: 'consumer_confirmed_completion',
      });
      if (!released.ok) {
        return res.status(400).json({ error: released.error || 'Could not release held funds' });
      }
      return res.status(200).json({
        success: true,
        booking: {
          id: booking_id,
          status: 'completed',
          completed_at: released.releasedAt || new Date().toISOString(),
          funds_released_at: released.releasedAt || null,
        },
      });
    }

    if (action === 'consumer_open_dispute') {
      if (!isCustomer) return res.status(403).json({ error: 'Only customers can open disputes' });
      if (booking.status !== 'completed') {
        return res.status(400).json({ error: 'Disputes can only be opened on completed bookings' });
      }
      const dueAt = booking.consumer_confirmation_due_at ? new Date(booking.consumer_confirmation_due_at).getTime() : 0;
      if (!dueAt || dueAt <= Date.now()) {
        return res.status(400).json({ error: 'Dispute window has closed' });
      }

      const reason = cleanText(req.body?.dispute_reason, 200);
      const details = cleanText(req.body?.dispute_details, 2000);
      const mediaUrls = cleanUrlArray(req.body?.dispute_media_urls, 8);
      if (!reason) return res.status(400).json({ error: 'dispute_reason is required' });

      const nowIso = new Date().toISOString();
      const { data: updated, error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'disputed',
          disputed_at: nowIso,
          dispute_reason: reason,
          dispute_details: details || null,
          dispute_media_urls: mediaUrls,
          dispute_opened_by: user.id,
        })
        .eq('id', booking_id)
        .select('id, status, disputed_at, dispute_reason')
        .single();

      if (updateError || !updated) return res.status(500).json({ error: 'Failed to open dispute' });

      await sendStatusUpdateEmail(consumer?.email, {
        name: consumer?.name || 'there',
        service: booking.service,
        status: 'disputed',
        businessName,
      });

      if (process.env.N8N_WEBHOOK_URL) {
        fetch(process.env.N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'booking_disputed',
            bookingId: booking_id,
            disputeReason: reason,
            timestamp: nowIso,
          }),
        }).catch(() => {});
      }

      return res.status(200).json({ success: true, booking: updated });
    }

    if (action === 'admin_resolve_dispute') {
      const allowedAdmins = (process.env.DISPUTE_ADMIN_EMAILS || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const isAdmin = allowedAdmins.includes((user.email || '').toLowerCase().trim());
      if (!isAdmin) return res.status(403).json({ error: 'Only dispute admins can resolve disputes' });
      if (booking.status !== 'disputed') return res.status(400).json({ error: 'Booking is not disputed' });

      const resolution = cleanText(req.body?.resolution, 60);
      if (!['release_funds', 'full_refund', 'partial_refund'].includes(resolution)) {
        return res.status(400).json({ error: 'resolution must be release_funds, full_refund, or partial_refund' });
      }

      let refund: any = null;
      if (resolution === 'full_refund') {
        refund = await refundBookingPayment({ supabase, bookingId: booking_id });
      }
      if (resolution === 'partial_refund') {
        const cents = Number(req.body?.partial_refund_cents);
        if (!Number.isFinite(cents) || cents <= 0) {
          return res.status(400).json({ error: 'partial_refund_cents must be a positive number' });
        }
        refund = await refundBookingPayment({ supabase, bookingId: booking_id, amountCents: cents });
      }
      if (resolution === 'release_funds') {
        const released = await releaseHeldFundsForBooking({
          supabase,
          bookingId: booking_id,
          reason: 'admin_release_funds',
        });
        if (!released.ok) {
          return res.status(400).json({ error: released.error || 'Could not release held funds' });
        }
      }

      const nowIso = new Date().toISOString();
      const targetStatus = resolution === 'release_funds' ? 'completed' : 'cancelled';
      const { data: updated, error: updateError } = await supabase
        .from('bookings')
        .update({
          status: targetStatus,
          dispute_resolved_at: nowIso,
          dispute_resolution: resolution,
          dispute_resolution_notes: cleanText(req.body?.resolution_notes, 1000) || null,
          completed_at: targetStatus === 'completed' ? nowIso : null,
          consumer_confirmation_due_at: null,
        })
        .eq('id', booking_id)
        .select('id, status, dispute_resolved_at, dispute_resolution')
        .single();

      if (updateError || !updated) return res.status(500).json({ error: 'Failed to resolve dispute' });
      return res.status(200).json({ success: true, booking: updated, refund });
    }

    // Legacy status patching path
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    if (isCustomer && status !== 'cancelled') {
      return res.status(403).json({ error: 'Customers can only cancel bookings' });
    }

    if (isBusinessOwner && status === 'completed') {
      return res.status(400).json({ error: 'Use provider_submit_completion_proof before marking complete' });
    }

    const { error: updateError } = await supabase.from('bookings').update({ status }).eq('id', booking_id);
    if (updateError) return res.status(500).json({ error: 'Failed to update booking' });

    let refund: { refunded: boolean; reason?: string } | null = null;
    if (status === 'cancelled' && booking.paid_at) {
        refund = await refundBookingPayment({ supabase, bookingId: booking_id });
      }

    if (consumer?.email) {
      if (status === 'completed') {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';
        fetch(`${siteUrl}/api/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-notify-secret': process.env.NOTIFY_SECRET || '' },
          body: JSON.stringify({
            type: 'review_request',
            to: consumer.email,
            name: consumer.name || 'there',
            service: booking.service,
            bookingId: booking_id,
          }),
        }).catch(() => {});
      }

      await sendStatusUpdateEmail(consumer.email, {
        name: consumer.name || 'there',
        service: booking.service,
        status,
        businessName,
      });

      if (process.env.N8N_WEBHOOK_URL) {
        fetch(process.env.N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: `booking_${status}`,
            bookingId: booking_id,
            service: booking.service,
            customerEmail: consumer.email,
            customerName: consumer.name,
            refund,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {});
      }
    }

    return res.status(200).json({ success: true, refund });
  }

  if (req.method === 'GET') {
    if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'book-get' }))) return;

    const { business_id, user_id } = req.query;
    const supabase = getSupabase();
    if (user_id) {
      if (!isValidUuid(user_id)) return res.status(400).json({ error: 'Invalid user_id' });
      const user = await requireAuth(req, res);
      if (!user) return;
      if (!(await rateLimitByPrincipal(res, user.id, { max: 60, windowMs: 60_000, keyPrefix: 'book-get-user' }))) return;
      if (user.id !== user_id) return res.status(403).json({ error: 'Access denied' });

      try {
        const candidateUserIds = new Set<string>([String(user_id), String(user.id)].filter((v) => isUuidLike(v)));
        const emailLinkedIds = await resolveUserIdsByEmail(supabase, user.email || '');
        for (const id of emailLinkedIds) candidateUserIds.add(id);
        const resolvedIds = Array.from(candidateUserIds);

        const queryByResolvedIds = (selectClause: string) =>
          supabase
            .from('bookings')
            .select(selectClause)
            .in('user_id', resolvedIds)
            .order('created_at', { ascending: false })
            .limit(100);

        let { data, error } = await supabase
          .from('bookings')
          .select('id, business_id, service, status, created_at, scheduled_start, scheduled_end, address, notes, amount_cents, paid_at, reviewed, requires_manual_action, consumer_confirmation_due_at, completion_proof_note, completion_proof_photo_urls, completion_proof_geo_metadata, completion_proof_submitted_at, disputed_at, dispute_reason, dispute_details, dispute_media_urls')
          .in('user_id', resolvedIds)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error && isMissingColumnError(error)) {
          const fallbackLegacyProof = await queryByResolvedIds('id, business_id, service, status, created_at, scheduled_start, scheduled_end, address, notes, amount_cents, paid_at, reviewed, requires_manual_action, consumer_confirmation_due_at, completion_proof_message, completion_proof_photos, completion_proof_created_at, disputed_at, dispute_reason, dispute_details, dispute_media_urls');
          data = fallbackLegacyProof.data as any;
          error = fallbackLegacyProof.error as any;
        }

        if (error && isMissingColumnError(error)) {
          const fallback = await queryByResolvedIds('id, business_id, service, status, created_at, scheduled_start, scheduled_end, address, notes, amount_cents, paid_at, reviewed, requires_manual_action');
          data = fallback.data as any;
          error = fallback.error as any;
        }

        if (error && isMissingColumnError(error)) {
          // Final compatibility fallback for legacy schemas missing `reviewed`.
          const fallbackNoReviewed = await queryByResolvedIds('id, business_id, service, status, created_at, scheduled_start, scheduled_end, address, notes, amount_cents, paid_at, requires_manual_action, consumer_confirmation_due_at, completion_proof_note, completion_proof_photo_urls, completion_proof_geo_metadata, completion_proof_submitted_at, disputed_at, dispute_reason, dispute_details, dispute_media_urls');
          data = fallbackNoReviewed.data as any;
          error = fallbackNoReviewed.error as any;
        }

        if (error && isMissingColumnError(error)) {
          const fallbackNoReviewedLegacyProof = await queryByResolvedIds('id, business_id, service, status, created_at, scheduled_start, scheduled_end, address, notes, amount_cents, paid_at, requires_manual_action, consumer_confirmation_due_at, completion_proof_message, completion_proof_photos, completion_proof_created_at, disputed_at, dispute_reason, dispute_details, dispute_media_urls');
          data = fallbackNoReviewedLegacyProof.data as any;
          error = fallbackNoReviewedLegacyProof.error as any;
        }

        if (error && isMissingColumnError(error)) {
          const fallbackMinimal = await queryByResolvedIds('id, business_id, service, status, created_at, scheduled_start, scheduled_end, address, notes, amount_cents, paid_at, requires_manual_action');
          data = fallbackMinimal.data as any;
          error = fallbackMinimal.error as any;
        }

        if (error) return res.status(500).json({ error: 'Failed to fetch bookings' });
        const businessById = await buildBusinessByIdMap(supabase, data || []);
        for (const row of data || []) {
          const dueAt = row?.consumer_confirmation_due_at ? new Date(row.consumer_confirmation_due_at).getTime() : 0;
          const needsAutoRelease =
            !!dueAt &&
            dueAt <= Date.now() &&
            !row?.disputed_at &&
            String(row?.status || '').toLowerCase() === 'completed';
          if (!needsAutoRelease) continue;
          try {
            await releaseHeldFundsForBooking({
              supabase,
              bookingId: row.id,
              reason: 'consumer_confirmation_window_expired',
            });
            row.status = 'completed';
            row.consumer_confirmation_due_at = null;
          } catch (err) {
            console.error('[bookings] failed to auto-release held funds', row?.id, err);
          }
        }

        const bookings = (data || []).map((b: any) => ({
          ...b,
          status: deriveBookingStatus(b),
          scheduled_at: b.scheduled_start ?? null,
          completion_proof_note: b.completion_proof_note ?? b.completion_proof_message ?? null,
          completion_proof_photo_urls: b.completion_proof_photo_urls ?? b.completion_proof_photos ?? [],
          completion_proof_submitted_at: b.completion_proof_submitted_at ?? b.completion_proof_created_at ?? null,
          business_name: businessById[b.business_id]?.name ?? null,
          business_phone: businessById[b.business_id]?.phone ?? null,
          business_email: businessById[b.business_id]?.owner_email ?? businessById[b.business_id]?.email ?? null,
          businesses: undefined,
        }));
        return res.status(200).json({ bookings });
      } catch {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    if (business_id) {
      if (!isValidUuid(business_id)) return res.status(400).json({ error: 'Invalid business_id' });
      const user = await requireAuth(req, res);
      if (!user) return;
      if (!(await rateLimitByPrincipal(res, user.id, { max: 60, windowMs: 60_000, keyPrefix: 'book-get-biz-user' }))) return;

      const { data: biz } = await supabase
        .from('businesses')
        .select('owner_id, owner_email')
        .eq('id', business_id)
        .maybeSingle();
      if (!biz) return res.status(404).json({ error: 'Business not found' });
      const ownerId = typeof (biz as any).owner_id === 'string' ? (biz as any).owner_id : null;
      const ownerEmail = typeof (biz as any).owner_email === 'string' ? (biz as any).owner_email.toLowerCase().trim() : '';
      const userEmail = (user.email || '').toLowerCase().trim();
      const isOwner = ownerId === user.id || (!!ownerEmail && !!userEmail && ownerEmail === userEmail);
      if (!isOwner) return res.status(403).json({ error: 'Access denied' });

      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*, profiles(name, phone, email)')
          .eq('business_id', business_id)
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) return res.status(500).json({ error: 'Failed to fetch bookings' });
        for (const row of data || []) {
          const dueAt = row?.consumer_confirmation_due_at ? new Date(row.consumer_confirmation_due_at).getTime() : 0;
          const needsAutoRelease =
            !!dueAt &&
            dueAt <= Date.now() &&
            !row?.disputed_at &&
            String(row?.status || '').toLowerCase() === 'completed';
          if (!needsAutoRelease) continue;
          try {
            await releaseHeldFundsForBooking({
              supabase,
              bookingId: row.id,
              reason: 'consumer_confirmation_window_expired',
            });
            row.status = 'completed';
            row.consumer_confirmation_due_at = null;
          } catch (err) {
            console.error('[bookings] failed to auto-release held funds', row?.id, err);
          }
        }

        const bookings = (data || []).map((row: any) => ({
          ...row,
          status: deriveBookingStatus(row),
        }));
        return res.status(200).json({ bookings });
      } catch {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    return res.status(400).json({ error: 'business_id or user_id required' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
