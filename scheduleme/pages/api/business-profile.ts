// pages/api/business-profile.ts
// Public business details for consumer app
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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, { max: 120, windowMs: 60_000, keyPrefix: 'biz-profile' })) return;

  const { business_id } = req.query;
  if (!business_id) return res.status(400).json({ error: 'business_id required' });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, description, hours, calendly_url, availability_status, service_tags, cover_url, media_urls')
    .eq('id', business_id)
    .maybeSingle();

  if (error || !data) return res.status(200).json({ business: null });
  return res.status(200).json({ business: data });
}
