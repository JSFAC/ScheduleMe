// pages/api/messages.ts — SECURED
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { filterMessage } from '../../lib/profanity';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);

  // GET — fetch messages or threads
  if (req.method === 'GET') {
    // Rate limit: 60 reads/min per IP
    if (!rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'msg-get' })) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    const { booking_id, user_id, business_id } = req.query;
    const supabase = getSupabase();

    const { thread_business_id } = req.query;

    if (thread_business_id) {
      if (!isValidUuid(thread_business_id)) return res.status(400).json({ error: 'Invalid business_id' });

      // Resolve all user ids (auth, profile, legacy)
      const ids = new Set([user.id]);
      if (user.email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        if (profile?.id) ids.add(profile.id);
        try {
          const { data: legacyUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();
          if (legacyUser?.id) ids.add(legacyUser.id);
        } catch {}
      }
      const idList = Array.from(ids).filter(Boolean);

      // Fetch bookings for this user + business
      let bookings = [] as any[];
      if (idList.length > 1) {
        const resq = await supabase
          .from('bookings')
          .select('id, service, status, created_at, businesses(id, name, phone)')
          .eq('business_id', thread_business_id)
          .in('user_id', idList)
          .order('created_at', { ascending: false });
        bookings = resq.data || [];
      } else {
        const resq = await supabase
          .from('bookings')
          .select('id, service, status, created_at, businesses(id, name, phone)')
          .eq('business_id', thread_business_id)
          .eq('user_id', idList[0])
          .order('created_at', { ascending: false });
        bookings = resq.data || [];
      }

      if (!bookings.length) return res.status(404).json({ error: 'No bookings found' });
      const bookingIds = bookings.map(b => b.id);

      const { data, error } = await supabase
        .from('messages')
        .select('id, booking_id, sender_type, content, read, created_at')
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: true });
      if (error) return res.status(500).json({ error: 'Failed to fetch messages' });

      const latest = bookings[0];
      const thread = {
        id: thread_business_id,
        business_id: thread_business_id,
        booking_id: latest.id,
        service: latest.service,
        status: latest.status,
        created_at: latest.created_at,
        businesses: latest.businesses || null,
        lastMessage: data?.[data.length - 1] ?? null,
        unreadCount: 0,
        booking_ids: bookingIds,
      };
      return res.status(200).json({ messages: data || [], thread });
    }

    if (booking_id) {
      if (!isValidUuid(booking_id)) return res.status(400).json({ error: 'Invalid booking_id' });

      // Verify caller is party to this booking
      const { data: booking } = await supabase
        .from('bookings')
        .select('id, service, status, created_at, user_id, business_id, businesses(id, name, phone, owner_email)')
        .eq('id', booking_id)
        .maybeSingle();

      if (!booking) return res.status(404).json({ error: 'Booking not found' });

      let isUser = booking.user_id === user.id;
      const isBiz = (booking.businesses as any)?.owner_email === user.email;
      if (!isUser && user.email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        if (profile?.id && booking.user_id === profile.id) isUser = true;
        if (!isUser) {
          try {
            const { data: legacyUser } = await supabase
              .from('users')
              .select('id')
              .eq('email', user.email)
              .maybeSingle();
            if (legacyUser?.id && booking.user_id === legacyUser.id) isUser = true;
          } catch {}
        }
      }
      if (!isUser && !isBiz) return res.status(403).json({ error: 'Access denied' });

      const { data, error } = await supabase
        .from('messages')
        .select('id, booking_id, sender_type, content, read, created_at')
        .eq('booking_id', booking_id)
        .order('created_at', { ascending: true });
      if (error) return res.status(500).json({ error: 'Failed to fetch messages' });
      const thread = booking ? {
        id: (booking.businesses as any)?.id || booking.id,
        business_id: (booking.businesses as any)?.id || null,
        booking_id: booking.id,
        service: booking.service,
        status: booking.status,
        created_at: booking.created_at,
        businesses: (booking.businesses as any) ? { id: (booking.businesses as any).id, name: (booking.businesses as any).name, phone: (booking.businesses as any).phone } : null,
        lastMessage: data?.[data.length - 1] ?? null,
        unreadCount: 0,
      } : null;
      return res.status(200).json({ messages: data, thread });
    }

    if (user_id) {
      if (!isValidUuid(user_id)) return res.status(400).json({ error: 'Invalid user_id' });
      // Can only fetch your own threads
      if (user_id !== user.id) return res.status(403).json({ error: 'Access denied' });

      const ids = new Set([user.id]);
      if (user.email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        if (profile?.id) ids.add(profile.id);
        try {
          const { data: legacyUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();
          if (legacyUser?.id) ids.add(legacyUser.id);
        } catch {}
      }

      const idList = Array.from(ids).filter(Boolean);
      let bookings = [] as any[];
      if (idList.length > 1) {
        const resq = await supabase
          .from('bookings')
          .select('id, service, status, created_at, businesses(id, name, phone)')
          .in('user_id', idList)
          .order('created_at', { ascending: false });
        bookings = resq.data || [];
      } else {
        const resq = await supabase
          .from('bookings')
          .select('id, service, status, created_at, businesses(id, name, phone)')
          .eq('user_id', idList[0])
          .order('created_at', { ascending: false });
        bookings = resq.data || [];
      }

      // Group by business
      const byBiz = new Map();
      for (const b of bookings || []) {
        const bizId = b.businesses?.id;
        if (!bizId) continue;
        if (!byBiz.has(bizId)) byBiz.set(bizId, []);
        byBiz.get(bizId).push(b);
      }

      const threads = await Promise.all(Array.from(byBiz.entries()).map(async ([bizId, list]) => {
        const sorted = list.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const latest = sorted[0];
        const bookingIds = sorted.map((b: any) => b.id);
        const { data: msgs } = await supabase.from('messages')
          .select('id, sender_type, content, created_at')
          .in('booking_id', bookingIds).order('created_at', { ascending: false }).limit(1);
        const { count } = await supabase.from('messages')
          .select('*', { count: 'exact', head: true })
          .in('booking_id', bookingIds).eq('read', false).eq('sender_type', 'business');
        return {
          id: bizId,
          business_id: bizId,
          booking_id: latest.id,
          service: latest.service,
          status: latest.status,
          created_at: latest.created_at,
          businesses: latest.businesses || null,
          lastMessage: msgs?.[0] ?? null,
          unreadCount: count ?? 0,
          booking_ids: bookingIds,
        };
      }));
      return res.status(200).json({ threads });
    }

    if (business_id) {
      if (!isValidUuid(business_id)) return res.status(400).json({ error: 'Invalid business_id' });

      // Verify caller owns this business
      const { data: biz } = await supabase.from('businesses')
        .select('owner_email').eq('id', business_id).maybeSingle();
      if (!biz) return res.status(404).json({ error: 'Business not found' });
      if (biz.owner_email !== user.email) return res.status(403).json({ error: 'Access denied' });

      let bookings: any[] = [];
      const resq = await supabase
        .from('bookings')
        .select('id, service, status, created_at, user_id, profiles(id, name, email, phone)')
        .eq('business_id', business_id)
        .order('created_at', { ascending: false });
      if (resq.error) {
        const fallback = await supabase
          .from('bookings')
          .select('id, service, status, created_at, user_id')
          .eq('business_id', business_id)
          .order('created_at', { ascending: false });
        bookings = fallback.data || [];
        // Best-effort attach profile data
        for (const b of bookings) {
          if (!b.user_id) continue;
          const { data: prof } = await supabase
            .from('profiles')
            .select('id, name, email, phone')
            .eq('id', b.user_id)
            .maybeSingle();
          if (prof) b.profiles = prof;
        }
      } else {
        bookings = resq.data || [];
      }

      const threads = await Promise.all((bookings || []).map(async (b: any) => {
        const { data: msgs } = await supabase.from('messages')
          .select('id, sender_type, content, created_at')
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
    if (!rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'msg-post' })) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    const { booking_id, sender_type, content } = req.body;

    if (!booking_id || !sender_type || !content)
      return res.status(400).json({ error: 'booking_id, sender_type, content required' });
    if (!isValidUuid(booking_id)) return res.status(400).json({ error: 'Invalid booking_id' });
    if (!['user', 'business'].includes(sender_type))
      return res.status(400).json({ error: 'sender_type must be user or business' });
    if (typeof content !== 'string') return res.status(400).json({ error: 'Invalid content' });

    const supabase = getSupabase();

    // Verify caller is party to this booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('user_id, business_id, businesses(owner_email)')
      .eq('id', booking_id)
      .maybeSingle();

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    let isUser = booking.user_id === user.id && sender_type === 'user';
    const isBiz = (booking.businesses as any)?.owner_email === user.email && sender_type === 'business';
    if (!isUser && sender_type === 'user' && user.email) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();
      if (profile?.id && booking.user_id === profile.id) isUser = true;
      if (!isUser) {
        try {
          const { data: legacyUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();
          if (legacyUser?.id && booking.user_id === legacyUser.id) isUser = true;
        } catch {}
      }
    }
    if (!isUser && !isBiz) return res.status(403).json({ error: 'Access denied' });

    // Filter profanity / threats
    const filtered = filterMessage(content.trim());
    if (!filtered.ok) return res.status(400).json({ error: filtered.error });

    const { data, error } = await supabase
      .from('messages')
      .insert({ booking_id, sender_type, content: filtered.filtered, read: false })
      .select('id, booking_id, sender_type, content, read, created_at')
      .single();
    if (error) return res.status(500).json({ error: 'Failed to send message' });
    return res.status(200).json({ message: data });
  }

  // PATCH — mark messages as read
  if (req.method === 'PATCH') {
    if (!rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'msg-patch' })) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    const { booking_id, reader_type } = req.body;
    if (!isValidUuid(booking_id)) return res.status(400).json({ error: 'Invalid booking_id' });
    if (!['user', 'business'].includes(reader_type))
      return res.status(400).json({ error: 'Invalid reader_type' });

    const supabase = getSupabase();
    await supabase.from('messages').update({ read: true })
      .eq('booking_id', booking_id).neq('sender_type', reader_type);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
