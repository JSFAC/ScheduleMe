// pages/api/admin-rls-status.ts
// Secured: check RLS status for core tables
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';
import { isCronAuthorized } from '../../lib/cronAuth';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
  'campus_featured',
  'cron_runs',
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'admin-rls-status' }))) return;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('pg_tables')
    .select('tablename, rowsecurity')
    .eq('schemaname', 'public')
    .in('tablename', TABLES);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ tables: data || [] });
}
