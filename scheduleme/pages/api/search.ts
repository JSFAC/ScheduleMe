// pages/api/search.ts — SECURED
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';

export interface BusinessResult {
  id: string; name: string; slug: string | null; description: string | null;
  address: string | null; lat: number; lng: number; service_tags: string[];
  price_tier: number | null; rating: number | null; calendly_url: string | null;
  is_onboarded: boolean; distance_miles: number;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit: 30 searches/min per IP
  if (!rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'search' })) return;

  const { lat, lng, service, term, price_max, radius = 25, limit = 40 } = req.body;

  if (typeof lat !== 'number' || typeof lng !== 'number')
    return res.status(400).json({ error: 'lat and lng are required numbers' });
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180)
    return res.status(400).json({ error: 'lat/lng out of valid range' });
  if (service && typeof service === 'string' && service.length > 100)
    return res.status(400).json({ error: 'service too long' });
  if (term && typeof term === 'string' && term.length > 100)
    return res.status(400).json({ error: 'term too long' });

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('search_businesses_geo', {
      p_lat: lat, p_lng: lng,
      p_service: service ?? null,
      p_term: term ?? null,
      p_price_max: price_max ?? null,
      p_radius: Math.min(Number(radius) || 25, 100),
      p_limit: Math.min(Number(limit) || 40, 100),
    });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data: data as BusinessResult[] });
  } catch (err) {
    console.error('[search]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
