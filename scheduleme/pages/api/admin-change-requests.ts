// pages/api/admin-change-requests.ts — SECURED (admin only)
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
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase
    .from('business_change_requests')
    .select('id, business_id, requested_by, request_type, status, changes, before, flagged, flag_reasons, created_at, reviewed_at, reviewed_by, review_notes, businesses(name, owner_email, owner_name)')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: 'Failed to fetch change requests' });
  return res.status(200).json({ requests: data || [] });
}
