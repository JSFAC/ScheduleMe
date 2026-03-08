// pages/api/search.ts
// Server-only — SUPABASE_SERVICE_ROLE_KEY is never sent to the browser.

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// ── Types ──────────────────────────────────────────────────

export interface BusinessResult {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  address: string | null;
  lat: number;
  lng: number;
  service_tags: string[];
  price_tier: number | null;
  rating: number | null;
  calendly_url: string | null;
  is_onboarded: boolean;
  distance_miles: number;
}

interface SearchBody {
  lat: number;
  lng: number;
  service?: string;
  term?: string;
  price_max?: number;
  radius?: number;   // miles, default 25
  limit?: number;    // default 40
}

interface SearchResponse {
  data?: BusinessResult[];
  error?: string;
}

// ── Supabase admin client (server-only) ───────────────────
// We create the client per-request so env vars are always fresh.
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ── Handler ───────────────────────────────────────────────
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SearchResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    lat,
    lng,
    service,
    term,
    price_max,
    radius = 25,
    limit = 40,
  } = req.body as SearchBody;

  // Basic validation
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'lat and lng are required numbers' });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'lat/lng out of valid range' });
  }

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase.rpc('search_businesses_geo', {
      p_lat: lat,
      p_lng: lng,
      p_service: service ?? null,
      p_term: term ?? null,
      p_price_max: price_max ?? null,
      p_radius: Math.min(radius, 100),   // cap at 100 miles
      p_limit: Math.min(limit, 100),     // cap at 100 results
    });

    if (error) {
      console.error('[search] Supabase RPC error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ data: data as BusinessResult[] });
  } catch (err) {
    console.error('[search] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
