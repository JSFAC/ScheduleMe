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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'edu-status' })) return;

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const supabase = getSupabase();
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid session' });

    const user = userData.user;
    const userId = user.id;
    const email = user.email || '';

    const { data: profile } = await supabase
      .from('profiles')
      .select('edu_verified, school_name, school_domain')
      .eq('id', userId)
      .maybeSingle();

    const { data: biz } = await supabase
      .from('businesses')
      .select('edu_verified, school_domain')
      .eq('owner_email', email)
      .maybeSingle();

    const verified = profile?.edu_verified === true || biz?.edu_verified === true;
    const schoolDomain = profile?.school_name || profile?.school_domain || biz?.school_domain || null;

    return res.status(200).json({ verified, schoolDomain });
  } catch (err) {
    console.error('[edu-status] error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
