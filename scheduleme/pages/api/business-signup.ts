// pages/api/business-signup.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
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

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    businessName, ownerName, email, phone, serviceCategory, otherCategory,
    city, radiusMiles, licenseNumber, yearsInBusiness, plan, calendlyUrl,
  } = req.body;

  if (!businessName || !email || !city || !serviceCategory) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const supabase = getSupabase();

    // Geocode the city
    const geo = await geocodeLocation(city);

    const category = serviceCategory === 'Other' ? otherCategory : serviceCategory;
    const slug = slugify(businessName) + '-' + Date.now().toString(36);

    const { data, error } = await supabase.from('businesses').insert({
      name: businessName,
      slug,
      description: `${category} service in ${city}`,
      address: city,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      service_tags: [category.toLowerCase().replace(/\s+/g, '_')],
      keywords: [category.toLowerCase(), ownerName?.toLowerCase()].filter(Boolean),
      price_tier: plan === 'pro' ? 2 : 1,
      rating: 0,
      calendly_url: calendlyUrl || null,
      phone: phone,
      owner_name: ownerName,
      owner_email: email,
      is_onboarded: false, // set to true after manual verification
    }).select('id').single();

    if (error) {
      console.error('[business-signup] Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[business-signup] Created business ${data.id} for ${businessName}`);

    return res.status(200).json({
      success: true,
      businessId: data.id,
      message: `Application received for ${businessName}`,
    });
  } catch (err) {
    console.error('[business-signup] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
