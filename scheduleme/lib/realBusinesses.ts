// lib/realBusinesses.ts
// Fetches real businesses from Supabase and maps them to the shared Business interface
// Falls back gracefully so the site always shows something

import { createClient } from '@supabase/supabase-js';
import type { Business } from './mockBusinesses';

// Category cover images — used when a business has no cover photo
const CATEGORY_COVERS: Record<string, string> = {
  plumbing: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80',
  electrical: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=900&q=80',
  hvac: 'https://images.unsplash.com/photo-1631545806609-b67a6ca855e4?w=900&q=80',
  cleaning: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900&q=80',
  house_cleaning: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900&q=80',
  landscaping: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=900&q=80',
  painting: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=900&q=80',
  handyman: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=900&q=80',
  photography: 'https://images.unsplash.com/photo-1606216840934-f62c8f78de31?w=900&q=80',
  tutoring: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=900&q=80',
  hair_beauty: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=900&q=80',
  moving: 'https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=900&q=80',
  auto_repair: 'https://images.unsplash.com/photo-1625047509248-ec889cbff17f?w=900&q=80',
  arts_crafts: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=900&q=80',
  'arts_&_crafts': 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=900&q=80',
  carpentry: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=900&q=80',
  roofing: 'https://images.unsplash.com/photo-1632759145351-1d592919f522?w=900&q=80',
};

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&q=80';

function getCover(service_tags: string[], cover_url?: string | null): string {
  if (cover_url) return cover_url;
  for (const tag of service_tags) {
    const key = tag.toLowerCase().replace(/\s+/g, '_');
    if (CATEGORY_COVERS[key]) return CATEGORY_COVERS[key];
  }
  return DEFAULT_COVER;
}

function getCategory(service_tags: string[]): string {
  if (!service_tags?.length) return 'General';
  return service_tags[0]
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Map a raw Supabase businesses row to the shared Business interface
export function mapDbBusiness(b: any, distanceMiles?: number): Business {
  const category = getCategory(b.service_tags || []);
  const distance = distanceMiles != null
    ? `${distanceMiles.toFixed(1)} mi`
    : b.address ? `${b.address.split(',')[0]}` : 'Nearby';

  return {
    id: b.id,
    name: b.name,
    category,
    rating: b.rating ?? 4.8,
    reviews: b.review_count ?? Math.floor(Math.random() * 80) + 20,
    distance,
    price_tier: b.price_tier ?? 2,
    available: true,
    badge: b.is_onboarded ? 'Verified' : null,
    tagline: b.description ?? `${category} service in ${b.address ?? 'your area'}`,
    description: b.description ?? `${b.name} offers professional ${category.toLowerCase()} services.`,
    address: b.address ?? '',
    phone: b.phone ?? '',
    email: b.owner_email ?? '',
    hours: [
      { day: 'Mon–Fri', time: '8:00 AM – 6:00 PM' },
      { day: 'Saturday', time: '9:00 AM – 4:00 PM' },
      { day: 'Sunday', time: 'By appointment' },
    ],
    services: (b.service_tags || []).map((tag: string) => ({
      name: tag.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      price: 'Contact for pricing',
    })),
    coverUrl: getCover(b.service_tags || [], b.cover_url),
    allImages: b.media_urls?.length
      ? b.media_urls
      : [getCover(b.service_tags || [], b.cover_url)],
    video_url: b.video_url || null,
    lat: b.lat ?? 0,
    lng: b.lng ?? 0,
    sponsored: false,
    independent: true,
    topReview: b.top_review ?? null,
    reviewer: b.top_reviewer ? { name: b.top_reviewer, avatarUrl: '' } : undefined,
    // Pass through real IDs and links for booking
    realId: b.id,
    slug: b.slug,
    calendlyUrl: b.calendly_url,
    website: b.website,
  } as Business & { realId: string; slug: string; calendlyUrl: string; website: string };
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Fetch all approved businesses near a location
export async function fetchNearbyBusinesses(
  lat: number,
  lng: number,
  opts: { radius?: number; limit?: number; category?: string } = {}
): Promise<Business[]> {
  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat, lng,
        service: opts.category && opts.category !== 'All' ? opts.category.toLowerCase() : undefined,
        radius: opts.radius ?? 25,
        limit: opts.limit ?? 40,
      }),
    });
    if (!res.ok) return [];
    const { data } = await res.json();
    if (!data?.length) return [];
    return data.map((b: any) => mapDbBusiness(b, b.distance_miles));
  } catch {
    return [];
  }
}

// Fetch all approved businesses (no geo required — for home page fallback)
export async function fetchAllBusinesses(): Promise<Business[]> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, description, address, lat, lng, service_tags, rating, phone, owner_email, cover_url, media_urls, video_url, calendly_url, website, slug, is_onboarded, price_tier, review_count')
      .eq('is_onboarded', true)
      .order('rating', { ascending: false })
      .limit(40);

    if (error || !data?.length) return [];
    return data.map((b: any) => mapDbBusiness(b));
  } catch {
    return [];
  }
}
