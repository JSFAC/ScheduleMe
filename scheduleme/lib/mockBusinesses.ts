// lib/mockBusinesses.ts — Business interface shared across the app
// NOTE: All mock business data removed. Real data comes from Supabase via lib/realBusinesses.ts

export interface Business {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviews: number;
  distance: string;
  price_tier: number;
  available: boolean;
  badge?: string | null;
  tagline: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  hours: { day: string; time: string }[];
  services: { name: string; price: string }[];
  coverUrl: string;
  allImages: string[];
  lat: number;
  lng: number;
  sponsored?: boolean;
  independent?: boolean;
  topReview?: string;
  reviewer?: { name: string; avatarUrl: string };
  realId?: string;
  slug?: string | null;
  calendlyUrl?: string | null;
  website?: string | null;
  video_url?: string | null;
}

// Empty arrays — no mock data. All business data comes from Supabase.
export const SPONSORED: Business[] = [];
export const INDEPENDENT: Business[] = [];
export const NEARBY: Business[] = [];
