import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { normalizeServiceTags } from '../../lib/categoryNormalization';
import { geocodeUsLocation } from '../../lib/providerMetadata';
import { rateLimit, requireAuth, setSecurityHeaders } from '../../lib/apiSecurity';

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

  if (legacy.data && !legacy.data.owner_id) {
    await supabase.from('businesses').update({ owner_id: user.id }).eq('id', businessId);
    return { ...legacy.data, owner_id: user.id };
  }

  return legacy.data || null;
}

function normalizeZip(input: unknown): string {
  return String(input || '').trim();
}

function normalizeCity(input: unknown): string {
  return String(input || '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

function normalizeManualPayoutDetails(input: unknown): string {
  return String(input || '').trim().replace(/\s+/g, ' ').slice(0, 180);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'provider-settings' }))) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireAuth(req, res);
  if (!user) return;

  const businessId = String(req.body?.business_id || '').trim();
  if (!businessId) return res.status(400).json({ error: 'business_id required' });

  const city = normalizeCity(req.body?.city);
  const zip = normalizeZip(req.body?.zip);
  if (!city) return res.status(400).json({ error: 'City is required' });
  if (!/^\d{5}(?:-\d{4})?$/.test(zip)) return res.status(400).json({ error: 'Valid ZIP code required' });

  const zellePayoutDetails = normalizeManualPayoutDetails(req.body?.zelle_payout_details);
  const requestedAvailabilityStatus = String(req.body?.availability_status || 'open').trim().toLowerCase();
  const breakUntil = req.body?.break_until ? String(req.body.break_until) : null;
  const hours = req.body?.hours ?? null;
  const serviceTags = Array.isArray(req.body?.service_tags)
    ? normalizeServiceTags(req.body.service_tags.map((tag: unknown) => String(tag)))
    : [];

  const address = `${city}, ${zip}`;
  const geocode = await geocodeUsLocation(zip) || await geocodeUsLocation(address);

  try {
    const supabase = getSupabase();
    const business = await loadOwnedBusiness(supabase, user, businessId);
    if (!business) return res.status(404).json({ error: 'Provider profile not found' });

    const stripeReady = Boolean((business as any)?.stripe_onboarded && (business as any)?.stripe_account_id);
    const payoutConfigured = stripeReady || !!zellePayoutDetails;
    const availabilityStatus = requestedAvailabilityStatus === 'open' && !payoutConfigured
      ? 'setup_required'
      : (requestedAvailabilityStatus || 'open');

    const payload: Record<string, any> = {
      zelle_payout_details: zellePayoutDetails || null,
      city,
      zip,
      address,
      lat: geocode?.lat ?? null,
      lng: geocode?.lng ?? null,
      service_tags: serviceTags.length > 0 ? serviceTags : ['other'],
      hours,
      availability_status: availabilityStatus || 'open',
      break_until: breakUntil,
      public_visibility: req.body?.public_visibility !== false,
      public_show_name: req.body?.public_show_name !== false,
      public_show_photos: req.body?.public_show_photos !== false,
      campus_show_name: req.body?.campus_show_name !== false,
    };

    const { data, error } = await supabase
      .from('businesses')
      .update(payload)
      .eq('id', businessId)
      .select('id, website, instagram, zelle_payout_details, city, zip, address, lat, lng, service_tags, hours, availability_status, break_until, public_visibility, public_show_name, public_show_photos, campus_show_name, stripe_onboarded, stripe_account_id')
      .single();

    if (error) return res.status(500).json({ error: error.message || 'Failed to save provider settings' });
    return res.status(200).json({ success: true, business: data });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save provider settings' });
  }
}
