import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { sendBusinessApplicationRejectedEmail } from '../../lib/email';
import { setSecurityHeaders, rateLimit, requireAdmin, logAuditEvent, clampString } from '../../lib/apiSecurity';

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
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (!(await rateLimit(req, res, { max: 20, windowMs: 60_000, keyPrefix: 'reject-business' }))) return;

  const businessId = clampString(req.body?.businessId, 100);
  const reason = clampString(req.body?.reason, 1000);
  if (!businessId) return res.status(400).json({ error: 'businessId required' });
  if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });

  const supabase = getSupabase();

  try {
    const { data: business, error: fetchError } = await supabase
      .from('businesses')
      .select('id, name, owner_name, owner_email, is_onboarded')
      .eq('id', businessId)
      .maybeSingle();

    if (fetchError || !business) return res.status(404).json({ error: 'Provider not found' });
    if (business.is_onboarded) return res.status(400).json({ error: 'Cannot reject an approved provider' });

    const payload: Record<string, any> = {
      is_onboarded: false,
      updated_at: new Date().toISOString(),
      status: 'rejected',
      review_notes: reason,
    };

    const { error: updateError } = await supabase.from('businesses').update(payload).eq('id', businessId);
    if (updateError) {
      // Fallback for environments that do not yet have status/review_notes columns.
      const { error: fallbackError } = await supabase
        .from('businesses')
        .update({ is_onboarded: false, updated_at: new Date().toISOString() })
        .eq('id', businessId);
      if (fallbackError) return res.status(500).json({ error: 'Failed to reject provider' });
    }

    await logAuditEvent(req, 'admin_reject_business', {
      entity_type: 'provider',
      entity_id: businessId,
      actor_role: 'admin',
      actor_id: admin.id,
      actor_email: admin.email,
      meta: { reason },
    });

    if (!business.owner_email) {
      return res.status(500).json({ error: 'Provider rejected but no email address is on file. Add owner email and retry.' });
    }

    try {
      await sendBusinessApplicationRejectedEmail({
        to: business.owner_email,
        ownerName: business.owner_name || 'there',
        businessName: business.name || 'your provider profile',
        reason,
      });
    } catch (emailErr) {
      console.error('[reject-business] email failed', emailErr);
      return res.status(500).json({ error: 'Provider rejected, but rejection email failed to send. Please retry.' });
    }

    return res.status(200).json({ success: true, message: `Rejected ${business.name} and sent rejection email` });
  } catch (err) {
    console.error('[reject-business] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
