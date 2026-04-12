// pages/api/messages.ts — SECURED
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { filterMessage } from '../../lib/profanity';
import { moderateUserText, hasHardModerationSignal } from '../../lib/openaiModeration';
import { setSecurityHeaders, rateLimit, rateLimitByPrincipal, requireAuth, isValidUuid } from '../../lib/apiSecurity';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);

  // GET — fetch messages or threads
  if (req.method === 'GET') {
    // Rate limit: 60 reads/min per IP
    if (!(await rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'msg-get' }))) return;

    const user = await requireAuth(req, res);
    if (!user) return;
    if (!(await rateLimitByPrincipal(res, user.id, { max: 120, windowMs: 60_000, keyPrefix: 'msg-get-user' }))) return;

    const { booking_id, user_id, business_id, before, after, limit } = req.query;
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

      const parsedLimit = Number(Array.isArray(limit) ? limit[0] : limit);
      const pageSize = Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(Math.floor(parsedLimit), 100)
        : 40;
      const beforeValue = Array.isArray(before) ? before[0] : before;
      const afterValue = Array.isArray(after) ? after[0] : after;
      const validBefore = typeof beforeValue === 'string' && !Number.isNaN(Date.parse(beforeValue)) ? beforeValue : null;
      const validAfter = typeof afterValue === 'string' && !Number.isNaN(Date.parse(afterValue)) ? afterValue : null;

      let query = supabase
        .from('messages')
        .select('id, booking_id, sender_type, content, image_url, message_type, read, created_at')
        .eq('booking_id', booking_id);

      if (validAfter) {
        query = query
          .gt('created_at', validAfter)
          .order('created_at', { ascending: true })
          .limit(pageSize);
      } else if (validBefore) {
        query = query
          .lt('created_at', validBefore)
          .order('created_at', { ascending: false })
          .limit(pageSize + 1);
      } else {
        query = query
          .order('created_at', { ascending: true });
      }

      const { data, error } = await query;
      if (error) return res.status(500).json({ error: 'Failed to fetch messages' });

      if (validBefore) {
        const hasMore = (data?.length ?? 0) > pageSize;
        const trimmed = (data ?? []).slice(0, pageSize).reverse();
        return res.status(200).json({ messages: trimmed, has_more: hasMore });
      }

      return res.status(200).json({ messages: data ?? [], has_more: false });
    }

    if (user_id) {
      if (!isValidUuid(user_id)) return res.status(400).json({ error: 'Invalid user_id' });
      // Can only fetch your own threads
      if (user_id !== user.id) return res.status(403).json({ error: 'Access denied' });

      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, service, status, created_at, businesses(id, name, phone)')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false });

      const threads = await Promise.all((bookings || []).map(async (b: any) => {
        const { data: msgs } = await supabase.from('messages')
          .select('id, sender_type, content, image_url, message_type, created_at')
          .eq('booking_id', b.id).order('created_at', { ascending: false }).limit(1);
        const { count } = await supabase.from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('booking_id', b.id).eq('read', false).eq('sender_type', 'business');
        return { ...b, lastMessage: msgs?.[0] ?? null, unreadCount: count ?? 0 };
      }));
      return res.status(200).json({ threads });
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
        .select('id, service, status, created_at, profiles(id, name, email, phone)')
        .eq('business_id', business_id)
        .order('created_at', { ascending: false });

      const threads = await Promise.all((bookings || []).map(async (b: any) => {
        const { data: msgs } = await supabase.from('messages')
          .select('id, sender_type, content, image_url, message_type, created_at')
          .eq('booking_id', b.id).order('created_at', { ascending: false }).limit(1);
        const { count } = await supabase.from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('booking_id', b.id).eq('read', false).eq('sender_type', 'user');
        return { ...b, lastMessage: msgs?.[0] ?? null, unreadCount: count ?? 0 };
      }));
      return res.status(200).json({ threads });
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
      .select('user_id, business_id, businesses(owner_id, owner_email)')
      .eq('id', booking_id)
      .maybeSingle();

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const isUser = booking.user_id === user.id && sender_type === 'user';
    const isBiz = isBusinessOwnerForUser(booking.businesses, user) && sender_type === 'business';
    if (!isUser && !isBiz) return res.status(403).json({ error: 'Access denied' });

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
