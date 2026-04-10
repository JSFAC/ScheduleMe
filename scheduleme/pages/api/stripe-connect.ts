// pages/api/stripe-connect.ts — SECURED
import type { NextApiRequest, NextApiResponse } from 'next';
import stripe from '../../lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await rateLimit(req, res, { max: 5, windowMs: 60 * 60_000, keyPrefix: 'stripe-connect' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { businessId, mode } = req.body;
  if (!businessId) return res.status(400).json({ error: 'businessId required' });
  if (!isValidUuid(businessId)) return res.status(400).json({ error: 'Invalid businessId' });

  const supabase = getSupabase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';

  const { data: business } = await supabase.from('businesses')
    .select('id, stripe_account_id, name, owner_email, owner_id').eq('id', businessId).single();

  if (!business) return res.status(404).json({ error: 'Business not found' });

  const normalizedUserEmail = (user.email || '').toLowerCase().trim();
  const normalizedOwnerEmail = (business.owner_email || '').toLowerCase().trim();
  const hasOwnerId = !!business.owner_id;

  // Legacy records may have owner_email set but owner_id missing.
  // Safely self-heal by linking owner_id to the authenticated user when emails match.
  if (!hasOwnerId && normalizedOwnerEmail && normalizedOwnerEmail === normalizedUserEmail) {
    const { error: linkError } = await supabase
      .from('businesses')
      .update({ owner_id: user.id })
      .eq('id', businessId);
    if (linkError) {
      console.error('[stripe-connect] failed to link legacy owner_id', {
        businessId,
        userId: user.id,
        ownerEmail: business.owner_email || null,
      });
      return res.status(500).json({ error: 'Failed to link business owner. Please try again.' });
    }
    business.owner_id = user.id;
  }

  // Must own this business
  if (business.owner_id !== user.id) {
    console.warn('[stripe-connect] ownership mismatch', {
      businessId,
      ownerId: business.owner_id || null,
      userId: user.id,
      ownerEmail: business.owner_email || null,
      userEmail: user.email || null,
      userAgent: req.headers['user-agent'] || null,
    });
    return res.status(403).json({
      error: 'This signed-in account is not linked to this provider business.',
      code: 'OWNER_MISMATCH',
      ownerEmail: business.owner_email || null,
    });
  }

  try {
    let stripeAccountId = business.stripe_account_id;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: business.owner_email || user.email || undefined,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        business_profile: { name: business.name },
      });
      stripeAccountId = account.id;
      await supabase.from('businesses').update({ stripe_account_id: stripeAccountId }).eq('id', businessId);
    }

    const linkType = 'account_onboarding';
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${siteUrl}/business/dashboard?stripe=refresh&id=${businessId}`,
      return_url: `${siteUrl}/business/dashboard?stripe=success&id=${businessId}`,
      type: linkType,
    });

    return res.status(200).json({ url: accountLink.url });
  } catch (err) {
    console.error('[stripe-connect]', err);
    return res.status(500).json({ error: (err as any)?.raw?.message || (err as any)?.message || 'Failed to create Stripe onboarding link' });
  }
}
