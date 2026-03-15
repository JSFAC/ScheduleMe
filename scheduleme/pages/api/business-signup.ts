// pages/api/business-signup.ts — SECURED
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { validateAndFilter } from '../../lib/profanity';
import { setSecurityHeaders, rateLimit, isValidEmail, isValidPhone } from '../../lib/apiSecurity';

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
  } catch { /* fall through */ }
  return null;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const VALID_CATEGORIES = [
  'Plumbing', 'Electrical', 'HVAC', 'Cleaning', 'Handyman', 'Painting',
  'Landscaping', 'Roofing', 'Carpentry', 'Moving', 'Photography',
  'Tutoring', 'Hair & Beauty', 'Auto Repair', 'Other',
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit: 3 signups per IP per hour (prevents signup spam)
  if (!rateLimit(req, res, { max: 3, windowMs: 60 * 60_000, keyPrefix: 'biz-signup' })) return;

  const {
    businessName, ownerName, email, phone, serviceCategory, otherCategory,
    city, calendlyUrl, website, instagram, campusProvider, schoolName,
  } = req.body;

  // Required fields
  if (!businessName || !email || !city || !serviceCategory)
    return res.status(400).json({ error: 'Missing required fields' });

  // Email validation
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email address' });

  // Phone validation (optional but if provided must be valid)
  if (phone && !isValidPhone(phone)) return res.status(400).json({ error: 'Invalid phone number' });

  // Category validation
  if (!VALID_CATEGORIES.includes(serviceCategory))
    return res.status(400).json({ error: 'Invalid service category' });

  // Profanity checks on all text fields
  const nameCheck = validateAndFilter(businessName, { maxLength: 100, fieldName: 'Business name' });
  if (!nameCheck.ok) return res.status(400).json({ error: nameCheck.error });

  const ownerCheck = validateAndFilter(ownerName || '', { maxLength: 100, fieldName: 'Owner name' });
  if (!ownerCheck.ok) return res.status(400).json({ error: ownerCheck.error });

  // Validate optional text fields
  const cityCheck = validateAndFilter(city, { maxLength: 100, fieldName: 'City' });
  if (!cityCheck.ok) return res.status(400).json({ error: cityCheck.error });

  const cleanName = nameCheck.value;
  const cleanOwner = ownerCheck.value;
  const cleanCity = cityCheck.value;

  // URL validation (optional fields)
  const urlRegex = /^https?:\/\/.+/;
  if (website && (typeof website !== 'string' || website.length > 200 || !urlRegex.test(website)))
    return res.status(400).json({ error: 'Invalid website URL' });
  if (calendlyUrl && (typeof calendlyUrl !== 'string' || calendlyUrl.length > 200 || !urlRegex.test(calendlyUrl)))
    return res.status(400).json({ error: 'Invalid Calendly URL' });

  try {
    const supabase = getSupabase();
    const geo = await geocodeLocation(cleanCity);
    const category = serviceCategory === 'Other' ? (otherCategory?.slice(0, 50) ?? 'Other') : serviceCategory;
    const slug = slugify(cleanName) + '-' + Date.now().toString(36);

    const { data, error } = await supabase.from('businesses').insert({
      name: cleanName,
      slug,
      description: `${category} service in ${cleanCity}`,
      address: cleanCity,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      service_tags: [category.toLowerCase().replace(/\s+/g, '_')],
      keywords: [category.toLowerCase(), cleanOwner.toLowerCase()].filter(Boolean),
      rating: 0,
      calendly_url: calendlyUrl || null,
      website: website || null,
      instagram: typeof instagram === 'string' ? instagram.slice(0, 50) : null,
      phone: phone || null,
      owner_name: cleanOwner,
      owner_email: email.toLowerCase().trim(),
      is_onboarded: false,
      campus_provider: campusProvider === true,
      campus_school_name: campusProvider && schoolName ? schoolName.slice(0, 100) : null,
    }).select('id').single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'A business with this email already exists' });
      return res.status(500).json({ error: 'Failed to submit application' });
    }

    return res.status(200).json({ success: true, businessId: data.id });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
