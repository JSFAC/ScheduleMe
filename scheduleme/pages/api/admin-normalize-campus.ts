// @ts-nocheck
// pages/api/admin-normalize-campus.ts — normalize campus naming
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAdmin } from '../../lib/apiSecurity';

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
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (!(await rateLimit(req, res, { max: 10, windowMs: 60_000, keyPrefix: 'admin-normalize-campus' }))) return;
  const supabase = getSupabase();

  // If a school domain exists, prefer it as the campus key
  const { error: err0 } = await supabase
    .from('businesses')
    .update({ campus_key: null })
    .is('campus_key', null);
  if (err0) return res.status(500).json({ error: err0.message || 'Failed to prepare campus normalization' });

  const { data: domainRows, error: domainErr } = await supabase
    .from('businesses')
    .select('id, school_domain')
    .not('school_domain', 'is', null);
  if (domainErr) return res.status(500).json({ error: domainErr.message || 'Failed to fetch domains' });

  for (const row of domainRows || []) {
    const domain = String(row.school_domain || '').trim().toLowerCase();
    if (!domain) continue;
    const { error } = await supabase.from('businesses').update({ campus_key: domain }).eq('id', row.id);
    if (error) return res.status(500).json({ error: error.message || 'Failed to set domain campus key' });
  }

  // Normalize UC Santa Cruz -> UCSC (keep domain key when present)
  const { error: err1 } = await supabase
    .from('businesses')
    .update({ campus_key: 'ucsc.edu', campus_school_name: 'UCSC' })
    .is('school_domain', null)
    .or('campus_key.eq.uc_santa_cruz,campus_key.eq.ucsc,campus_key.eq.ucsc.edu,campus_school_name.ilike.%uc% santa% cruz%');

  if (err1) return res.status(500).json({ error: err1.message || 'Failed to normalize UCSC' });

  // Normalize Arizona State University -> ASU (keep domain key when present)
  const { error: err2 } = await supabase
    .from('businesses')
    .update({ campus_key: 'asu.edu', campus_school_name: 'ASU' })
    .is('school_domain', null)
    .or('campus_key.eq.arizona_state_university,campus_key.eq.asu,campus_key.eq.asu.edu,campus_key.eq.a,campus_school_name.ilike.%arizona% state% university%,campus_school_name.ilike.%asu%');

  if (err2) return res.status(500).json({ error: err2.message || 'Failed to normalize ASU' });

  // Normalize San Francisco State University -> SF State (keep domain key when present)
  const { error: err3 } = await supabase
    .from('businesses')
    .update({ campus_key: 'sfsu.edu', campus_school_name: 'SF State' })
    .is('school_domain', null)
    .or('campus_key.eq.san_francisco_state_university,campus_key.eq.sf_state,campus_key.eq.sfsu,campus_key.eq.sfsu.edu,campus_key.eq.csu_sf,campus_school_name.ilike.%san% francisco% state% university%,campus_school_name.ilike.%sf% state%,campus_school_name.ilike.%sfsu%,campus_school_name.ilike.%csu% sf%');

  if (err3) return res.status(500).json({ error: err3.message || 'Failed to normalize SF State' });

  return res.status(200).json({ success: true, message: 'Campus names normalized' });
}
