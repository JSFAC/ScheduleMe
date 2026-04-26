import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, getClientIp } from '../../lib/apiSecurity';
import { requireCaptcha } from '../../lib/captcha';
import { validateAndFilter } from '../../lib/profanity';
import { moderateText } from '../../lib/moderation';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function defaultBusinessName(ownerName: string, email: string): string {
  const cleanOwner = String(ownerName || '').trim();
  if (cleanOwner) return `${cleanOwner}'s Services`;
  const local = String(email || '').split('@')[0]?.replace(/[^a-z0-9]+/gi, ' ').trim();
  return local ? `${local} Services` : 'New Provider';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 10, windowMs: 10 * 60_000, keyPrefix: 'biz-draft' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { businessName, captchaToken, agree } = req.body || {};
  if (agree !== true) return res.status(400).json({ error: 'You must agree to the terms.' });
  if (!(await requireCaptcha(req, res, captchaToken, getClientIp(req)))) return;

  const supabase = getSupabase();
  const normalizedEmail = String(user.email || '').toLowerCase().trim();
  if (!normalizedEmail) return res.status(400).json({ error: 'Missing account email.' });

  const byOwnerId = await supabase
    .from('businesses')
    .select('id, name')
    .eq('owner_id', user.id)
    .maybeSingle();
  if (byOwnerId.data) {
    return res.status(200).json({ success: true, businessId: byOwnerId.data.id, status: 'already_exists' });
  }

  const byOwnerEmail = await supabase
    .from('businesses')
    .select('id, name, owner_id')
    .ilike('owner_email', normalizedEmail)
    .maybeSingle();
  if (byOwnerEmail.data) {
    if (!byOwnerEmail.data.owner_id) {
      await supabase.from('businesses').update({ owner_id: user.id }).eq('id', byOwnerEmail.data.id);
    }
    return res.status(200).json({ success: true, businessId: byOwnerEmail.data.id, status: 'already_exists' });
  }

  const profileRow = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();
  const ownerName = String(profileRow.data?.name || '').trim();

  const submittedName = String(businessName || '').trim();
  if (!submittedName) return res.status(400).json({ error: 'Business name is required.' });
  const candidateName = submittedName || defaultBusinessName(ownerName, normalizedEmail);
  const moderation = await moderateText(candidateName);
  if (!moderation.ok) return res.status(400).json({ error: moderation.reason || 'Business name violates content policy' });
  const nameCheck = validateAndFilter(candidateName, { maxLength: 60, fieldName: 'Business name' });
  if (!nameCheck.ok) {
    return res.status(400).json({ error: 'error' in nameCheck ? nameCheck.error : 'Invalid business name' });
  }
  const cleanName = nameCheck.value;

  const ownerCandidate = ownerName || normalizedEmail.split('@')[0] || 'Provider';
  const ownerCheck = validateAndFilter(ownerCandidate, { maxLength: 60, fieldName: 'Owner name' });
  if (!ownerCheck.ok) {
    return res.status(400).json({ error: 'error' in ownerCheck ? ownerCheck.error : 'Invalid owner name' });
  }

  const slug = `${slugify(cleanName)}-${Date.now().toString(36)}`;

  const insert = await supabase
    .from('businesses')
    .insert({
      name: cleanName,
      slug,
      description: 'Complete setup in your dashboard to publish this profile.',
      address: 'Setup in progress',
      city: 'Setup',
      zip: '00000',
      lat: null,
      lng: null,
      service_tags: ['other'],
      keywords: ['other', 'provider'],
      rating: 0,
      owner_name: ownerCheck.value,
      owner_email: normalizedEmail,
      owner_id: user.id,
      is_onboarded: false,
      public_visibility: false,
    })
    .select('id')
    .single();

  if (insert.error) {
    if (insert.error.code === '23505') return res.status(409).json({ error: 'A provider profile already exists for this account.' });
    return res.status(500).json({ error: 'Failed to create provider draft' });
  }

  try {
    await supabase.from('profiles').upsert({
      id: user.id,
      email: normalizedEmail,
      role: 'business',
      has_seen_welcome: true,
    }, { onConflict: 'id' });
  } catch {}

  return res.status(200).json({ success: true, businessId: insert.data.id, status: 'draft_created' });
}
