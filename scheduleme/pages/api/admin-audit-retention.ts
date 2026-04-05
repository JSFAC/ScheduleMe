// pages/api/admin-audit-retention.ts
// Cron job: prune audit_logs older than retention window
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

const RETENTION_DAYS = 180;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await rateLimit(req, res, { max: 10, windowMs: 60_000, keyPrefix: 'audit-retention' }))) return;

  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('audit_logs')
    .delete()
    .lt('created_at', cutoff);

  if (error) return res.status(500).json({ error: error.message || 'Failed to prune audit logs' });
  return res.status(200).json({ ok: true, retention_days: RETENTION_DAYS, cutoff });
}
