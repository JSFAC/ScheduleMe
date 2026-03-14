// pages/api/bookings.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    // Create a booking
    const { business_id, user_id, service, user_name, user_phone, user_email, notes } = req.body;
    if (!business_id) return res.status(400).json({ error: 'business_id is required' });

    try {
      const supabase = getSupabase();

      // Upsert user if we have their info
      let resolvedUserId = user_id;
      if (!resolvedUserId && user_email) {
        const { data: userData } = await supabase
          .from('users')
          .upsert({ email: user_email, name: user_name, phone: user_phone }, { onConflict: 'email' })
          .select('id').single();
        resolvedUserId = userData?.id;
      }

      const { data, error } = await supabase.from('bookings').insert({
        business_id,
        user_id: resolvedUserId ?? null,
        service: service ?? 'General Service',
        status: 'pending',
        requires_manual_action: true,
      }).select('id, status, created_at').single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ booking: data });
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'GET') {
    const { business_id, user_id } = req.query;

    // User bookings — authenticated via bearer token
    if (user_id) {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from('bookings')
          .select('id, service, status, created_at, scheduled_start, scheduled_end, amount_cents, paid_at, businesses(name, phone, email)')
          .eq('user_id', user_id)
          .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });

        // Flatten business info
        const bookings = (data || []).map((b: any) => ({
          ...b,
          scheduled_at: b.scheduled_start ?? null,
          business_name: b.businesses?.name ?? null,
          business_phone: b.businesses?.phone ?? null,
          business_email: b.businesses?.email ?? null,
          businesses: undefined,
        }));
        return res.status(200).json({ bookings });
      } catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    // Business bookings — used by dashboard
    if (!business_id) return res.status(400).json({ error: 'business_id or user_id required' });

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('bookings')
        .select(`*, users(name, phone, email)`)
        .eq('business_id', business_id)
        .order('created_at', { ascending: false });

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ bookings: data });
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
