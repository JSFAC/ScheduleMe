import type { NextApiRequest, NextApiResponse } from 'next';
import { setSecurityHeaders, checkRateLimit, getClientIp, isValidEmail, clampString } from '../../lib/apiSecurity';

type MobilePasswordResetBody = {
  email?: string;
  client?: string;
  captchaToken?: string;
  captcha_token?: string;
};

function getSupabaseAuthBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

function isAllowedMobileClient(client: string): boolean {
  return client === 'ios-consumer' || client === 'ios-provider';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`mobile-password-reset:${ip}`, 20, 60_000);
    res.setHeader('X-RateLimit-Limit', '20');
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(rl.resetAt / 1000)));
    if (!rl.allowed) {
      return res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
    }
  } catch (rateLimitError) {
    console.error('[mobile-password-reset][rate-limit-soft-fail]', rateLimitError);
    res.setHeader('X-RateLimit-Bypass', '1');
  }

  const body = (req.body || {}) as MobilePasswordResetBody;
  const email = clampString(body.email, 254).toLowerCase();
  const client = clampString(body.client, 40).toLowerCase();
  const captchaToken = clampString((body.captchaToken ?? body.captcha_token) as string, 2048);

  if (!isAllowedMobileClient(client)) return res.status(403).json({ error: 'Unsupported mobile client' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email address' });

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!anonKey) return res.status(500).json({ error: 'Server auth anon config missing' });

  try {
    const authBase = getSupabaseAuthBaseUrl();
    const endpoint = `${authBase}/auth/v1/recover`;

    const redirectTo = client === 'ios-consumer'
      ? 'scheduleme://auth/callback'
      : 'schedulemeprovider://auth/callback';

    const payload: Record<string, unknown> = {
      email,
      redirect_to: redirectTo,
    };
    if (captchaToken) {
      payload.gotrue_meta_security = { captcha_token: captchaToken };
    }

    let upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
      },
      body: JSON.stringify(payload),
    });
    let response = await upstream.json().catch(() => ({}));

    // Fallback for projects that enforce CAPTCHA on recover for anon callers.
    if (!upstream.ok && serviceRole) {
      upstream = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceRole,
          Authorization: `Bearer ${serviceRole}`,
        },
        body: JSON.stringify(payload),
      });
      response = await upstream.json().catch(() => ({}));
    }

    if (!upstream.ok) {
      const msg =
        (response as any)?.msg ||
        (response as any)?.message ||
        (response as any)?.error_description ||
        (response as any)?.error ||
        'Unable to send reset email right now.';
      return res.status(upstream.status).json({ error: String(msg) });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[mobile-password-reset]', error);
    return res.status(500).json({ error: 'Password reset failed. Please try again.' });
  }
}
