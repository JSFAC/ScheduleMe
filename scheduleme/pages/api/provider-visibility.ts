import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, rateLimit, setSecurityHeaders } from '../../lib/apiSecurity';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function loadOwnedBusiness(supabase: ReturnType<typeof getSupabase>, user: { id: string; email: string }, businessId: string) {
  const byOwner = await supabase
    .from('businesses')
    .select('id, owner_id, owner_email')
    .eq('id', businessId)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (byOwner.data) return byOwner.data;

  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return null;
  const legacy = await supabase
    .from('businesses')
    .select('id, owner_id, owner_email')
    .eq('id', businessId)
    .ilike('owner_email', email)
    .maybeSingle();
  return legacy.data || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (!(await rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'provider-visibility' }))) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const businessId = String(req.body?.business_id || '').trim();
  if (!businessId) {
    return res.status(400).json({ error: 'business_id required' });
  }

  const payload = {
    public_visibility: !!req.body?.public_visibility,
    public_show_name: !!req.body?.public_show_name,
    public_show_photos: !!req.body?.public_show_photos,
    campus_show_name: !!req.body?.campus_show_name,
  };

  try {
    const supabase = getSupabase();
    const business = await loadOwnedBusiness(supabase, user, businessId);
    if (!business) {
      return res.status(404).json({ error: 'Provider profile not found' });
    }

    const { error } = await supabase
      .from('businesses')
      .update(payload)
      .eq('id', businessId);

    if (error) {
      return res.status(500).json({ error: error.message || 'Failed to save visibility settings' });
    }

    return res.status(200).json({ success: true, ...payload });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save visibility settings' });
  }
}
