// @ts-nocheck
// pages/api/bookings.ts — SECURED + completion proof + consumer confirmation + disputes
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import stripe from '../../lib/stripe';
import { validateAndFilter } from '../../lib/profanity';
import { setSecurityHeaders, rateLimit, rateLimitByPrincipal, requireAuth, isValidUuid, isValidEmail } from '../../lib/apiSecurity';

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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
  return row?.status || 'pending';
}

function isMissingColumnError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  const details = String(err?.details || '').toLowerCase();
  return msg.includes('column') || msg.includes('does not exist') || details.includes('does not exist');
}

async function resolveUserIdsByEmail(supabase: ReturnType<typeof getSupabase>, email?: string | null): Promise<string[]> {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return [];
  const ids = new Set<string>();
  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', normalizedEmail)
      .limit(50);
    for (const p of profiles || []) {
      if (typeof (p as any)?.id === 'string' && (p as any).id) ids.add((p as any).id);
    }
  } catch {}
  try {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .ilike('email', normalizedEmail)
      .limit(50);
    for (const u of users || []) {
      if (typeof (u as any)?.id === 'string' && (u as any).id) ids.add((u as any).id);
    }
  } catch {}
  return Array.from(ids);
}

async function fetchBookingsForUserIds(
  supabase: ReturnType<typeof getSupabase>,
  userIds: string[]
) {
  const ids = (userIds || []).filter((v) => typeof v === 'string' && !!v);
  if (ids.length === 0) return { data: [], error: null as any };

  let query = supabase
    .from('bookings')
    .select('id, service, status, created_at, scheduled_start, scheduled_end, address, notes, amount_cents, paid_at, reviewed, consumer_confirmation_due_at, completion_proof_note, completion_proof_photo_urls, completion_proof_geo_metadata, completion_proof_submitted_at, disputed_at, dispute_reason, dispute_details, dispute_media_urls, businesses(name, phone, email, stripe_onboarded, stripe_account_id)')
    .in('user_id', ids)
    .order('created_at', { ascending: false })
    .limit(100);
  let result = await query;

  if (result.error && isMissingColumnError(result.error)) {
    result = await supabase
      .from('bookings')
      .select('id, service, status, created_at, scheduled_start, scheduled_end, address, notes, amount_cents, paid_at, consumer_confirmation_due_at, completion_proof_message, completion_proof_photos, completion_proof_created_at, disputed_at, dispute_reason, dispute_details, dispute_media_urls, businesses(name, phone, email, stripe_onboarded, stripe_account_id)')
      .in('user_id', ids)
      .order('created_at', { ascending: false })
      .limit(100);
  }

  if (result.error && isMissingColumnError(result.error)) {
    result = await supabase
      .from('bookings')
      .select('id, service, status, created_at, scheduled_start, scheduled_end, address, notes, amount_cents, paid_at, businesses(name, phone, email, stripe_onboarded, stripe_account_id)')
      .in('user_id', ids)
      .order('created_at', { ascending: false })
      .limit(100);
  }

  return result;
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

async function getPaymentIntentForBooking(bookingId: string) {
  const query = `metadata['booking_id']:'${bookingId}' AND status:'succeeded'`;
  const result = await stripe.paymentIntents.search({ query, limit: 1 });
  return result.data?.[0] || null;
}

async function refundBookingIfPaid(bookingId: string, amountCents?: number) {
  try {
    const paymentIntent = await getPaymentIntentForBooking(bookingId);
    if (!paymentIntent) return { refunded: false, reason: 'no_payment_found' };

    const existingRefunds = await stripe.refunds.list({ payment_intent: paymentIntent.id, limit: 10 });
    const alreadyRefunded = existingRefunds.data.reduce((sum, r) => sum + (r.amount || 0), 0);
    const maxRefundable = Math.max(0, (paymentIntent.amount_received || paymentIntent.amount || 0) - alreadyRefunded);
    if (maxRefundable <= 0) return { refunded: false, reason: 'already_refunded' };

    const refundAmount = typeof amountCents === 'number'
      ? Math.max(1, Math.min(maxRefundable, Math.round(amountCents)))
      : maxRefundable;

    await stripe.refunds.create({
      payment_intent: paymentIntent.id,
      amount: refundAmount,
      reason: 'requested_by_customer',
      metadata: { booking_id: bookingId },
    });

    return { refunded: true, amount_cents: refundAmount };
  } catch (err) {
    console.error('[bookings] refund failed', err);
    return { refunded: false, reason: 'refund_failed' };
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
    const authUser = req.headers.authorization ? await requireAuth(req, res) : null;
    if (req.headers.authorization && !authUser) return;

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
      if (!svcCheck.ok) return res.status(400).json({ error: svcCheck.error });
    }

    const safeAddress = typeof address === 'string' ? address.trim().slice(0, 300) : null;
    const safeNote = typeof note === 'string' ? note.trim().slice(0, 2000) : null;
    const scheduledStart = buildScheduledStart(scheduled_date, scheduled_slot, scheduled_start);
    const normalizedService = service?.slice(0, 500) ?? 'General Service';
    const normalizedServiceLower = String(normalizedService || '').toLowerCase();
    const isCustomService = normalizedServiceLower.includes('custom');

    const parsedServicePriceCents = Number(service_price_cents);
    const safeServicePriceCents = Number.isFinite(parsedServicePriceCents) && parsedServicePriceCents >= 500
      ? Math.round(parsedServicePriceCents)
      : null;
    const parsedCustomerProposedCents = Number(customer_proposed_price_cents);
    const safeCustomerProposedCents = Number.isFinite(parsedCustomerProposedCents) && parsedCustomerProposedCents >= 500
      ? Math.round(parsedCustomerProposedCents)
      : null;

    try {
      const supabase = getSupabase();

      const { data: businessRow } = await supabase
        .from('businesses')
        .select('id, availability_status, stripe_onboarded, stripe_account_id')
        .eq('id', business_id)
        .maybeSingle();
      if (!businessRow) return res.status(404).json({ error: 'Provider not found' });
      const availabilityStatus = String((businessRow as any).availability_status || '').trim().toLowerCase();
      if (availabilityStatus && availabilityStatus !== 'open') {
        return res.status(409).json({
          error: `Provider is currently ${availabilityStatus} and not accepting bookings.`,
        });
      }
      if (!isCustomService) {
        const canAcceptPayments = !!(businessRow as any).stripe_account_id;
        if (!canAcceptPayments) {
          return res.status(409).json({ error: 'This provider can’t accept payments yet.' });
        }
      }

      let resolvedUserId = user_id;
      if (authUser?.id) {
        if (resolvedUserId && resolvedUserId !== authUser.id) {
          return res.status(403).json({ error: 'Authenticated user does not match booking user_id' });
        }
        resolvedUserId = authUser.id;
        await supabase
          .from('profiles')
          .upsert(
            {
              id: authUser.id,
              email: user_email || authUser.email || null,
              name: user_name?.slice(0, 100) || null,
              phone: user_phone?.slice(0, 20) || null,
            },
            { onConflict: 'id' }
          );
      } else if (!resolvedUserId && user_email) {
        const { data: userData } = await supabase
          .from('profiles')
          .upsert(
            {
              email: user_email,
              name: user_name?.slice(0, 100),
              phone: user_phone?.slice(0, 20),
            },
            { onConflict: 'email' }
          )
          .select('id')
          .single();
        resolvedUserId = userData?.id;
      }

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          business_id,
          user_id: resolvedUserId ?? null,
          service: normalizedService,
          status: isCustomService ? 'pending' : 'payment_pending',
          requires_manual_action: true,
          amount_cents: isCustomService ? null : safeServicePriceCents,
          customer_proposed_price_cents: isCustomService ? safeCustomerProposedCents : null,
          notes: safeNote,
          address: safeAddress,
          scheduled_start: scheduledStart,
        })
        .select('id, status, created_at, amount_cents, address, notes, scheduled_start')
        .single();

      if (error) return res.status(500).json({ error: 'Failed to create booking' });

      // Only notify provider immediately for custom requests.
      // Standard priced bookings notify after payment succeeds.
      if (isCustomService) notifyNewBooking(data.id, supabase);

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
    const isBusinessOwner = ownerID === user.id || (!ownerID && !!ownerEmail && !!userEmail && ownerEmail === userEmail);
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
      return res.status(400).json({ error: 'This booking flow auto-completes when provider submits proof' });
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
        refund = await refundBookingIfPaid(booking_id);
      }
      if (resolution === 'partial_refund') {
        const cents = Number(req.body?.partial_refund_cents);
        if (!Number.isFinite(cents) || cents <= 0) {
          return res.status(400).json({ error: 'partial_refund_cents must be a positive number' });
        }
        refund = await refundBookingIfPaid(booking_id, cents);
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
      refund = await refundBookingIfPaid(booking_id);
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
        let { data, error } = await supabase
          .from('bookings')
          .select('id, service, status, created_at, scheduled_start, scheduled_end, address, notes, amount_cents, paid_at, reviewed, consumer_confirmation_due_at, completion_proof_note, completion_proof_photo_urls, completion_proof_geo_metadata, completion_proof_submitted_at, disputed_at, dispute_reason, dispute_details, dispute_media_urls, businesses(name, phone, email, stripe_onboarded, stripe_account_id)')
          .eq('user_id', user_id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error && isMissingColumnError(error)) {
          const fallbackLegacyProof = await supabase
            .from('bookings')
            .select('id, service, status, created_at, scheduled_start, scheduled_end, address, notes, amount_cents, paid_at, consumer_confirmation_due_at, completion_proof_message, completion_proof_photos, completion_proof_created_at, disputed_at, dispute_reason, dispute_details, dispute_media_urls, businesses(name, phone, email, stripe_onboarded, stripe_account_id)')
            .eq('user_id', user_id)
            .order('created_at', { ascending: false })
            .limit(100);
          data = fallbackLegacyProof.data as any;
          error = fallbackLegacyProof.error as any;
        }

        if (error && isMissingColumnError(error)) {
          const fallback = await supabase
            .from('bookings')
            .select('id, service, status, created_at, scheduled_start, scheduled_end, address, notes, amount_cents, paid_at, businesses(name, phone, email, stripe_onboarded, stripe_account_id)')
            .eq('user_id', user_id)
            .order('created_at', { ascending: false })
            .limit(100);
          data = fallback.data as any;
          error = fallback.error as any;
        }

        if (error) return res.status(500).json({ error: 'Failed to fetch bookings' });
        if ((!data || data.length === 0) && user.email) {
          const altIds = await resolveUserIdsByEmail(supabase, user.email);
          const mergedIds = Array.from(new Set([String(user_id), user.id, ...altIds].filter(Boolean)));
          if (mergedIds.length > 0) {
            const altQuery = await fetchBookingsForUserIds(supabase, mergedIds);
            if (!altQuery.error && altQuery.data) data = altQuery.data as any;
          }
        }
        const bookings = (data || []).map((b: any) => ({
          ...b,
          status: deriveBookingStatus(b),
          scheduled_at: b.scheduled_start ?? null,
          completion_proof_note: b.completion_proof_note ?? b.completion_proof_message ?? null,
          completion_proof_photo_urls: b.completion_proof_photo_urls ?? b.completion_proof_photos ?? [],
          completion_proof_submitted_at: b.completion_proof_submitted_at ?? b.completion_proof_created_at ?? null,
          business_name: b.businesses?.name ?? null,
          business_phone: b.businesses?.phone ?? null,
          business_email: b.businesses?.email ?? null,
          business_stripe_onboarded: b.businesses?.stripe_onboarded ?? null,
          business_stripe_account_id: b.businesses?.stripe_account_id ?? null,
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
      const isOwner = ownerId === user.id || (!ownerId && !!ownerEmail && !!userEmail && ownerEmail === userEmail);
      if (!isOwner) return res.status(403).json({ error: 'Access denied' });

      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*, profiles(name, phone, email)')
          .eq('business_id', business_id)
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) return res.status(500).json({ error: 'Failed to fetch bookings' });
        const bookings = (data || []).map((row: any) => ({
          ...row,
          status: deriveBookingStatus(row),
        }));
        return res.status(200).json({ bookings });
      } catch {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    // Fallback: if caller is authenticated, return their own bookings even
    // when user_id is omitted (defensive compatibility with older clients).
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!(await rateLimitByPrincipal(res, user.id, { max: 60, windowMs: 60_000, keyPrefix: 'book-get-user-fallback' }))) return;

    try {
      let { data, error } = await supabase
        .from('bookings')
        .select('id, service, status, created_at, scheduled_start, scheduled_end, address, notes, amount_cents, paid_at, reviewed, consumer_confirmation_due_at, completion_proof_note, completion_proof_photo_urls, completion_proof_geo_metadata, completion_proof_submitted_at, disputed_at, dispute_reason, dispute_details, dispute_media_urls, businesses(name, phone, email, stripe_onboarded, stripe_account_id)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error && isMissingColumnError(error)) {
        const fallbackLegacyProof = await supabase
          .from('bookings')
          .select('id, service, status, created_at, scheduled_start, scheduled_end, address, notes, amount_cents, paid_at, consumer_confirmation_due_at, completion_proof_message, completion_proof_photos, completion_proof_created_at, disputed_at, dispute_reason, dispute_details, dispute_media_urls, businesses(name, phone, email, stripe_onboarded, stripe_account_id)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100);
        data = fallbackLegacyProof.data as any;
        error = fallbackLegacyProof.error as any;
      }

      if (error && isMissingColumnError(error)) {
        const fallback = await supabase
          .from('bookings')
          .select('id, service, status, created_at, scheduled_start, scheduled_end, address, notes, amount_cents, paid_at, businesses(name, phone, email, stripe_onboarded, stripe_account_id)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100);
        data = fallback.data as any;
        error = fallback.error as any;
      }

      if (error) return res.status(500).json({ error: 'Failed to fetch bookings' });
      if ((!data || data.length === 0) && user.email) {
        const altIds = await resolveUserIdsByEmail(supabase, user.email);
        const mergedIds = Array.from(new Set([user.id, ...altIds].filter(Boolean)));
        if (mergedIds.length > 0) {
          const altQuery = await fetchBookingsForUserIds(supabase, mergedIds);
          if (!altQuery.error && altQuery.data) data = altQuery.data as any;
        }
      }
      const bookings = (data || []).map((b: any) => ({
        ...b,
        status: deriveBookingStatus(b),
        scheduled_at: b.scheduled_start ?? null,
        completion_proof_note: b.completion_proof_note ?? b.completion_proof_message ?? null,
        completion_proof_photo_urls: b.completion_proof_photo_urls ?? b.completion_proof_photos ?? [],
        completion_proof_submitted_at: b.completion_proof_submitted_at ?? b.completion_proof_created_at ?? null,
        business_name: b.businesses?.name ?? null,
        business_phone: b.businesses?.phone ?? null,
        business_email: b.businesses?.email ?? null,
        business_stripe_onboarded: b.businesses?.stripe_onboarded ?? null,
        business_stripe_account_id: b.businesses?.stripe_account_id ?? null,
        businesses: undefined,
      }));
      return res.status(200).json({ bookings });
    } catch {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
