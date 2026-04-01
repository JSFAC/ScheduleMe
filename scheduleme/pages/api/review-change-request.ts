// pages/api/review-change-request.ts — SECURED (admin only)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';
import { sendChangeRequestDecisionEmail } from '../../lib/email';

const ALLOWED_FIELDS = new Set(['name', 'address', 'description', 'cover_url', 'media_urls', 'video_url', 'service_tags', 'phone', 'website', 'hours', 'calendly_url']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.headers['x-notify-secret'];
  if (!process.env.NOTIFY_SECRET || secret !== process.env.NOTIFY_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });

  if (!rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'admin-review' })) return;

  const { id, action, notes } = req.body || {};
  if (!id || !['approve', 'reject'].includes(action))
    return res.status(400).json({ error: 'id and valid action are required' });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: reqRow, error: reqErr } = await supabase
    .from('business_change_requests')
    .select('id, business_id, changes, status, businesses(name, owner_email, owner_name)')
    .eq('id', id)
    .maybeSingle();

  if (reqErr || !reqRow) return res.status(404).json({ error: 'Request not found' });

  if (action === 'approve') {
    const updates: Record<string, any> = {};
    Object.entries(reqRow.changes || {}).forEach(([k, v]) => {
      if (ALLOWED_FIELDS.has(k)) updates[k] = v;
    });
    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await supabase.from('businesses').update(updates).eq('id', reqRow.business_id);
      if (upErr) return res.status(500).json({ error: 'Failed to apply changes' });
    }
    await supabase.from('business_change_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: 'admin', review_notes: notes || null })
      .eq('id', id);

    try {
      await sendChangeRequestDecisionEmail({
        to: reqRow.businesses?.owner_email,
        businessName: reqRow.businesses?.name || 'Business',
        ownerName: reqRow.businesses?.owner_name || 'there',
        approved: true,
        notes,
      });
    } catch {}

    return res.status(200).json({ success: true, status: 'approved' });
  }

  await supabase.from('business_change_requests')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: 'admin', review_notes: notes || null })
    .eq('id', id);

  try {
    await sendChangeRequestDecisionEmail({
      to: reqRow.businesses?.owner_email,
      businessName: reqRow.businesses?.name || 'Business',
      ownerName: reqRow.businesses?.owner_name || 'there',
      approved: false,
      notes,
    });
  } catch {}

  return res.status(200).json({ success: true, status: 'rejected' });
}
