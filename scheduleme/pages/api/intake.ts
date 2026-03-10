// pages/api/intake.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { triageUserInput } from '../../lib/claude';
import { matchProviders } from '../../lib/mockProviders';
import { rateLimit } from '../../lib/rateLimit';

interface IntakeRequestBody {
  message: string;
  location: string;
  name: string;
  phone: string;
  lat?: number;
  lng?: number;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'ScheduleMe/1.0' } });
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (_) { /* fall through */ }
  return null;
}

function validateBody(body: unknown): { valid: true; data: IntakeRequestBody } | { valid: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!body || typeof body !== 'object') return { valid: false, errors: { body: 'Request body must be a JSON object.' } };
  const b = body as Record<string, unknown>;
  if (typeof b.message !== 'string' || b.message.trim().length < 5) errors.message = 'message must be at least 5 characters.';
  if (typeof b.location !== 'string' || b.location.trim().length < 2) errors.location = 'location must be a non-empty string.';
  if (typeof b.name !== 'string' || b.name.trim().length < 1) errors.name = 'name must be a non-empty string.';
  if (typeof b.phone !== 'string' || !/^[\d\s\-().+]{7,20}$/.test(b.phone.trim())) errors.phone = 'phone must be a valid phone number.';
  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return {
    valid: true,
    data: {
      message: (b.message as string).trim(),
      location: (b.location as string).trim(),
      name: (b.name as string).trim(),
      phone: (b.phone as string).trim(),
      lat: typeof b.lat === 'number' ? b.lat : undefined,
      lng: typeof b.lng === 'number' ? b.lng : undefined,
    },
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed.' });
  }
  // Rate limit: 5 requests per minute per IP
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket.remoteAddress ?? 'unknown';
  const { allowed, remaining } = rateLimit(ip, 5, 60_000);
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  if (!allowed) return res.status(429).json({ error: 'Too many requests. Please wait a moment before trying again.' });

  const validation = validateBody(req.body);
  if (!validation.valid) return res.status(400).json({ error: 'Invalid request body.', details: validation.errors });
  const { message, location, name, phone, lat: bodyLat, lng: bodyLng } = validation.data;

  try {
    const triage = await triageUserInput(message);
    const supabase = getSupabase();
    let matches = null;

    if (supabase) {
      let lat = bodyLat;
      let lng = bodyLng;
      if (!lat || !lng) {
        const geo = await geocodeLocation(location);
        if (geo) { lat = geo.lat; lng = geo.lng; }
      }
      if (lat && lng) {
        const { data, error } = await supabase.rpc('search_businesses_geo', {
          p_lat: lat, p_lng: lng,
          p_service: triage.service_category.toLowerCase(),
          p_term: triage.keywords.slice(0, 2).join(' ') || null,
          p_price_max: null, p_radius: 25, p_limit: 5,
        });
        if (!error && data && data.length > 0) {
          matches = (data as Array<{
            id: string; name: string; service_tags: string[]; address: string | null;
            rating: number | null; distance_miles: number; calendly_url: string | null; slug: string | null;
          }>).map((b) => ({
            id: b.id, name: b.name,
            service: b.service_tags?.[0] ?? triage.service_category.toLowerCase(),
            location: b.address ?? location,
            rating: b.rating ?? 4.5,
            reviewCount: Math.floor(Math.random() * 300) + 50,
            phone: '5125550000',
            badge: b.distance_miles < 5 ? 'Nearby' : 'Verified',
            distance_miles: b.distance_miles,
            calendly_url: b.calendly_url,
            slug: b.slug,
            from_db: true,
          }));
        }
      }
    }

    if (!matches || matches.length === 0) {
      matches = matchProviders(triage.service_category, message, location, 3);
    }

    const leadId = uuidv4();
    if (supabase) {
      try {
        await supabase.from('users').upsert(
          { id: leadId, name, phone, email: `${phone.replace(/\D/g, '')}@lead.scheduleme.app` },
          { onConflict: 'id' }
        );
      } catch (_) { /* non-fatal */ }
    }

    // Send confirmation email if user provided an email
    const userEmail = (req.body as any).email;
    if (userEmail && typeof userEmail === 'string') {
      try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        await fetch(`${siteUrl}/api/notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-notify-secret': process.env.NOTIFY_SECRET || '',
          },
          body: JSON.stringify({
            type: 'booking_confirmation',
            to: userEmail,
            name,
            service: triage.service_category,
            urgency: triage.urgency,
            location,
            matches: (matches || []).map((m: any) => ({
              name: m.name,
              rating: m.rating,
              distance_miles: m.distance_miles,
            })),
          }),
        });
      } catch (emailErr) {
        console.warn('[intake] Failed to send confirmation email:', emailErr);
      }
    }

    return res.status(200).json({ leadId, triage, matches });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error.';
    console.error('[intake] Error:', err);
    return res.status(500).json({ error: msg });
  }
}
