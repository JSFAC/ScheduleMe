// pages/api/business-change-requests.ts — submit business listing change requests
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth } from '../../lib/apiSecurity';
import { containsProfanity, containsThreat } from '../../lib/profanity';
import { sendChangeRequestAdminEmail, sendChangeRequestReceiptEmail } from '../../lib/email';

const ADMIN_EMAIL = 'usescheduleme@gmail.com';
const APPROVAL_FIELDS = new Set(['name', 'category', 'address', 'description', 'cover_url', 'media_urls', 'video_url']);
const AUTO_FIELDS = new Set(['phone', 'website', 'service_tags', 'hours', 'calendly_url']);

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
  if (!rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'biz-change-req' })) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { business_id, changes, request_type } = req.body || {};
  if (!business_id || !changes || typeof changes !== 'object')
    return res.status(400).json({ error: 'business_id and changes are required' });

  const supabase = getSupabase();
  const { data: biz, error: bizErr } = await supabase
    .from('businesses')
    .select('id, name, owner_email, owner_name, address, description, phone, website, service_tags, cover_url, media_urls, video_url, hours')
    .eq('id', business_id)
    .maybeSingle();

  if (bizErr || !biz) return res.status(404).json({ error: 'Business not found' });
  if (biz.owner_email !== user.email) return res.status(403).json({ error: 'Access denied' });

  const changesObj: Record<string, any> = changes || {};
  const keys = Object.keys(changesObj);
  if (keys.length === 0) return res.status(400).json({ error: 'No changes provided' });

  const before: Record<string, any> = {};
  let flagged = false;
  const flagReasons: string[] = [];
  let requiresApproval = false;

  for (const k of keys) {
    before[k] = (biz as any)[k] ?? null;
    if (APPROVAL_FIELDS.has(k)) requiresApproval = true;

    if (['name', 'address', 'description', 'category'].includes(k)) {
      const v = String(changesObj[k] ?? '').trim();
      if (containsThreat(v)) { flagged = true; flagReasons.push('threat content'); }
      if (containsProfanity(v)) { flagged = true; flagReasons.push('explicit language'); }
    }

    if (['cover_url', 'media_urls', 'video_url'].includes(k)) {
      flagged = true;
      flagReasons.push('image/video requires review');
      requiresApproval = true;
    }
  }

  if (flagged) requiresApproval = true;

  let status: 'pending' | 'auto_applied' = requiresApproval ? 'pending' : 'auto_applied';

  // Auto-apply low-risk changes if allowed
  if (!requiresApproval) {
    const updates: Record<string, any> = {};
    for (const k of keys) {
      if (AUTO_FIELDS.has(k)) updates[k] = changesObj[k];
    }
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('businesses').update(updates).eq('id', business_id);
      if (error) return res.status(500).json({ error: 'Failed to apply changes' });
    }
  }

  const { data: reqRow, error: insertErr } = await supabase
    .from('business_change_requests')
    .insert({
      business_id,
      requested_by: user.email,
      request_type: request_type || (keys.some(k => ['cover_url', 'media_urls', 'video_url'].includes(k)) ? 'media' : 'profile'),
      status,
      changes: changesObj,
      before,
      flagged,
      flag_reasons: flagReasons,
    })
    .select('id')
    .single();

  if (insertErr) return res.status(500).json({ error: 'Failed to create change request' });

  if (status === 'pending') {
    try {
      await sendChangeRequestAdminEmail({
        to: ADMIN_EMAIL,
        businessName: biz.name || 'Business',
        ownerName: biz.owner_name || 'Owner',
        ownerEmail: biz.owner_email,
        changes: changesObj,
        flagged,
        flagReasons,
      });
    } catch {}

    try {
      await sendChangeRequestReceiptEmail({
        to: biz.owner_email,
        businessName: biz.name || 'Business',
        ownerName: biz.owner_name || 'there',
        changes: changesObj,
      });
    } catch {}
  }

  return res.status(200).json({
    id: reqRow?.id,
    status,
    flagged,
    requiresApproval,
  });
}
