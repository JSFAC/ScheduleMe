// pages/api/business-signup.ts — SECURED
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { validateAndFilter } from '../../lib/profanity';
import { moderateText } from '../../lib/moderation';
import { setSecurityHeaders, rateLimit, requireAuth, isValidEmail, isValidPhone, getUnknownFields, getClientIp } from '../../lib/apiSecurity';
import { requireCaptcha } from '../../lib/captcha';
import { sendNewBusinessApplicationEmail, sendBusinessApplicationReceivedEmail } from '../../lib/email';
import { normalizeServiceTag, serviceTagToTopicKeywords } from '../../lib/categoryNormalization';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const isZip = /^[0-9]{5}$/.test(location.trim());
    const query = isZip ? `${location.trim()}, USA` : location;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`;
    const res = await fetch(url, { headers: { 'User-Agent': 'ScheduleMe/1.0' } });
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { /* fall through */ }
  return null;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeCampusKey(name?: string | null): string | null {
  if (!name) return null;
  const cleaned = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const key = cleaned ? cleaned.replace(/\s+/g, '_') : null;
  if (!key) return null;
  if (key === 'uc_santa_cruz' || key === 'ucsc') return 'ucsc';
  if (key === 'arizona_state_university' || key === 'asu') return 'asu';
  return key;
}

const ADMIN_EMAIL = 'usescheduleme@gmail.com';

const VALID_CATEGORIES = [
  'Plumbing', 'Electrical', 'HVAC', 'Cleaning', 'Handyman', 'Home Repair / Handyman',
  'Painting', 'Landscaping', 'Roofing', 'Carpentry', 'Moving', 'Photography',
  'Tutoring', 'Hair & Beauty', 'Salon / Beauty', 'Auto Repair', 'Automotive',
  'Arts & Crafts', 'Pest Control', 'Other',
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit: 3 signups per IP per hour (prevents signup spam)
  if (!(await rateLimit(req, res, { max: 3, windowMs: 60 * 60_000, keyPrefix: 'biz-signup' }))) return;

  const allowed = [
    'businessName','ownerName','email','phone','serviceCategory','otherCategory',
    'city','zip','website','instagram','campusProvider','schoolName','captchaToken',
    'radiusMiles','licenseNumber','yearsInBusiness','agree','plan',
  ];
  const unknown = getUnknownFields(req.body, allowed);
  if (unknown.length > 0) return res.status(400).json({ error: `Unexpected fields: ${unknown.join(', ')}` });
  const {
    businessName, ownerName, email, phone, serviceCategory, otherCategory,
    city, zip, website, instagram, campusProvider, schoolName, captchaToken,
  } = req.body;

  if (!(await requireCaptcha(req, res, captchaToken, getClientIp(req)))) return;

  // Required fields
  if (!businessName || !email || !city || !zip || !serviceCategory)
    return res.status(400).json({ error: 'Missing required fields' });

  // Email validation
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email address' });

  // Phone validation (optional but if provided must be valid)
  if (phone && !isValidPhone(phone)) return res.status(400).json({ error: 'Invalid phone number' });

  // Category validation
  if (!VALID_CATEGORIES.includes(serviceCategory))
    return res.status(400).json({ error: 'Invalid service category' });

  // Profanity checks on all text fields
  const nameMod = await moderateText(businessName);
  if (!nameMod.ok) return res.status(400).json({ error: nameMod.reason || 'Business name violates content policy' });
  const nameCheck = validateAndFilter(businessName, { maxLength: 60, fieldName: 'Business name' });
  if (!nameCheck.ok) return res.status(400).json({ error: nameCheck.error });

  if (ownerName) {
    const ownerMod = await moderateText(ownerName);
    if (!ownerMod.ok) return res.status(400).json({ error: ownerMod.reason || 'Owner name violates content policy' });
  }
  const ownerCheck = validateAndFilter(ownerName || '', { maxLength: 60, fieldName: 'Owner name' });
  if (!ownerCheck.ok) return res.status(400).json({ error: ownerCheck.error });

  const cityMod = await moderateText(city);
  if (!cityMod.ok) return res.status(400).json({ error: cityMod.reason || 'City violates content policy' });
  // Validate optional text fields
  const cityCheck = validateAndFilter(city, { maxLength: 120, fieldName: 'City' });
  if (!cityCheck.ok) return res.status(400).json({ error: cityCheck.error });

  const zipCheck = validateAndFilter(zip, { maxLength: 10, fieldName: 'ZIP' });
  if (!zipCheck.ok) return res.status(400).json({ error: zipCheck.error });
  const cleanZip = zipCheck.value.trim();
  if (!/^\d{5}(-\d{4})?$/.test(cleanZip)) return res.status(400).json({ error: 'Invalid ZIP code' });

  const cleanName = nameCheck.value;
  const cleanOwner = ownerCheck.value;
  const cleanCity = cityCheck.value;
  const cleanAddress = `${cleanCity}, ${cleanZip}`;

  // URL validation (optional fields)
  const urlRegex = /^https?:\/\/.+/;
  if (website && (typeof website !== 'string' || website.length > 200 || !urlRegex.test(website)))
    return res.status(400).json({ error: 'Invalid website URL' });
  if (instagram && typeof instagram === 'string' && instagram.length > 200)
    return res.status(400).json({ error: 'Invalid Instagram handle' });
  if (otherCategory && typeof otherCategory === 'string' && otherCategory.length > 60)
    return res.status(400).json({ error: 'Service description is too long' });
  if (schoolName && typeof schoolName === 'string' && schoolName.length > 100)
    return res.status(400).json({ error: 'School name is too long' });
  if (otherCategory) {
    const otherMod = await moderateText(otherCategory);
    if (!otherMod.ok) return res.status(400).json({ error: otherMod.reason || 'Service description violates content policy' });
  }
  if (schoolName) {
    const schoolMod = await moderateText(schoolName);
    if (!schoolMod.ok) return res.status(400).json({ error: schoolMod.reason || 'School name violates content policy' });
  }

  try {
    const supabase = getSupabase();
    const authUser = req.headers.authorization ? await requireAuth(req, res) : null;
    if (req.headers.authorization && !authUser) return;
    const normalizedEmail = email.toLowerCase().trim();
    let ownerId: string | null = authUser?.id || null;
    if (authUser?.email && authUser.email.toLowerCase() !== normalizedEmail) {
      return res.status(403).json({ error: 'Authenticated email does not match application email' });
    }
    if (!ownerId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();
      ownerId = profile?.id || null;
    }
    if (!ownerId) {
      try {
        const { data: legacyUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', normalizedEmail)
          .maybeSingle();
        ownerId = legacyUser?.id || null;
      } catch {}
    }
    if (!ownerId) {
      return res.status(400).json({ error: 'Please create your account first, then submit provider signup.' });
    }

    const geo = await geocodeLocation(cleanAddress);
    const category = serviceCategory === 'Other' ? (otherCategory?.slice(0, 60) ?? 'Other') : serviceCategory;
    const normalizedCategoryTag = normalizeServiceTag(category);
    const slug = slugify(cleanName) + '-' + Date.now().toString(36);
    const campusKey = campusProvider ? normalizeCampusKey(schoolName) : null;

    const { data, error } = await supabase.from('businesses').insert({
      name: cleanName,
      slug,
      description: `${category} service in ${cleanCity}`,
      address: cleanAddress,
      city: cleanCity,
      zip: cleanZip,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      service_tags: [normalizedCategoryTag || 'other'],
      keywords: [...serviceTagToTopicKeywords(normalizedCategoryTag || 'other'), cleanOwner.toLowerCase()].filter(Boolean),
      rating: 0,
      website: website || null,
      instagram: typeof instagram === 'string' ? instagram.slice(0, 200) : null,
      phone: phone || null,
      owner_name: cleanOwner,
      owner_email: normalizedEmail,
      owner_id: ownerId,
      is_onboarded: false,
      campus_provider: campusProvider === true,
      campus_school_name: campusProvider && schoolName ? schoolName.slice(0, 100) : null,
      campus_key: campusKey,
    }).select('id').single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'A business with this email already exists' });
      return res.status(500).json({ error: 'Failed to submit application' });
    }

    // Email admin and applicant (direct send to avoid notify issues)
    try {
      await sendNewBusinessApplicationEmail({
        to: ADMIN_EMAIL,
        name: cleanName,
        ownerName: cleanOwner,
        email,
        phone: phone || 'not provided',
        category: category,
        city: cleanAddress,
        campusProvider: campusProvider === true,
        schoolName: campusProvider ? schoolName : undefined,
      });
    } catch (err) {
      console.error('[business-signup] admin email failed', err);
    }

    try {
      await sendBusinessApplicationReceivedEmail({
        to: email.toLowerCase().trim(),
        ownerName: cleanOwner,
        businessName: cleanName,
        category: category,
        city: cleanAddress,
      });
    } catch (err) {
      console.error('[business-signup] applicant email failed', err);
    }

    return res.status(200).json({ success: true, businessId: data.id });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
