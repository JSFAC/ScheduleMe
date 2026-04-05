// pages/api/edu-status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function deriveCampusTag(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) {
    const domain = trimmed.split('@')[1] || '';
    const base = domain.split('.')[0] || '';
    return base ? base.toUpperCase() : null;
  }
  if (trimmed.includes('.edu')) {
    const base = trimmed.split('.')[0] || '';
    return base ? base.toUpperCase() : null;
  }
  if (trimmed.length <= 8) return trimmed.toUpperCase();
  const words = trimmed.replace(/[^a-z0-9]+/gi, ' ').trim().split(/\s+/);
  const acronym = words.map(w => w[0]).join('').toUpperCase();
  return acronym || trimmed.toUpperCase();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'edu-status' }))) return;

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing auth token' });
  const debug = req.query.debug === '1';

  try {
    const supabase = getSupabase();
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid session' });

    const user = userData.user;
    const userId = user.id;
    const email = user.email || '';

    const emailSafe = email.replace(/'/g, "''");
    const { data: profileCombined } = await supabase
      .from('profiles')
      .select('edu_verified, school_name, school_domain, school_email, email, id')
      .or(`id.eq.${userId},email.ilike.${emailSafe}`)
      .limit(1)
      .maybeSingle();

    const { data: profileById } = await supabase
      .from('profiles')
      .select('edu_verified, school_name, school_domain, school_email')
      .eq('id', userId)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from('profiles')
      .select('edu_verified, school_name, school_domain, school_email')
      .ilike('email', email)
      .maybeSingle();

    const resolvedProfile = (() => {
      if (profileCombined?.school_email || profileCombined?.school_domain || profileCombined?.school_name) {
        return profileCombined;
      }
      if (profileByEmail?.school_email || profileByEmail?.school_domain || profileByEmail?.school_name) {
        return profileByEmail;
      }
      return profileById || profileByEmail || profileCombined || null;
    })();

    const { data: biz } = await supabase
      .from('businesses')
      .select('edu_verified, school_domain')
      .eq('owner_email', email)
      .maybeSingle();

    const verified = resolvedProfile?.edu_verified === true || profileById?.edu_verified === true || profileByEmail?.edu_verified === true || biz?.edu_verified === true;
    const emailDomain = email.split('@')[1] || '';
    const inferredDomain = emailDomain.endsWith('.edu') ? emailDomain : null;
    const schoolEmailDomain = resolvedProfile?.school_email?.split('@')[1] || null;
    const schoolDomain =
      resolvedProfile?.school_domain ||
      schoolEmailDomain ||
      resolvedProfile?.school_name ||
      biz?.school_domain ||
      inferredDomain ||
      null;

    const campusTag = deriveCampusTag(schoolDomain || resolvedProfile?.school_email || resolvedProfile?.school_name || null);

    return res.status(200).json({
      verified,
      schoolDomain,
      schoolEmail: resolvedProfile?.school_email || null,
      schoolName: resolvedProfile?.school_name || null,
      campusTag,
      ...(debug ? {
        authUserId: userId,
        authEmail: email,
        profileIdById: profileById ? 'found' : null,
        profileIdByEmail: profileByEmail ? 'found' : null,
        profileCombined: profileCombined ? 'found' : null,
      } : {}),
    });
  } catch (err) {
    console.error('[edu-status] error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
