// pages/api/bookings.ts — SECURED + notifications
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { validateAndFilter } from '../../lib/profanity';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid, isValidEmail } from '../../lib/apiSecurity';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
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

    // Email business owner about new booking
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

    // Trigger n8n workflow
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
  } catch { /* non-fatal */ }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);

  if (req.method === 'POST') {
    if (!rateLimit(req, res, { max: 10, windowMs: 10 * 60_000, keyPrefix: 'book-post' })) return;

    const { business_id, user_id, service, user_name, user_phone, user_email } = req.body;

    if (!business_id) return res.status(400).json({ error: 'business_id is required' });
    if (!isValidUuid(business_id)) return res.status(400).json({ error: 'Invalid business_id' });
    if (user_id && !isValidUuid(user_id)) return res.status(400).json({ error: 'Invalid user_id' });
    if (user_email && !isValidEmail(user_email)) return res.status(400).json({ error: 'Invalid email' });

    if (service) {
      const svcCheck = validateAndFilter(service, { maxLength: 500, fieldName: 'Service description' });
      if (!svcCheck.ok) return res.status(400).json({ error: svcCheck.error });
    }

    try {
      const supabase = getSupabase();

      let resolvedUserId = user_id;
      if (!resolvedUserId && user_email) {
        const { data: userData } = await supabase
          .from('profiles')
          .upsert({ email: user_email, name: user_name?.slice(0, 100), phone: user_phone?.slice(0, 20) }, { onConflict: 'email' })
          .select('id').single();
        resolvedUserId = userData?.id;
      }

      const { data, error } = await supabase.from('bookings').insert({
        business_id,
        user_id: resolvedUserId ?? null,
        service: service?.slice(0, 500) ?? 'General Service',
        status: 'pending',
        requires_manual_action: true,
      }).select('id, status, created_at').single();

      if (error) return res.status(500).json({ error: 'Failed to create booking' });

      // Fire-and-forget notifications
      notifyNewBooking(data.id, supabase);

      return res.status(200).json({ booking: data });
    } catch {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PATCH') {
    // Business confirms/cancels/completes a booking
    if (!rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'book-patch' })) return;
    const user = await requireAuth(req, res);
    if (!user) return;

    const { booking_id, status } = req.body;
    if (!isValidUuid(booking_id)) return res.status(400).json({ error: 'Invalid booking_id' });
    const VALID_STATUSES = ['pending', 'confirmed', 'active', 'completed', 'cancelled'];
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const supabase = getSupabase();

    // Verify caller owns the business for this booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, service, user_id, businesses(owner_email), profiles(name, email)')
      .eq('id', booking_id)
      .maybeSingle();

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if ((booking.businesses as any)?.owner_email !== user.email)
      return res.status(403).json({ error: 'Access denied' });

    await supabase.from('bookings').update({ status }).eq('id', booking_id);

    // Notify consumer of status change
    const consumer = booking.profiles as any;
    if (consumer?.email) {
      // Send review request email when booking is completed
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
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';
      fetch(`${siteUrl}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': process.env.NOTIFY_SECRET || '' },
        body: JSON.stringify({
          type: 'status_update',
          to: consumer.email,
          name: consumer.name || 'there',
          service: booking.service,
          status,
        }),
      }).catch(() => {});

      // n8n trigger for status changes
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
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {});
      }
    }

    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET') {
    if (!rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'book-get' })) return;

    const { business_id, user_id } = req.query;

    if (user_id) {
      if (!isValidUuid(user_id)) return res.status(400).json({ error: 'Invalid user_id' });
      const user = await requireAuth(req, res);
      if (!user) return;
      if (user.id !== user_id) return res.status(403).json({ error: 'Access denied' });

      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from('bookings')
          .select('id, service, status, created_at, scheduled_start, scheduled_end, amount_cents, paid_at, businesses(name, phone, email)')
          .eq('user_id', user_id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) return res.status(500).json({ error: 'Failed to fetch bookings' });
        const bookings = (data || []).map((b: any) => ({
          ...b,
          scheduled_at: b.scheduled_start ?? null,
          business_name: b.businesses?.name ?? null,
          business_phone: b.businesses?.phone ?? null,
          business_email: b.businesses?.email ?? null,
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

      const supabase = getSupabase();
      const { data: biz } = await supabase.from('businesses')
        .select('owner_email').eq('id', business_id).maybeSingle();
      if (!biz) return res.status(404).json({ error: 'Business not found' });
      if (biz.owner_email !== user.email) return res.status(403).json({ error: 'Access denied' });

      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*, profiles(name, phone, email)')
          .eq('business_id', business_id)
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) return res.status(500).json({ error: 'Failed to fetch bookings' });
        return res.status(200).json({ bookings: data });
      } catch {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    return res.status(400).json({ error: 'business_id or user_id required' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
