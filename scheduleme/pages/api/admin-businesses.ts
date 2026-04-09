// pages/api/admin-businesses.ts — SECURED (admin only)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAdmin } from '../../lib/apiSecurity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'admin' }))) return;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const campus = typeof req.query.campus === 'string' ? req.query.campus : '';

  const baseSelect = 'id, name, owner_name, owner_email, phone, address, city, zip, website, instagram, service_tags, is_onboarded, stripe_onboarded, created_at, approved_at, campus_school_name, campus_key, campus_provider, school_domain, founder50, founder50_status';
  const extendedSelect = `${baseSelect}, status, review_notes`;

  async function run(selectString: string) {
    let query = supabase
      .from('businesses')
      .select(selectString)
      .order('created_at', { ascending: false });
    if (campus) query = query.eq('campus_key', campus);
    return query;
  }

  let { data, error } = await run(extendedSelect);
  if (error) {
    const fallback = await run(baseSelect);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) return res.status(500).json({ error: 'Failed to fetch providers' });
  return res.status(200).json({ businesses: data });
}
