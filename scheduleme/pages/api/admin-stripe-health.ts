// pages/api/admin-stripe-health.ts — SECURED (admin only)
import type { NextApiRequest, NextApiResponse } from 'next';
import stripe from '../../lib/stripe';
import { setSecurityHeaders, rateLimit, requireAdmin } from '../../lib/apiSecurity';

function canonicalizeUrl(input: string): string {
  try {
    const url = new URL(input);
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString().toLowerCase();
  } catch {
    return input.trim().replace(/\/+$/, '').toLowerCase();
  }
}

function expectedWebhookCandidates(siteUrl: string): string[] {
  const base = siteUrl.replace(/\/+$/, '');
  const candidates = new Set<string>([
    canonicalizeUrl(`${base}/api/stripe-webhook`),
  ]);
  try {
    const url = new URL(base);
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.replace(/^www\./, '');
      candidates.add(canonicalizeUrl(`${url.toString().replace(/\/+$/, '')}/api/stripe-webhook`));
    } else {
      url.hostname = `www.${url.hostname}`;
      candidates.add(canonicalizeUrl(`${url.toString().replace(/\/+$/, '')}/api/stripe-webhook`));
    }
  } catch {
    // keep default candidate only
  }
  return Array.from(candidates);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'admin-stripe' }))) return;

  try {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com').replace(/\/$/, '');
    const expectedUrl = `${siteUrl}/api/stripe-webhook`;
    const expectedCandidates = expectedWebhookCandidates(siteUrl);

    const webhookSecretConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;
    let allEndpoints: any[] = [];
    let startingAfter: string | undefined = undefined;
    for (let i = 0; i < 5; i += 1) {
      const page = await stripe.webhookEndpoints.list({ limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) });
      allEndpoints = allEndpoints.concat(page.data || []);
      if (!page.has_more || !page.data?.length) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
    const match = allEndpoints.find((e: any) => expectedCandidates.includes(canonicalizeUrl(e.url || '')));

    const events = await stripe.events.list({ limit: 1 });
    const lastEvent = events.data?.[0] || null;

    return res.status(200).json({
      expectedUrl,
      expectedCandidates,
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
