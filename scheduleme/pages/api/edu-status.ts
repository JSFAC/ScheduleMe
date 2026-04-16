// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth } from '../../lib/apiSecurity';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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

    const { data: businessData } = await supabase
      .from('businesses')
      .select('edu_verified, school_domain, school_email')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle();

    const verified = !!(businessData?.edu_verified ?? profileData?.edu_verified);
    return res.status(200).json({
      verified,
      edu_verified: verified,
      school_domain: businessData?.school_domain ?? profileData?.school_domain ?? null,
      school_email: businessData?.school_email ?? profileData?.school_email ?? null,
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
