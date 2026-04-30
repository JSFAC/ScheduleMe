import type { NextApiRequest, NextApiResponse } from 'next';
import stripe from '../../lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await rateLimit(req, res, { max: 12, windowMs: 10 * 60_000, keyPrefix: 'stripe-connect-session' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { businessId } = req.body || {};
  if (!businessId) return res.status(400).json({ error: 'businessId required' });
  if (!isValidUuid(businessId)) return res.status(400).json({ error: 'Invalid businessId' });

  const clientPlatformHeader = String(req.headers['x-client-platform'] || '').toLowerCase();
  if (clientPlatformHeader.includes('ios-provider')) {
    return res.status(400).json({
      error: 'Embedded Stripe setup is not supported in the provider app. Use hosted onboarding instead.',
      code: 'EMBEDDED_NOT_SUPPORTED',
    });
  }

  const supabase = getSupabase();
  const { data: business } = await supabase
    .from('businesses')
    .select('id, stripe_account_id, name, owner_email, owner_id, city, zip')
    .eq('id', businessId)
    .single();

  if (!business) return res.status(404).json({ error: 'Business not found' });

  const normalizedUserEmail = (user.email || '').toLowerCase().trim();
  const normalizedOwnerEmail = (business.owner_email || '').toLowerCase().trim();

  if (!business.owner_id && normalizedOwnerEmail && normalizedOwnerEmail === normalizedUserEmail) {
    const { error: linkError } = await supabase
      .from('businesses')
      .update({ owner_id: user.id })
      .eq('id', businessId);
    if (linkError) {
      return res.status(500).json({ error: 'Failed to link business owner. Please try again.' });
    }
    business.owner_id = user.id;
  }

  if (business.owner_id !== user.id) {
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
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: business.name,
        },
        metadata: {
          scheduleme_business_id: business.id,
          scheduleme_city: String(business.city || ''),
          scheduleme_zip: String(business.zip || ''),
        },
      });
      stripeAccountId = account.id;
      await supabase.from('businesses').update({ stripe_account_id: stripeAccountId }).eq('id', businessId);
    }

    const accountSession = await stripe.accountSessions.create({
      account: stripeAccountId,
      components: {
        account_onboarding: {
          enabled: true,
          features: {
            external_account_collection: true,
          },
        },
      },
    });

    return res.status(200).json({
      account: stripeAccountId,
      client_secret: accountSession.client_secret,
      expires_at: accountSession.expires_at,
    });
  } catch (err) {
    console.error('[stripe-connect-session]', err);
    return res.status(500).json({
      error: (err as any)?.raw?.message || (err as any)?.message || 'Failed to create Stripe account session',
    });
  }
}
