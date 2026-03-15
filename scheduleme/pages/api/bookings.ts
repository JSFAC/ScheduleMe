// pages/api/bookings.ts — SECURED
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);

  if (req.method === 'POST') {
    // Rate limit: 10 booking attempts per IP per 10 min (prevents spam)
    if (!rateLimit(req, res, { max: 10, windowMs: 10 * 60_000, keyPrefix: 'book-post' })) return;

    const { business_id, user_id, service, user_name, user_phone, user_email } = req.body;

    // Strict input validation
    if (!business_id) return res.status(400).json({ error: 'business_id is required' });
    if (!isValidUuid(business_id)) return res.status(400).json({ error: 'Invalid business_id' });
    if (user_id && !isValidUuid(user_id)) return res.status(400).json({ error: 'Invalid user_id' });
    if (user_email && !isValidEmail(user_email)) return res.status(400).json({ error: 'Invalid email' });

    // Validate service description for profanity
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
      return res.status(200).json({ booking: data });
    } catch {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'GET') {
    // Rate limit: 30 reads/min per IP
    if (!rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'book-get' })) return;

    const { business_id, user_id } = req.query;

    if (user_id) {
      if (!isValidUuid(user_id)) return res.status(400).json({ error: 'Invalid user_id' });

      // Must be authenticated and can only fetch own bookings
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

      // Must be authenticated and must own this business
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
