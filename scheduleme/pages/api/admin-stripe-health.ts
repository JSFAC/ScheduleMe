// pages/api/admin-stripe-health.ts — SECURED (admin only)
import type { NextApiRequest, NextApiResponse } from 'next';
import stripe from '../../lib/stripe';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.headers['x-notify-secret'];
  if (!process.env.NOTIFY_SECRET || secret !== process.env.NOTIFY_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });

  if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'admin-stripe' }))) return;

  try {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com').replace(/\/$/, '');
    const expectedUrl = `${siteUrl}/api/stripe-webhook`;

    const webhookSecretConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;
    const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });
    const match = endpoints.data.find((e: any) => e.url === expectedUrl);

    const events = await stripe.events.list({ limit: 1 });
    const lastEvent = events.data?.[0] || null;

    return res.status(200).json({
      expectedUrl,
      webhookSecretConfigured,
      endpointFound: !!match,
      endpointStatus: match?.status || null,
      endpointLivemode: match?.livemode ?? null,
      lastEventType: lastEvent?.type || null,
      lastEventCreated: lastEvent?.created ? new Date(lastEvent.created * 1000).toISOString() : null,
      lastEventLivemode: lastEvent?.livemode ?? null,
    });
  } catch (err: any) {
    console.error('[admin-stripe-health]', err);
    return res.status(500).json({ error: err?.message || 'Failed to load Stripe health' });
  }
}

