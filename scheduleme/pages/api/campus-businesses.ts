// pages/api/campus-businesses.ts
// Service-role campus business lookup (bypasses RLS)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders } from '../../lib/apiSecurity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { limit, school_domain } = req.query;
  const limitNum = Math.min(Number(limit ?? 40), 200);
  const schoolDomain = typeof school_domain === 'string' && school_domain.trim() ? school_domain.trim() : null;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } });

  let query = sb
    .from('businesses')
    .select('id, name, slug, description, address, lat, lng, service_tags, cover_url, media_urls, phone, website, calendly_url, rating, review_count, price_tier, is_onboarded, edu_verified, campus_provider, school_domain')
    .eq('is_onboarded', true)
    .eq('edu_verified', true)
    .eq('campus_provider', true)
    .order('rating', { ascending: false });

  if (schoolDomain) query = query.eq('school_domain', schoolDomain);

  const { data: rows, error } = await query.limit(limitNum);
  if (error || !rows) return res.status(200).json({ businesses: [] });

  return res.status(200).json({ businesses: rows });
}
