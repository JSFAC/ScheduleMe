// pages/api/messages.ts — messaging between users and businesses
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { filterMessage } from '../../lib/profanity';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = getSupabase();

  // GET — fetch messages for a booking or all bookings for a user/business
  if (req.method === 'GET') {
    const { booking_id, user_id, business_id } = req.query;

    if (booking_id) {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('booking_id', booking_id)
        .order('created_at', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ messages: data });
    }

    if (user_id) {
      // Get all bookings for this user with their latest message
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, service, status, created_at, businesses(id, name, phone)')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false });

      const threads = await Promise.all((bookings || []).map(async (b: any) => {
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('booking_id', b.id)
          .order('created_at', { ascending: false })
          .limit(1);
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('booking_id', b.id)
          .eq('read', false)
          .eq('sender_type', 'business');
        return { ...b, lastMessage: msgs?.[0] ?? null, unreadCount: count ?? 0 };
      }));
      return res.status(200).json({ threads });
    }

    if (business_id) {
      // Get all bookings for this business with latest message + unread count
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, service, status, created_at, profiles(id, name, email, phone)')
        .eq('business_id', business_id)
        .order('created_at', { ascending: false });

      const threads = await Promise.all((bookings || []).map(async (b: any) => {
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('booking_id', b.id)
          .order('created_at', { ascending: false })
          .limit(1);
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('booking_id', b.id)
          .eq('read', false)
          .eq('sender_type', 'user');
        return { ...b, lastMessage: msgs?.[0] ?? null, unreadCount: count ?? 0 };
      }));
      return res.status(200).json({ threads });
    }

    return res.status(400).json({ error: 'booking_id, user_id, or business_id required' });
  }

  // POST — send a message
  if (req.method === 'POST') {
    const { booking_id, sender_type, sender_id, content } = req.body;
    if (!booking_id || !sender_type || !content) {
      return res.status(400).json({ error: 'booking_id, sender_type, content required' });
    }

    // Input validation
    if (typeof content !== 'string') return res.status(400).json({ error: 'Invalid content' });
    const trimmed = content.trim();

    // Filter message — censors profanity inline, blocks threats entirely
    const filtered = filterMessage(trimmed);
    if (!filtered.ok) {
      return res.status(400).json({ error: filtered.error });
    }

    // Store only what's needed — no metadata bloat
    const { data, error } = await supabase
      .from('messages')
      .insert({
        booking_id,
        sender_type,
        content: filtered.filtered,  // censored version
        read: false,
      })
      .select('id, booking_id, sender_type, content, read, created_at')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ message: data });
  }

  // PATCH — mark messages as read
  if (req.method === 'PATCH') {
    const { booking_id, reader_type } = req.body;
    // Mark all messages NOT sent by reader as read
    await supabase.from('messages').update({ read: true })
      .eq('booking_id', booking_id)
      .neq('sender_type', reader_type);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
