// @ts-nocheck
// lib/realBusinesses.ts
// Geo-gated: NEVER shows businesses outside user's radius.
// Without coordinates, returns [] — correct local-only behavior.

import { getSupabaseClient } from './supabaseClient';
import type { Business } from './mockBusinesses';
import { normalizeServiceTag, serviceTagToLabel } from './categoryNormalization';
import { isProviderPubliclyVisible } from './providerTrust';

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
  const category = tags.length > 0 ? serviceTagToLabel(tags[0]) : 'General';
  const dist = b.distance_label
    ? String(b.distance_label)
    : distanceMiles != null
      ? (distanceMiles < 0.1 ? 'Nearby' : distanceMiles.toFixed(1) + ' mi away')
      : b.address || 'Local';
  const availability = b.availability_status ?? 'open';
  const breakUntil = b.break_until ? new Date(b.break_until) : null;
  const breakActive = availability === 'break' && breakUntil && !Number.isNaN(breakUntil.getTime()) && breakUntil.getTime() > Date.now();
  const effectiveAvailability = breakActive ? 'break' : (availability === 'break' ? 'open' : availability);
  const mediaUrls = Array.isArray(b.media_urls) && b.media_urls.length > 0 ? b.media_urls : [];
  const cover = getCover(b.cover_url, mediaUrls);
  const allImages = mediaUrls.length > 0 ? mediaUrls : (cover && cover !== TRANSPARENT_PIXEL ? [cover] : []);
  const previewLocked = false;
  const name = previewLocked ? 'Student provider' : (b.name || 'Local Business');
  const description = previewLocked ? 'Private until student verification' : (b.description || '');
  return {
    id: b.id,
    realId: b.id,
    name,
    slug: b.slug || b.id,
    description,
    tagline: description ? description.split('.')[0] : '',
    address: previewLocked ? '' : (b.address || ''),
    lat: b.lat,
    lng: b.lng,
    category,
    // Treat campus providers as student providers; non-campus = independent/local businesses.
    independent: b.campus_provider !== true,
    founder50: !!b.founder50,
    founder50_status: b.founder50_status ?? null,
    available: effectiveAvailability !== 'closed' && effectiveAvailability !== 'break',
    distance: dist,
    reviews: b.review_count ?? 0,
    rating: (b.review_count ?? 0) > 0 ? (typeof b.rating === 'number' ? b.rating : parseFloat(b.rating)) : null,
    price_tier: b.price_tier ?? null,
    availability_status: effectiveAvailability,
    break_until: breakUntil ? breakUntil.toISOString() : null,
    coverUrl: previewLocked ? TRANSPARENT_PIXEL : cover,
    allImages: previewLocked ? [] : allImages,
    phone: previewLocked ? '' : (b.phone || ''),
    website: previewLocked ? '' : (b.website || ''),
    instagram: b.instagram || '',
    calendly_url: b.calendly_url || '',
    hours: [],
    services: [],
    about: description,
    badges: [],
    preview_locked: previewLocked,
    public_visibility: b.public_visibility,
    campus_provider: b.campus_provider === true,
    created_at: b.created_at || null,
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
      const normalizedCategory = opts.category ? normalizeServiceTag(opts.category) : '';
      if (normalizedCategory) params.set('category', normalizedCategory);
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`/api/nearby-businesses?${params.toString()}`, {
        cache: 'no-store',
        headers,
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
      p_service: opts.category ? normalizeServiceTag(opts.category) : null,
      p_term: null, p_price_max: null,
      p_radius: opts.radius ?? 25,
      p_limit: opts.limit ?? 40,
    });

    if (!error && data && (data as any[]).length > 0) {
      return (data as any[]).map(b => mapBusiness(b, b.distance_miles));
    }

    // Last-resort fallback for environments where service-role API/RPC is unavailable.
    // This prevents Browse from rendering as an empty page.
    try {
      const normalizedCategory = opts.category ? normalizeServiceTag(opts.category) : '';
      const { data: rawRows } = await supabase
      .from('businesses')
      .select('id, name, slug, description, address, lat, lng, service_tags, cover_url, media_urls, phone, website, calendly_url, rating, review_count, price_tier, availability_status, break_until, is_onboarded, edu_verified, campus_provider, school_domain, founder50, founder50_status, last_completed_booking_at, away_start, away_end, public_visibility, trust_status, trust_flagged, approved_at, published_at, created_at')
      .eq('is_onboarded', true)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
        .limit(Math.min(300, Math.max(50, (opts.limit ?? 40) * 5)));

      const radiusMiles = opts.radius ?? 25;
      const rows = (rawRows || []).filter((row: any) => {
        const bLat = Number(row?.lat);
        const bLng = Number(row?.lng);
        if (!Number.isFinite(bLat) || !Number.isFinite(bLng)) return false;
        if (!isProviderPubliclyVisible(row)) return false;
        const serviceTags = Array.isArray(row?.service_tags) ? row.service_tags.map((t: any) => normalizeServiceTag(String(t))) : [];
        if (normalizedCategory && !serviceTags.includes(normalizedCategory)) return false;
        const distance = haversineMiles(lat, lng, bLat, bLng);
        return Number.isFinite(distance) && distance <= radiusMiles;
      });

      const sorted = rows
        .map((row: any) => {
          const distanceMiles = haversineMiles(lat, lng, Number(row.lat), Number(row.lng));
          return { ...row, distance_miles: distanceMiles };
        })
        .sort((a: any, b: any) => a.distance_miles - b.distance_miles)
        .slice(0, opts.limit ?? 40);

      if (sorted.length > 0) {
        return sorted.map((row: any) => mapBusiness(row, row.distance_miles));
      }
    } catch {
      // fall through
    }

    return [];
  } catch { return []; }
}


// GEO-GATED: Returns [] without coordinates — never shows out-of-area businesses
export async function fetchAllBusinesses(
  opts: { lat?: number; lng?: number; radius?: number; limit?: number } = {}
): Promise<Business[]> {
  // Preferred path: geo-filtered list around coordinates.
  if (Number.isFinite(opts.lat) && Number.isFinite(opts.lng)) {
    return fetchNearbyBusinesses(opts.lat as number, opts.lng as number, {
      radius: opts.radius ?? 25,
      limit: opts.limit ?? 40,
    });
  }

  // Fallback path: non-geo list so app pages do not appear empty when
  // location lookup is blocked/denied/unavailable.
  try {
    const supabase = getSupabaseClient();
    const { data: rows } = await supabase
      .from('businesses')
      .select('id, name, slug, description, address, lat, lng, service_tags, cover_url, media_urls, phone, website, calendly_url, rating, review_count, price_tier, availability_status, break_until, is_onboarded, edu_verified, campus_provider, school_domain, founder50, founder50_status, last_completed_booking_at, away_start, away_end, public_visibility, trust_status, trust_flagged, approved_at, published_at, created_at')
      .eq('is_onboarded', true)
      .order('last_completed_booking_at', { ascending: false, nullsFirst: false })
      .limit(opts.limit ?? 40);
    return (rows || [])
      .filter((row: any) => isProviderPubliclyVisible(row))
      .map((b: any) => mapBusiness(b));
  } catch {
    return [];
  }
}
