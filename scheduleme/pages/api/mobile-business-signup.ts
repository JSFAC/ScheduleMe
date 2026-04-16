import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import {
  setSecurityHeaders,
  rateLimit,
  isValidEmail,
  isValidPhone,
} from '../../lib/apiSecurity';
import { validateAndFilter } from '../../lib/profanity';
import { sendNewBusinessApplicationEmail } from '../../lib/email';

type MobileBusinessSignupBody = {
  businessName?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  serviceCategory?: string;
  otherCategory?: string;
  city?: string;
  website?: string;
  instagram?: string;
  campusProvider?: boolean;
  schoolName?: string;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

function normalizeText(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
}

function toCategoryLabel(raw: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[\/,+\-_]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return '';

  const mapping: Record<string, string> = {
    plumbing: 'Plumbing',
    electrical: 'Electrical',
    hvac: 'HVAC',
    cleaning: 'Cleaning',
    handyman: 'Handyman',
    home_repair_handyman: 'Home Repair / Handyman',
    home_repair: 'Home Repair / Handyman',
    painting: 'Painting',
    landscaping: 'Landscaping',
    roofing: 'Roofing',
    carpentry: 'Carpentry',
    moving: 'Moving',
    photography: 'Photography',
    tutoring: 'Tutoring',
    hair_beauty: 'Hair & Beauty',
    salon_beauty: 'Salon / Beauty',
    auto_repair: 'Auto Repair',
    automotive: 'Automotive',
    arts_crafts: 'Arts & Crafts',
    pest_control: 'Pest Control',
    other: 'Other',
  };

  const key = normalized.replace(/\s+/g, '_');
  return mapping[key] ?? normalized.split(' ').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = encodeURIComponent(location);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
    const response = await fetch(url, { headers: { 'User-Agent': 'ScheduleMeProvider-iOS/1.0' } });
    const data = await response.json();
    if (data?.[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {
    // Best-effort geocode only.
  }
  return null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeCampusSchoolName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const collapsed = trimmed.replace(/\s+/g, ' ');
  const lower = collapsed.toLowerCase();

  const known: Record<string, string> = {
    ucsc: 'UCSC',
    ucla: 'UCLA',
    ucsb: 'UCSB',
    ucsd: 'UCSD',
    ucd: 'UCD',
    'uc davis': 'UC Davis',
    sjsu: 'SJSU',
    sfsu: 'SFSU',
    nyu: 'NYU',
    usc: 'USC',
    mit: 'MIT',
    'ucla extension': 'UCLA Extension',
  };
  if (known[lower]) return known[lower];

  if (/^[a-z]{2,6}$/.test(lower)) return lower.toUpperCase();

  return collapsed
    .split(' ')
    .map((part) => {
      if (/^[A-Za-z]+$/.test(part) && part.length <= 4) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

async function resolveOwnerIdForEmail(supabase: ReturnType<typeof getSupabase>, email: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const redirectBase = (process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com').replace(/\/+$/, '');

  const findProfileOwnerId = async (): Promise<string | null> => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', normalizedEmail)
      .limit(1)
      .maybeSingle();
    return typeof data?.id === 'string' ? data.id : null;
  };

  const existingOwnerId = await findProfileOwnerId();
  if (existingOwnerId) return existingOwnerId;

  const { data: magicLinkData } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: normalizedEmail,
    options: {
      redirectTo: `${redirectBase}/business/dashboard`,
    },
  });

  const magicLinkUserId =
    (magicLinkData as any)?.user?.id ??
    (magicLinkData as any)?.properties?.user?.id ??
    null;
  if (typeof magicLinkUserId === 'string' && magicLinkUserId.length > 0) {
    return magicLinkUserId;
  }

  const { data: createdUser } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: false,
  });
  const createdUserId = (createdUser as any)?.user?.id;
  if (typeof createdUserId === 'string' && createdUserId.length > 0) {
    return createdUserId;
  }

  return await findProfileOwnerId();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 10, windowMs: 60 * 60_000, keyPrefix: 'mobile-biz-signup' }))) return;

  const body = (req.body ?? {}) as MobileBusinessSignupBody;
  const businessName = normalizeText(body.businessName);
  const ownerName = normalizeText(body.ownerName);
  const email = normalizeText(body.email).toLowerCase();
  const phone = normalizeText(body.phone);
  const serviceCategoryInput = normalizeText(body.serviceCategory);
  const otherCategoryInput = normalizeText(body.otherCategory);
  const city = normalizeText(body.city);
  const website = normalizeText(body.website);
  const instagram = normalizeText(body.instagram);
  const schoolName = normalizeText(body.schoolName);
  const campusProvider = body.campusProvider === true;

  if (!businessName || !ownerName || !email || !city || !serviceCategoryInput) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email address' });
  if (phone && !isValidPhone(phone)) return res.status(400).json({ error: 'Invalid phone number' });
  if (campusProvider && !schoolName) return res.status(400).json({ error: 'School name is required for campus providers' });

  const categoryLabel = toCategoryLabel(serviceCategoryInput);
  if (!categoryLabel) return res.status(400).json({ error: 'Invalid service category' });
  const categoryForDescription = categoryLabel === 'Other' && otherCategoryInput ? otherCategoryInput : categoryLabel;
  const normalizedSchoolName = normalizeCampusSchoolName(schoolName);

  const nameCheck = validateAndFilter(businessName, { maxLength: 100, fieldName: 'Business name' });
  if (!nameCheck.ok) return res.status(400).json({ error: nameCheck.error });
  const ownerCheck = validateAndFilter(ownerName, { maxLength: 100, fieldName: 'Owner name' });
  if (!ownerCheck.ok) return res.status(400).json({ error: ownerCheck.error });
  const cityCheck = validateAndFilter(city, { maxLength: 100, fieldName: 'City' });
  if (!cityCheck.ok) return res.status(400).json({ error: cityCheck.error });

  const cleanBusinessName = nameCheck.value;
  const cleanOwnerName = ownerCheck.value;
  const cleanCity = cityCheck.value;

  const urlRegex = /^https?:\/\/.+/;
  if (website && !urlRegex.test(website)) return res.status(400).json({ error: 'Invalid website URL' });

  try {
    const supabase = getSupabase();

    const { data: existingByEmail } = await supabase
      .from('businesses')
      .select('id')
      .ilike('owner_email', email)
      .limit(1)
      .maybeSingle();
    if (existingByEmail?.id) {
      return res.status(409).json({ error: 'A business with this email already exists' });
    }
    const ownerId = await resolveOwnerIdForEmail(supabase, email);
    if (!ownerId) {
      return res.status(500).json({ error: 'Unable to provision account for this email. Please try again.' });
    }

    const geo = await geocodeLocation(cleanCity);
    const slug = `${slugify(cleanBusinessName)}-${Date.now().toString(36)}`;
    const serviceTag = serviceCategoryInput
      .trim()
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[\/,+\-_]/g, ' ')
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, '_');

    const baseInsert: Record<string, unknown> = {
      name: cleanBusinessName,
      slug,
      description: `${categoryForDescription} service in ${cleanCity}`,
      address: cleanCity,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      service_tags: [serviceTag || 'other'],
      keywords: [categoryLabel.toLowerCase(), cleanOwnerName.toLowerCase()].filter(Boolean),
      rating: 0,
      website: website || null,
      instagram: instagram || null,
      phone: phone || null,
      owner_name: cleanOwnerName,
      owner_email: email,
      owner_id: ownerId,
      is_onboarded: false,
    };

    const payloadCandidates: Record<string, unknown>[] = [
      {
        ...baseInsert,
        campus_provider: campusProvider,
        campus_school_name: campusProvider ? normalizedSchoolName.slice(0, 100) : null,
      },
      {
        ...baseInsert,
        school_domain: campusProvider ? normalizedSchoolName.slice(0, 100) : null,
      },
      baseInsert,
    ];

    let insertedID: string | null = null;
    let lastInsertError: any = null;

    for (const candidate of payloadCandidates) {
      const { data, error } = await supabase
        .from('businesses')
        .insert(candidate)
        .select('id')
        .single();

      if (!error && data?.id) {
        insertedID = data.id;
        break;
      }

      lastInsertError = error;
      if (error?.code === '23505') {
        return res.status(409).json({ error: 'A business with this email already exists' });
      }
    }

    if (!insertedID) {
      const message =
        (lastInsertError?.message as string | undefined) ||
        (lastInsertError?.details as string | undefined) ||
        'Failed to submit application';
      return res.status(500).json({ error: message });
    }

    const adminNotificationEmail =
      process.env.NEW_PROVIDER_APPLICATION_EMAIL ||
      process.env.PROVIDER_APPLICATION_ALERT_EMAIL ||
      'usescheduleme@gmail.com';
    sendNewBusinessApplicationEmail({
      to: adminNotificationEmail,
      name: cleanBusinessName,
      ownerName: cleanOwnerName,
      email,
      phone: phone || 'not provided',
      category: categoryForDescription,
      city: cleanCity,
      campusProvider,
      schoolName: campusProvider ? normalizedSchoolName : undefined,
    }).catch((notifyError) => {
      console.error('[mobile-business-signup] admin notify failed', notifyError);
    });

    return res.status(200).json({ success: true, businessId: insertedID });
  } catch (error) {
    console.error('[mobile-business-signup]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
