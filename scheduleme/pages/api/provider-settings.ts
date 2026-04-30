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
    .select('id, owner_id, owner_email, stripe_onboarded, stripe_account_id, city, zip, address, lat, lng, service_tags, hours, availability_status, break_until, public_visibility, public_show_name, public_show_photos, campus_show_name, zelle_payout_details')
    .eq('id', businessId)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (byOwner.data) return byOwner.data;

  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return null;

  const legacy = await supabase
    .from('businesses')
    .select('id, owner_id, owner_email, stripe_onboarded, stripe_account_id, city, zip, address, lat, lng, service_tags, hours, availability_status, break_until, public_visibility, public_show_name, public_show_photos, campus_show_name, zelle_payout_details')
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

  const zellePayoutDetails = normalizeManualPayoutDetails(req.body?.zelle_payout_details);
  const hasCity = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'city');
  const hasZip = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'zip');
  const hasZelle = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'zelle_payout_details');
  const hasAvailabilityStatus = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'availability_status');
  const hasBreakUntil = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'break_until');
  const hasHours = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'hours');
  const hasServiceTags = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'service_tags');
  const hasPublicVisibility = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'public_visibility');
  const hasPublicShowName = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'public_show_name');
  const hasPublicShowPhotos = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'public_show_photos');
  const hasCampusShowName = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'campus_show_name');

  const requestedAvailabilityStatus = hasAvailabilityStatus
    ? String(req.body?.availability_status || 'open').trim().toLowerCase()
    : '';
  const breakUntil = hasBreakUntil && req.body?.break_until ? String(req.body.break_until) : null;
  const hours = hasHours ? (req.body?.hours ?? null) : null;
  const serviceTags = hasServiceTags && Array.isArray(req.body?.service_tags)
    ? normalizeServiceTags(req.body.service_tags.map((tag: unknown) => String(tag)))
    : [];

  try {
    const supabase = getSupabase();
    const business = await loadOwnedBusiness(supabase, user, businessId);
    if (!business) return res.status(404).json({ error: 'Provider profile not found' });

    const city = hasCity ? normalizeCity(req.body?.city) : normalizeCity((business as any)?.city);
    const zip = hasZip ? normalizeZip(req.body?.zip) : normalizeZip((business as any)?.zip);
    const changingLocation = hasCity || hasZip;
    if (changingLocation) {
      if (!city) return res.status(400).json({ error: 'City is required' });
      if (!/^\d{5}(?:-\d{4})?$/.test(zip)) return res.status(400).json({ error: 'Valid ZIP code required' });
    }

    const address = city && zip ? `${city}, ${zip}` : '';
    const geocode = changingLocation && address
      ? (await geocodeUsLocation(zip)) || (await geocodeUsLocation(address))
      : null;

    const stripeReady = Boolean((business as any)?.stripe_onboarded && (business as any)?.stripe_account_id);
    const effectiveZellePayoutDetails = hasZelle
      ? zellePayoutDetails
      : normalizeManualPayoutDetails((business as any)?.zelle_payout_details);
    const payoutConfigured = stripeReady || !!effectiveZellePayoutDetails;
    const baseAvailabilityStatus = hasAvailabilityStatus
      ? (requestedAvailabilityStatus || 'open')
      : String((business as any)?.availability_status || 'open').trim().toLowerCase();
    const availabilityStatus = baseAvailabilityStatus === 'open' && !payoutConfigured
      ? 'setup_required'
      : baseAvailabilityStatus === 'setup_required' && payoutConfigured
        ? 'open'
        : (baseAvailabilityStatus || 'open');

    const payload: Record<string, any> = {};
    if (hasZelle) payload.zelle_payout_details = effectiveZellePayoutDetails || null;
    if (changingLocation) {
      payload.city = city;
      payload.zip = zip;
      payload.address = address;
      payload.lat = geocode?.lat ?? null;
      payload.lng = geocode?.lng ?? null;
    }
    if (hasServiceTags) payload.service_tags = serviceTags.length > 0 ? serviceTags : ['other'];
    if (hasHours) payload.hours = hours;
    if (hasAvailabilityStatus || hasZelle) payload.availability_status = availabilityStatus || 'open';
    if (hasBreakUntil) payload.break_until = breakUntil;
    if (hasPublicVisibility) payload.public_visibility = req.body?.public_visibility !== false;
    if (hasPublicShowName) payload.public_show_name = req.body?.public_show_name !== false;
    if (hasPublicShowPhotos) payload.public_show_photos = req.body?.public_show_photos !== false;
    if (hasCampusShowName) payload.campus_show_name = req.body?.campus_show_name !== false;

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
