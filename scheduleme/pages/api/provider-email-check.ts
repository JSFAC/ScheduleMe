import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { isValidEmail, rateLimit, setSecurityHeaders } from '../../lib/apiSecurity';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'provider-email-check' }))) return;

  const rawEmail = typeof req.query.email === 'string' ? req.query.email : '';
  const email = rawEmail.trim().toLowerCase();

  if (!email) return res.status(200).json({ exists: false });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email address' });

  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('businesses')
      .select('id, is_onboarded')
      .ilike('owner_email', email)
      .limit(1)
      .maybeSingle();

    const exists = !!data?.id;
    const status = !exists
      ? null
      : data?.is_onboarded === true
        ? 'approved'
        : 'pending';

    return res.status(200).json({ exists, status });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
