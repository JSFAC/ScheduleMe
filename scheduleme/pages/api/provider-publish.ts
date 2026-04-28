import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth } from '../../lib/apiSecurity';
import { getTrustState, isProviderPubliclyVisible } from '../../lib/providerTrust';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

type Checklist = {
  coreProfile: boolean;
  services: boolean;
  media: boolean;
  stripe: boolean;
  trustClear: boolean;
  readyToPublish: boolean;
};

function buildChecklist(business: any, servicesCount: number): Checklist {
  const hasCoreProfile = Boolean(
    business?.name
    && business?.description
    && (business?.address || business?.city || business?.zip)
  );
  const hasMedia = Boolean(
    business?.cover_url
    || (Array.isArray(business?.media_urls) && business.media_urls.length > 0)
  );
  const hasServices = servicesCount > 0;
  const hasStripe = Boolean(business?.stripe_onboarded && business?.stripe_account_id);
  const trustState = getTrustState(business);
  const trustClear = trustState !== 'suspended' && trustState !== 'flagged';
  return {
    coreProfile: hasCoreProfile,
    services: hasServices,
    media: hasMedia,
    stripe: hasStripe,
    trustClear,
    readyToPublish: hasCoreProfile && hasServices && hasMedia && hasStripe && trustClear,
  };
}

async function loadOwnedBusiness(supabase: ReturnType<typeof getSupabase>, user: { id: string; email: string }) {
  const byOwner = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle();
  if (byOwner.data) return byOwner.data;

  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return null;
  const legacy = await supabase
    .from('businesses')
    .select('*')
    .ilike('owner_email', email)
    .maybeSingle();
  return legacy.data || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'provider-publish' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const supabase = getSupabase();
  const business = await loadOwnedBusiness(supabase, user);
  if (!business) return res.status(404).json({ error: 'Provider profile not found' });

  const { count: servicesCountRaw } = await supabase
    .from('services')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', business.id)
    .eq('active', true);
  const servicesCount = Number(servicesCountRaw || 0);
  const checklist = buildChecklist(business, servicesCount);

  if (req.method === 'GET') {
    return res.status(200).json({
      checklist,
      is_live: isProviderPubliclyVisible(business),
      trust_status: getTrustState(business),
      published_at: business.published_at || null,
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = String(req.body?.action || '').trim().toLowerCase();
  if (!['publish', 'unpublish'].includes(action)) {
    return res.status(400).json({ error: 'action must be publish or unpublish' });
  }

  if (action === 'publish') {
    if (!checklist.readyToPublish) {
      return res.status(400).json({
        error: 'Complete all publish requirements before going live.',
        checklist,
      });
    }
    const payload: Record<string, any> = {
      is_onboarded: true,
      public_visibility: true,
      published_at: business.published_at || new Date().toISOString(),
    };
    const trustState = getTrustState(business);
    if (trustState === 'clear') payload.trust_flagged = false;

    const { error } = await supabase
      .from('businesses')
      .update(payload)
      .eq('id', business.id);
    if (error) return res.status(500).json({ error: 'Failed to publish profile' });
    return res.status(200).json({ success: true, action: 'publish', checklist });
  }

  const { error } = await supabase
    .from('businesses')
    .update({ public_visibility: false })
    .eq('id', business.id);
  if (error) return res.status(500).json({ error: 'Failed to unpublish profile' });
  return res.status(200).json({ success: true, action: 'unpublish', checklist });
}
