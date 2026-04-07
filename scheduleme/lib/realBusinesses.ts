// @ts-nocheck
// lib/realBusinesses.ts
// Geo-gated: NEVER shows businesses outside user's radius.
// Without coordinates, returns [] — correct local-only behavior.

import { getSupabaseClient } from './supabaseClient';
import type { Business } from './mockBusinesses';

const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

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

function getCover(cover_url?: string | null, media_urls?: string[] | null): string {
  if (Array.isArray(media_urls) && media_urls.length > 0) {
    const firstImage = media_urls.find((u) => u && !String(u).match(/\.(mp4|mov|webm|m4v)$/i));
    if (firstImage) return firstImage;
  }
  if (cover_url && !String(cover_url).match(/\.(mp4|mov|webm|m4v)$/i)) return cover_url;
  return TRANSPARENT_PIXEL;
}

function mapBusiness(b: any, distanceMiles?: number): Business {
  const rawTags = Array.isArray(b.service_tags)
    ? b.service_tags
    : (b.service_tags ? [String(b.service_tags)] : []);
  const tags = rawTags.filter(Boolean).map((t: any) => String(t));
  const category = tags.length > 0
    ? tags[0].charAt(0).toUpperCase() + tags[0].slice(1).replace(/_/g, ' ')
    : 'General';
  const dist = distanceMiles != null
    ? (distanceMiles < 0.1 ? 'Nearby' : distanceMiles.toFixed(1) + ' mi away')
    : b.address || 'Local';
  const availability = b.availability_status ?? 'open';
  const breakUntil = b.break_until ? new Date(b.break_until) : null;
  const breakActive = availability === 'break' && breakUntil && !Number.isNaN(breakUntil.getTime()) && breakUntil.getTime() > Date.now();
  const effectiveAvailability = breakActive ? 'break' : (availability === 'break' ? 'open' : availability);
  const mediaUrls = Array.isArray(b.media_urls) && b.media_urls.length > 0 ? b.media_urls : [];
  const cover = getCover(b.cover_url, mediaUrls);
  const allImages = mediaUrls.length > 0 ? mediaUrls : (cover ? [cover] : []);
  const previewLocked = b.preview_locked === true;
  return {
    id: b.id,
    realId: b.id,
    name: previewLocked ? '' : (b.name || 'Local Business'),
    slug: b.slug || b.id,
    description: b.description || '',
    tagline: b.description ? b.description.split('.')[0] : '',
    address: b.address || '',
    lat: b.lat,
    lng: b.lng,
    category,
    independent: true,
    founder50: !!b.founder50,
    founder50_status: b.founder50_status ?? null,
    available: effectiveAvailability !== 'closed' && effectiveAvailability !== 'break',
    distance: dist,
    reviews: b.review_count ?? 0,
    rating: (b.review_count ?? 0) > 0 ? (typeof b.rating === 'number' ? b.rating : parseFloat(b.rating)) : null,
    price_tier: b.price_tier ?? null,
    availability_status: effectiveAvailability,
    break_until: breakUntil ? breakUntil.toISOString() : null,
    coverUrl: cover,
    allImages,
    phone: b.phone || '',
    website: b.website || '',
    calendly_url: b.calendly_url || '',
    hours: [],
    services: [],
    about: b.description || '',
    badges: [],
    preview_locked: previewLocked,
    public_visibility: b.public_visibility,
  } as Business;
}

// Geo search — only returns businesses within radius miles of given coords
export async function fetchNearbyBusinesses(
  lat: number,
  lng: number,
  opts: { radius?: number; limit?: number; category?: string } = {}
): Promise<Business[]> {
  try {
    const supabase = getSupabaseClient();

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
        // If API returns empty (or error payload), fall back to RPC
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
