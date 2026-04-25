// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';
import { isProviderPubliclyVisible } from '../../lib/providerTrust';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 120, windowMs: 60_000, keyPrefix: 'business-lookup' }))) return;

  const id = typeof req.query.id === 'string' ? req.query.id.trim() : '';
  const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';
  if (!id && !slug) return res.status(400).json({ error: 'Provide id or slug' });

  try {
    const sb = getSupabase();
    const primarySelect = 'id,name,slug,description,address,lat,lng,service_tags,cover_url,media_urls,phone,website,calendly_url,rating,review_count,price_tier,founder50,availability_status,campus_provider,edu_verified,public_visibility,public_show_name,public_show_media,school_domain,campus_school_name,stripe_onboarded,stripe_account_id,is_onboarded';
    const legacySelect = 'id,name,slug,description,address,lat,lng,service_tags,cover_url,media_urls,phone,website,calendly_url,rating,review_count,price_tier,founder50,availability_status,campus_provider,edu_verified,public_visibility,school_domain,is_onboarded';
    let query = sb
      .from('businesses')
      .select(primarySelect)
      .eq('is_onboarded', true)
      .limit(1);

    if (id) query = query.eq('id', id);
    else query = query.eq('slug', slug);

    let { data, error } = await query.maybeSingle();
    if (error) {
      let fallback = sb
        .from('businesses')
        .select(legacySelect)
        .eq('is_onboarded', true)
        .limit(1);
      if (id) fallback = fallback.eq('id', id);
      else fallback = fallback.eq('slug', slug);
      const fallbackResult = await fallback.maybeSingle();
      data = fallbackResult.data;
      error = fallbackResult.error;
    }
    if (error) return res.status(500).json({ error: 'Lookup failed' });
    if (!data) return res.status(404).json({ error: 'Business not found' });
    if (!isProviderPubliclyVisible(data as any)) return res.status(404).json({ error: 'Business not found' });

    return res.status(200).json({ business: data });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Lookup failed' });
  }
}
