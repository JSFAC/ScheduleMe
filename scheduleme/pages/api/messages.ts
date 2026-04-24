// pages/api/messages.ts — SECURED
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { filterMessage } from '../../lib/profanity';
import { moderateUserText, hasHardModerationSignal } from '../../lib/openaiModeration';
import { setSecurityHeaders, rateLimit, rateLimitByPrincipal, requireAuth, isValidUuid } from '../../lib/apiSecurity';
import { canUserTransactWithStudentProvider, isProviderPubliclyVisible } from '../../lib/providerTrust';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
  if (!url || !key) throw new Error('Missing env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

function isBusinessOwnerForUser(business: any, user: { id: string; email: string }): boolean {
  const ownerID = typeof business?.owner_id === 'string' ? business.owner_id : null;
  if (ownerID) return ownerID === user.id;

  // Legacy fallback only when owner_id is missing.
  const ownerEmail = typeof business?.owner_email === 'string' ? business.owner_email.toLowerCase().trim() : '';
  const userEmail = (user.email || '').toLowerCase().trim();
  return !!ownerEmail && !!userEmail && ownerEmail === userEmail;
}

function parsePageSize(rawLimit: unknown, defaultSize = 40): number {
  const parsedLimit = Number(Array.isArray(rawLimit) ? rawLimit[0] : rawLimit);
  return Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(Math.floor(parsedLimit), 100)
    : defaultSize;
}

function parseCursor(rawValue: unknown): string | null {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (typeof value !== 'string') return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

async function fetchThreadMessages(params: {
  supabase: ReturnType<typeof getSupabase>;
  bookingIDs: string[];
  pageSize: number;
  before: string | null;
  after: string | null;
}) {
  const { supabase, bookingIDs, pageSize, before, after } = params;
  let query = supabase
    .from('messages')
    .select('id, booking_id, sender_type, content, image_url, message_type, read, created_at')
    .in('booking_id', bookingIDs);

  if (after) {
    query = query
      .gt('created_at', after)
      .order('created_at', { ascending: true })
      .limit(pageSize);
  } else if (before) {
    query = query
      .lt('created_at', before)
      .order('created_at', { ascending: false })
      .limit(pageSize + 1);
  } else {
    query = query
      .order('created_at', { ascending: false })
      .limit(pageSize + 1);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (before) {
    const hasMore = (data?.length ?? 0) > pageSize;
    const trimmed = (data ?? []).slice(0, pageSize).reverse();
    return { messages: trimmed, hasMore };
  }

  if (!after) {
    const hasMore = (data?.length ?? 0) > pageSize;
    const normalized = (data ?? []).slice(0, pageSize).reverse();
    return { messages: normalized, hasMore };
  }

  return { messages: data ?? [], hasMore: false };
}

async function buildThreadSummary(params: {
  supabase: ReturnType<typeof getSupabase>;
  bookingRows: any[];
  unreadSenderType: 'user' | 'business';
}) {
  const { supabase, bookingRows, unreadSenderType } = params;
  const bookingIDs = bookingRows.map((row) => row.id).filter(Boolean);
  if (!bookingIDs.length) return null;

  const { data: latestMessage } = await supabase
    .from('messages')
    .select('id, booking_id, sender_type, content, image_url, message_type, read, created_at')
    .in('booking_id', bookingIDs)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .in('booking_id', bookingIDs)
    .eq('read', false)
    .eq('sender_type', unreadSenderType);

  const latestBooking = bookingRows[0];
  const business = latestBooking?.businesses || null;
  const latestDate = latestMessage?.created_at || latestBooking?.created_at || new Date().toISOString();

  return {
    id: latestBooking?.business_id || latestBooking?.id,
    business_id: latestBooking?.business_id || null,
    booking_id: latestBooking?.id || null,
    booking_ids: bookingIDs,
    service: latestBooking?.service || 'Conversation',
    status: latestBooking?.status || 'pending',
    created_at: latestDate,
    businesses: business
      ? {
          id: latestBooking?.business_id || business.id || null,
          name: business.name || null,
          phone: business.phone || null,
        }
      : null,
    lastMessage: latestMessage || null,
    unreadCount: count ?? 0,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);

  // GET — fetch messages or threads
  if (req.method === 'GET') {
    // Rate limit: 60 reads/min per IP
    if (!(await rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'msg-get' }))) return;

    const user = await requireAuth(req, res);
    if (!user) return;
    if (!(await rateLimitByPrincipal(res, user.id, { max: 120, windowMs: 60_000, keyPrefix: 'msg-get-user' }))) return;

    const { booking_id, user_id, business_id, thread_business_id, thread_customer_id, before, after, limit } = req.query;
    const supabase = getSupabase();

    if (booking_id) {
      if (!isValidUuid(booking_id)) return res.status(400).json({ error: 'Invalid booking_id' });

      // Verify caller is party to this booking
      const { data: booking } = await supabase
        .from('bookings')
        .select('user_id, business_id, businesses(owner_id, owner_email)')
        .eq('id', booking_id)
        .maybeSingle();

      if (!booking) return res.status(404).json({ error: 'Booking not found' });

      const isUser = booking.user_id === user.id;
      const isBiz = isBusinessOwnerForUser(booking.businesses, user);
      if (!isUser && !isBiz) return res.status(403).json({ error: 'Access denied' });

      const pageSize = parsePageSize(limit);
      const validBefore = parseCursor(before);
      const validAfter = parseCursor(after);

      try {
        const payload = await fetchThreadMessages({
          supabase,
          bookingIDs: [booking_id as string],
          pageSize,
          before: validBefore,
          after: validAfter,
        });
        return res.status(200).json({
          messages: payload.messages,
          has_more: payload.hasMore,
          thread: {
            id: booking_id,
            business_id: booking.business_id || null,
            booking_id: booking_id,
            booking_ids: [booking_id],
            service: 'Conversation',
            status: 'pending',
            created_at: (payload.messages[payload.messages.length - 1]?.created_at)
              || payload.messages[0]?.created_at
              || new Date().toISOString(),
            businesses: null,
            unreadCount: 0,
          },
        });
      } catch {
        return res.status(500).json({ error: 'Failed to fetch messages' });
      }
    }

    if (thread_business_id) {
      if (!isValidUuid(thread_business_id)) return res.status(400).json({ error: 'Invalid thread_business_id' });

      const { data: business } = await supabase
        .from('businesses')
        .select('id, owner_id, owner_email, name, phone')
        .eq('id', thread_business_id)
        .maybeSingle();

      if (!business) return res.status(404).json({ error: 'Business not found' });

      const isOwner = isBusinessOwnerForUser(business, user);
      let bookingsQuery = supabase
        .from('bookings')
        .select('id, business_id, service, status, created_at, businesses(id, name, phone)')
        .eq('business_id', thread_business_id)
        .order('created_at', { ascending: false });

      if (!isOwner) {
        bookingsQuery = bookingsQuery.eq('user_id', user.id);
      }

      const { data: businessBookings, error: bookingsError } = await bookingsQuery;
      if (bookingsError) return res.status(500).json({ error: 'Failed to load thread bookings' });
      if (!businessBookings?.length) return res.status(404).json({ error: 'Conversation not found' });

      const pageSize = parsePageSize(limit);
      const validBefore = parseCursor(before);
      const validAfter = parseCursor(after);
      const bookingIDs = businessBookings.map((row: any) => row.id);

      try {
        const payload = await fetchThreadMessages({
          supabase,
          bookingIDs,
          pageSize,
          before: validBefore,
          after: validAfter,
        });
        const thread = await buildThreadSummary({
          supabase,
          bookingRows: businessBookings,
          unreadSenderType: isOwner ? 'user' : 'business',
        });

        return res.status(200).json({
          messages: payload.messages,
          has_more: payload.hasMore,
          thread,
        });
      } catch {
        return res.status(500).json({ error: 'Failed to fetch messages' });
      }
    }

    if (thread_customer_id) {
      const threadCustomerID = Array.isArray(thread_customer_id) ? thread_customer_id[0] : thread_customer_id;
      const businessID = Array.isArray(business_id) ? business_id[0] : business_id;
      if (!isValidUuid(threadCustomerID)) return res.status(400).json({ error: 'Invalid thread_customer_id' });
      if (!isValidUuid(businessID)) return res.status(400).json({ error: 'Invalid business_id' });

      const { data: biz } = await supabase
        .from('businesses')
        .select('id, owner_id, owner_email')
        .eq('id', businessID)
        .maybeSingle();
      if (!biz) return res.status(404).json({ error: 'Business not found' });
      if (!isBusinessOwnerForUser(biz, user)) return res.status(403).json({ error: 'Access denied' });

      const { data: customerBookings, error: customerBookingsError } = await supabase
        .from('bookings')
        .select('id, user_id, service, status, created_at, profiles(id, name, email, phone, avatar_url)')
        .eq('business_id', businessID)
        .eq('user_id', threadCustomerID)
        .order('created_at', { ascending: false });
      if (customerBookingsError) return res.status(500).json({ error: 'Failed to load conversation bookings' });
      if (!customerBookings?.length) return res.status(404).json({ error: 'Conversation not found' });

      const bookingIDs = customerBookings.map((b: any) => b.id).filter(Boolean);
      const pageSize = parsePageSize(limit);
      const validBefore = parseCursor(before);
      const validAfter = parseCursor(after);

      try {
        const payload = await fetchThreadMessages({
          supabase,
          bookingIDs,
          pageSize,
          before: validBefore,
          after: validAfter,
        });

        const { data: latestMessage } = await supabase
          .from('messages')
          .select('id, booking_id, sender_type, content, image_url, message_type, read, created_at')
          .in('booking_id', bookingIDs)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('booking_id', bookingIDs)
          .eq('read', false)
          .eq('sender_type', 'user');

        const latestBooking = customerBookings[0];
        return res.status(200).json({
          messages: payload.messages,
          has_more: payload.hasMore,
          thread: {
            id: threadCustomerID,
            customer_id: threadCustomerID,
            business_id: businessID,
            booking_id: latestBooking?.id || null,
            booking_ids: bookingIDs,
            service: latestBooking?.service || 'Conversation',
            status: latestBooking?.status || 'pending',
            created_at: latestMessage?.created_at || latestBooking?.created_at || new Date().toISOString(),
            profiles: latestBooking?.profiles || null,
            lastMessage: latestMessage || null,
            unreadCount: count ?? 0,
          },
        });
      } catch {
        return res.status(500).json({ error: 'Failed to fetch conversation messages' });
      }
    }

    if (user_id) {
      if (!isValidUuid(user_id)) return res.status(400).json({ error: 'Invalid user_id' });
      // Can only fetch your own threads
      if (user_id !== user.id) return res.status(403).json({ error: 'Access denied' });

      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, business_id, service, status, created_at, businesses(id, name, phone)')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false });

      const grouped = new Map<string, any[]>();
      for (const booking of bookings || []) {
        const key = booking.business_id || booking.id;
        const current = grouped.get(key) || [];
        current.push(booking);
        grouped.set(key, current);
      }

      const threads = await Promise.all(
        Array.from(grouped.values()).map(async (group) => {
          const sorted = [...group].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          return buildThreadSummary({
            supabase,
            bookingRows: sorted,
            unreadSenderType: 'business',
          });
        })
      );

      return res.status(200).json({
        threads: threads
          .filter(Boolean)
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      });
    }

    if (business_id) {
      if (!isValidUuid(business_id)) return res.status(400).json({ error: 'Invalid business_id' });

      // Verify caller owns this business
      const { data: biz } = await supabase.from('businesses')
        .select('owner_id, owner_email').eq('id', business_id).maybeSingle();
      if (!biz) return res.status(404).json({ error: 'Business not found' });
      const isOwner = isBusinessOwnerForUser(biz, user);
      if (!isOwner) return res.status(403).json({ error: 'Access denied' });

      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, user_id, service, status, created_at, profiles(id, name, email, phone, avatar_url)')
        .eq('business_id', business_id)
        .order('created_at', { ascending: false });

      const grouped = new Map<string, any[]>();
      for (const booking of bookings || []) {
        const key = booking?.user_id || booking?.profiles?.id || booking?.profiles?.email || booking?.id;
        if (!key) continue;
        const current = grouped.get(key) || [];
        current.push(booking);
        grouped.set(key, current);
      }

      const threads = await Promise.all(Array.from(grouped.entries()).map(async ([customerId, rows]) => {
        const sorted = [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const bookingIDs = sorted.map((r: any) => r.id).filter(Boolean);
        const latestBooking = sorted[0];
        const customerUUID = sorted.find((r: any) => isValidUuid(r?.user_id))?.user_id
          || sorted.find((r: any) => isValidUuid(r?.profiles?.id))?.profiles?.id
          || null;
        const threadID = customerUUID || `booking:${latestBooking?.id || customerId}`;
        const { data: msgs } = await supabase
          .from('messages')
          .select('id, sender_type, content, image_url, message_type, created_at')
          .in('booking_id', bookingIDs)
          .order('created_at', { ascending: false })
          .limit(1);
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('booking_id', bookingIDs)
          .eq('read', false)
          .eq('sender_type', 'user');

        return {
          id: threadID,
          customer_id: customerUUID,
          business_id,
          booking_id: latestBooking?.id || null,
          booking_ids: bookingIDs,
          service: latestBooking?.service || 'Conversation',
          status: latestBooking?.status || 'pending',
          created_at: latestBooking?.created_at || new Date().toISOString(),
          profiles: latestBooking?.profiles || null,
          lastMessage: msgs?.[0] ?? null,
          unreadCount: count ?? 0,
        };
      }));
      return res.status(200).json({
        threads: threads.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      });
    }

    return res.status(400).json({ error: 'booking_id, user_id, or business_id required' });
  }

  // POST — send a message
  if (req.method === 'POST') {
    // Rate limit: 30 messages/min per IP (prevents flooding)
    if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'msg-post' }))) return;

    const user = await requireAuth(req, res);
    if (!user) return;
    if (!(await rateLimitByPrincipal(res, user.id, { max: 60, windowMs: 60_000, keyPrefix: 'msg-post-user' }))) return;

    const { booking_id, sender_type, content, image_url, message_type } = req.body;

    if (!booking_id || !sender_type || !content)
      return res.status(400).json({ error: 'booking_id, sender_type, content required' });
    if (!isValidUuid(booking_id)) return res.status(400).json({ error: 'Invalid booking_id' });
    if (!['user', 'business'].includes(sender_type))
      return res.status(400).json({ error: 'sender_type must be user or business' });
    if (typeof content !== 'string') return res.status(400).json({ error: 'Invalid content' });
    if (image_url !== undefined && image_url !== null && typeof image_url !== 'string') {
      return res.status(400).json({ error: 'Invalid image_url' });
    }
    if (message_type !== undefined && message_type !== null && !['text', 'image', 'video'].includes(String(message_type))) {
      return res.status(400).json({ error: 'Invalid message_type' });
    }

    const supabase = getSupabase();

    // Verify caller is party to this booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('user_id, business_id, businesses(owner_id, owner_email, is_onboarded, public_visibility, trust_status, trust_flagged, approved_at, published_at, campus_provider, edu_verified, school_domain, campus_key)')
      .eq('id', booking_id)
      .maybeSingle();

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const isUser = booking.user_id === user.id && sender_type === 'user';
    const isBiz = isBusinessOwnerForUser(booking.businesses, user) && sender_type === 'business';
    if (!isUser && !isBiz) return res.status(403).json({ error: 'Access denied' });

    if (sender_type === 'user') {
      if (!isProviderPubliclyVisible(booking.businesses)) {
        return res.status(403).json({ error: 'This provider is currently unavailable for messaging.' });
      }
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('edu_verified, school_domain, school_email, campus_key')
        .eq('id', user.id)
        .maybeSingle();
      const eligibility = canUserTransactWithStudentProvider({
        business: booking.businesses,
        profile: profileRow,
      });
      if (!eligibility.ok) {
        return res.status(403).json({
          error: eligibility.message || 'EDU verification required.',
          code: eligibility.code || 'edu_verification_required',
        });
      }
    }

    // Respect user/business blocks for this conversation.
    if (booking.business_id && booking.user_id) {
      const { data: blockRow } = await supabase
        .from('blocks')
        .select('id, blocked_by')
        .eq('business_id', booking.business_id)
        .eq('user_id', booking.user_id)
        .maybeSingle();
      if (blockRow) {
        return res.status(403).json({
          error: blockRow.blocked_by === 'user'
            ? 'You blocked this business. Unblock to continue messaging.'
            : 'Messaging is unavailable for this conversation.',
        });
      }
    }

    // Filter profanity / threats
    const filtered = filterMessage(content.trim());
    if (!filtered.ok) return res.status(400).json({ error: filtered.error });

    // OpenAI moderation (free endpoint) for text safety.
    const moderation = await moderateUserText(filtered.filtered);
    const hasHardSignal = hasHardModerationSignal(moderation.flaggedCategories);
    if (!moderation.ok && hasHardSignal) {
      return res.status(400).json({
        error: 'Message blocked by safety filters. Please revise and try again.',
        categories: moderation.flaggedCategories,
      });
    }

    const trimmedImageURL = typeof image_url === 'string' ? image_url.trim() : '';
    let normalizedMessageType = typeof message_type === 'string' ? message_type.trim().toLowerCase() : '';
    if (!normalizedMessageType) normalizedMessageType = trimmedImageURL ? 'image' : 'text';
    if (trimmedImageURL) {
      if (trimmedImageURL.length > 2048) {
        return res.status(400).json({ error: 'image_url too long' });
      }
      try {
        const parsed = new URL(trimmedImageURL);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return res.status(400).json({ error: 'image_url must be http or https' });
        }
      } catch {
        return res.status(400).json({ error: 'Invalid image_url' });
      }
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        booking_id,
        sender_type,
        content: filtered.filtered,
        image_url: trimmedImageURL || null,
        message_type: normalizedMessageType,
        read: false,
      })
      .select('id, booking_id, sender_type, content, image_url, message_type, read, created_at')
      .single();
    if (error) return res.status(500).json({ error: 'Failed to send message' });
    return res.status(200).json({ message: data });
  }

  // PATCH — mark messages as read
  if (req.method === 'PATCH') {
    if (!(await rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'msg-patch' }))) return;

    const user = await requireAuth(req, res);
    if (!user) return;
    if (!(await rateLimitByPrincipal(res, user.id, { max: 120, windowMs: 60_000, keyPrefix: 'msg-patch-user' }))) return;

    const { booking_id, reader_type } = req.body;
    if (!isValidUuid(booking_id)) return res.status(400).json({ error: 'Invalid booking_id' });
    if (!['user', 'business'].includes(reader_type))
      return res.status(400).json({ error: 'Invalid reader_type' });

    const supabase = getSupabase();
    const { data: booking } = await supabase
      .from('bookings')
      .select('user_id, businesses(owner_id, owner_email)')
      .eq('id', booking_id)
      .maybeSingle();

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const isUser = booking.user_id === user.id;
    const isBusiness = isBusinessOwnerForUser(booking.businesses, user);
    if (!isUser && !isBusiness) return res.status(403).json({ error: 'Access denied' });

    // Prevent reader_type spoofing.
    if ((isUser && reader_type !== 'user') || (isBusiness && reader_type !== 'business')) {
      return res.status(403).json({ error: 'reader_type does not match authenticated role' });
    }

    await supabase.from('messages').update({ read: true })
      .eq('booking_id', booking_id).neq('sender_type', reader_type);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
