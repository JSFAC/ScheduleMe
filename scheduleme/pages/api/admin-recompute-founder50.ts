// pages/api/admin-recompute-founder50.ts
// Secured cron/admin job: recompute founder50_status safely
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';
import { computeFounder50Status } from '../../lib/founder50';
import { isCronAuthorized } from '../../lib/cronAuth';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await rateLimit(req, res, { max: 5, windowMs: 60_000, keyPrefix: 'admin-founder50' }))) return;

  const sb = getSupabase();

  let updated = 0;
  let scanned = 0;
  const pageSize = 500;
  let from = 0;

  while (true) {
    const { data: rows, error } = await sb
      .from('businesses')
      .select('id, founder50, founder50_status, last_completed_booking_at, away_start, away_end')
      .eq('founder50', true)
      .range(from, from + pageSize - 1);

    if (error || !rows || rows.length === 0) break;

    for (const b of rows) {
      scanned++;
      const status = computeFounder50Status(b);
      if (status && b.founder50_status !== status && b.founder50_status !== 'revoked') {
        await sb.from('businesses').update({ founder50_status: status }).eq('id', b.id);
        updated++;
      }
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return res.status(200).json({ ok: true, scanned, updated });
}
