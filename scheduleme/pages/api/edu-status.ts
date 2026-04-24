// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth } from '../../lib/apiSecurity';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 40, windowMs: 60_000, keyPrefix: 'edu-status' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const supabase = getSupabase();
    const { data: profileData } = await supabase
      .from('profiles')
      .select('edu_verified, school_domain, school_email, campus_key')
      .eq('id', user.id)
      .maybeSingle();

    // Single source of truth: profile EDU state is authoritative for both
    // consumer and provider in the unified app.
    const verified = profileData?.edu_verified === true;
    const normalizedProfileDomain =
      profileData?.school_domain && String(profileData.school_domain).trim()
        ? String(profileData.school_domain).trim().toLowerCase()
        : null;
    const emailDomain = profileData?.school_email && String(profileData.school_email).includes('@')
      ? String(profileData.school_email).split('@').pop()?.toLowerCase() ?? null
      : null;
    const campusKeyDomain =
      profileData?.campus_key && String(profileData.campus_key).trim()
        ? `${String(profileData.campus_key).trim().toLowerCase()}.edu`
        : null;
    const derivedDomain = normalizedProfileDomain || emailDomain || campusKeyDomain;

    // Transitional compatibility: if an older verified account is missing
    // profile domain fields, borrow owned business domain for read-time only.
    let compatibilityBusinessDomain: string | null = null;
    if (verified && !derivedDomain) {
      const { data: businessData } = await supabase
        .from('businesses')
        .select('school_domain')
        .eq('owner_id', user.id)
        .not('school_domain', 'is', null)
        .limit(1)
        .maybeSingle();
      compatibilityBusinessDomain =
        businessData?.school_domain && String(businessData.school_domain).trim()
          ? String(businessData.school_domain).trim().toLowerCase()
          : null;
    }

    return res.status(200).json({
      verified,
      edu_verified: verified,
      school_domain: derivedDomain || compatibilityBusinessDomain || null,
      school_email: profileData?.school_email ?? null,
      campus_key: profileData?.campus_key ?? null,
    });
  } catch (err) {
    console.error('[edu-status]', err);
    return res.status(200).json({
      verified: false,
      edu_verified: false,
      school_domain: null,
      school_email: null,
      campus_key: null,
    });
  }
}
