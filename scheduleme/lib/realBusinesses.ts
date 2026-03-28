// @ts-nocheck
// lib/realBusinesses.ts
// Geo-gated: NEVER shows businesses outside user's radius.
// Without coordinates, returns [] — correct local-only behavior.

import { createClient } from '@supabase/supabase-js';
import type { Business } from './mockBusinesses';

function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const CATEGORY_COVERS: Record<string, string> = {
  plumbing: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80',
  electrical: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=900&q=80',
  hvac: 'https://images.unsplash.com/photo-1631545806609-b67a6ca855e4?w=900&q=80',
  cleaning: 'https://images.unsplash.com/photo-1581578731548-c64695cc695b?w=900&q=80',
  landscaping: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=900&q=80',
  painting: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=900&q=80',
  handyman: 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=900&q=80',
};

function getCover(service_tags: string[], cover_url?: string | null): string {f
  if (cover_url) return cover_url;
  for (const tag of (service_tags || [])) {
    const key = tag.toLowerCase().replace(/_/g,' ');
    if (CATEGORY_COVERS[key]) return CATEGORY_COVERS[key];
    if (CATEGORY_COVERS[tag.toLowerCase()]) return CATEGORY_COVERS[tag.toLowerCase()];
  }
  return 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&q=80';
}

function mapBusiness(b: any, distanceMiles?: number): Business {
  const tags = b.service_tags || [];
  const category = tags.length > 0
    ? tags[0].charAt(0).toUpperCase() + tags[0].slice(1).replace(/_/g, ' ')
    : 'General';
  const dist = distanceMiles != null
    ? (distanceMiles < 0.1 ? 'Nearby' : distanceMiles.toFixed(1) + ' mi away')
    : b.address || 'Local';
  return {
    id: b.id,
    realId: b.id,
    name: b.name || 'Local Business',
    slug: b.slug || b.id,
    description: b.description || '',
    tagline: b.description ? b.description.split('.')[0] : '',
    address: b.address || '',
    lat: b.lat,
    lng: b.lng,
    category,
    independent: true,
    available: true,
    distance: dist,
    rating: parseFloat(b.rating) || 4.5,
    reviews: b.review_count ?? 0,
    price_tier: b.price_tier ?? 2,
    coverUrl: getCover(tags, b.cover_url),
    allImages: b.media_urls || [getCover(tags, b.cover_url)],
    phone: b.phone || '',
    website: b.website || '',
    calendly_url: b.calendly_url || '',
    hours: [],
    services: [],
    about: b.description || '',
    badges: [],
  } as Business;
}

// Geo search — only returns businesses within radius miles of given coords
export async function fetchNearbyBusinesses(
  lat: number,
  lng: number,
  opts: { radius?: number; limit?: number; category?: string } = {}
): Promise<Business[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Prefer service-role API (bypasses RLS/RPC omissions)
    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        radius: String(opts.radius ?? 25),
        limit: String(opts.limit ?? 40),
      });
      if (opts.category) params.set('category', opts.category.toLowerCase());
      const res = await fetch(`/api/nearby-businesses?${params.toString()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store' },
      });
      if (res.ok) {
        if (res.status === 304) return [];
        const json = await res.json();
        const rows = json?.businesses || [];
        if (rows.length > 0) {
          return rows.map((b: any) => mapBusiness(b, b.distance_miles));
        }
      }

    } catch { /* non-fatal */ }

    // Fallback to RPC (if API unavailable)
    const { data, error } = await supabase.rpc('search_businesses_geo', {
      p_lat: lat, p_lng: lng,
      p_service: opts.category ? opts.category.toLowerCase() : null,
      p_term: null, p_price_max: null,
      p_radius: opts.radius ?? 25,
      p_limit: opts.limit ?? 40,
    });

    if (!error && data && (data as any[]).length > 0) {
      return (data as any[]).map(b => mapBusiness(b, b.distance_miles));
    }

    return [];
  } catch { return []; }
}


// GEO-GATED: Returns [] without coordinates — never shows out-of-area businesses
export async function fetchAllBusinesses(
  opts: { lat?: number; lng?: number; radius?: number; limit?: number } = {}
): Promise<Business[]> {
  if (!opts.lat || !opts.lng) return [];
  return fetchNearbyBusinesses(opts.lat, opts.lng, {
    radius: opts.radius ?? 25,
    limit: opts.limit ?? 40,
  });
}
