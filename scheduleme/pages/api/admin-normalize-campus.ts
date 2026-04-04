// @ts-nocheck
// pages/api/admin-normalize-campus.ts — normalize campus naming
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 10, windowMs: 60_000, keyPrefix: 'admin-normalize-campus' }))) return;
  const secret = req.headers['x-notify-secret'];
  if (!process.env.NOTIFY_SECRET || secret !== process.env.NOTIFY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const supabase = getSupabase();

  // Normalize UC Santa Cruz -> UCSC
  const { error: err1 } = await supabase
    .from('businesses')
    .update({ campus_key: 'ucsc', campus_school_name: 'UCSC' })
    .or('campus_key.eq.uc_santa_cruz,campus_key.eq.ucsc,campus_school_name.ilike.%uc% santa% cruz%');

  if (err1) return res.status(500).json({ error: err1.message || 'Failed to normalize UCSC' });

  return res.status(200).json({ success: true, message: 'Campus names normalized' });
}
