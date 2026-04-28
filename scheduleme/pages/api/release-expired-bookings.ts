import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';
import { isCronAuthorized } from '../../lib/cronAuth';
import { releaseHeldFundsForBooking } from '../../lib/bookingFunds';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await rateLimit(req, res, { max: 10, windowMs: 60_000, keyPrefix: 'release-expired-bookings' }))) return;

  const supabase = getSupabase();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('bookings')
    .select('id')
    .eq('status', 'completed')
    .not('paid_at', 'is', null)
    .is('disputed_at', null)
    .not('consumer_confirmation_due_at', 'is', null)
    .lte('consumer_confirmation_due_at', nowIso)
    .limit(100);

  if (error) return res.status(500).json({ error: error.message || 'Failed to load expired bookings' });

  const results: Array<{ bookingId: string; ok: boolean; released?: boolean; alreadyReleased?: boolean; error?: string | null }> = [];
  for (const row of data || []) {
    try {
      const released = await releaseHeldFundsForBooking({
        supabase,
        bookingId: row.id,
        reason: 'consumer_confirmation_window_expired',
      });
      results.push({
        bookingId: row.id,
        ok: !!released.ok,
        released: !!released.ok && !released.alreadyReleased,
        alreadyReleased: !!released.alreadyReleased,
        error: released.ok ? null : released.error,
      });
    } catch (err: any) {
      results.push({
        bookingId: row.id,
        ok: false,
        error: err?.message || 'release_failed',
      });
    }
  }

  return res.status(200).json({
    ok: true,
    scanned: (data || []).length,
    released: results.filter((r) => r.released).length,
    alreadyReleased: results.filter((r) => r.alreadyReleased).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
