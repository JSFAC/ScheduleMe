// pages/api/disconnect-stripe.ts — remove Stripe connection from business
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid, logAuditEvent } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await rateLimit(req, res, { max: 5, windowMs: 10 * 60_000, keyPrefix: 'stripe-disconnect' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { businessId } = req.body || {};
  if (!businessId) return res.status(400).json({ error: 'businessId required' });
  if (!isValidUuid(businessId)) return res.status(400).json({ error: 'Invalid businessId' });

  const supabase = getSupabase();

  const { data: business } = await supabase
    .from('businesses')
    .select('id, owner_id, owner_email, stripe_account_id')
    .eq('id', businessId)
    .single();

  if (!business) return res.status(404).json({ error: 'Business not found' });
  const normalizedOwnerEmail = String((business as any).owner_email || '').toLowerCase().trim();
  const normalizedUserEmail = String(user.email || '').toLowerCase().trim();
  if (!(business as any).owner_id && normalizedOwnerEmail && normalizedOwnerEmail === normalizedUserEmail) {
    await supabase.from('businesses').update({ owner_id: user.id }).eq('id', businessId);
    (business as any).owner_id = user.id;
  }
  if ((business as any).owner_id !== user.id) return res.status(403).json({ error: 'Access denied' });

  try {
    await supabase
      .from('businesses')
      .update({ stripe_account_id: null, stripe_onboarded: false })
      .eq('id', businessId);

    await logAuditEvent(req, 'stripe_disconnect', {
      entity_type: 'business',
      entity_id: businessId,
      actor_id: user.id,
      actor_email: user.email,
      actor_role: 'provider',
      meta: { stripe_account_id: business.stripe_account_id },
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[disconnect-stripe] error', err);
    return res.status(500).json({ error: 'Failed to disconnect Stripe.' });
  }
}
