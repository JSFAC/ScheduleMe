// pages/api/admin-rls-status.ts
// Secured: check RLS status for core tables
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAdmin } from '../../lib/apiSecurity';
import { isCronAuthorized } from '../../lib/cronAuth';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );
}

const TABLES = [
  'businesses',
  'services',
  'reviews',
  'bookings',
  'messages',
  'profiles',
  'blocks',
  'campus_featured',
  'founder50_allowed_campuses',
  'campus_founder50_legacy_backup',
  'cron_runs',
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const cronAuthorized = isCronAuthorized(req);
  if (!cronAuthorized) {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
  }
  if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'admin-rls-status' }))) return;

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('get_rls_status', {
    p_tables: TABLES,
  });

  if (error) return res.status(500).json({ error: error.message || 'RLS status function not found. Re-run supabase/rls_policies.sql.' });
  return res.status(200).json({ tables: data || [] });
}
