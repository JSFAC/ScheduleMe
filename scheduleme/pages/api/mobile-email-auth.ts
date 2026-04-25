import type { NextApiRequest, NextApiResponse } from 'next';
import { setSecurityHeaders, checkRateLimit, getClientIp, isValidEmail, clampString } from '../../lib/apiSecurity';

type AuthMode = 'login' | 'signup';

type MobileAuthBody = {
  email?: string;
  password?: string;
  mode?: AuthMode;
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

  // Keep mobile email auth available even when external rate-limit infrastructure is degraded.
  // This route uses the in-process limiter directly to avoid auth outages.
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`mobile-email-auth:${ip}`, 30, 60_000);
    res.setHeader('X-RateLimit-Limit', '30');
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(rl.resetAt / 1000)));
    if (!rl.allowed) {
      return res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
    }
  } catch (rateLimitError) {
    console.error('[mobile-email-auth][rate-limit-soft-fail]', rateLimitError);
    res.setHeader('X-RateLimit-Bypass', '1');
  }

  const body = (req.body || {}) as MobileAuthBody;
  const email = clampString(body.email, 254).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const mode: AuthMode = body.mode === 'signup' ? 'signup' : 'login';
  const client = clampString(body.client, 40).toLowerCase();
  const captchaToken = clampString((body.captchaToken ?? body.captcha_token) as string, 2048);

  if (!isAllowedMobileClient(client)) return res.status(403).json({ error: 'Unsupported mobile client' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email address' });
  if (password.length < 6 || password.length > 128) return res.status(400).json({ error: 'Invalid password length' });

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    '';
  if (!anonKey) return res.status(500).json({ error: 'Server auth anon config missing' });

  try {
    const authBase = getSupabaseAuthBaseUrl();
    try {
      const authHost = new URL(authBase).host;
      res.setHeader('X-Auth-Project', authHost);
    } catch {}
    const endpoint = mode === 'signup'
      ? `${authBase}/auth/v1/signup`
      : `${authBase}/auth/v1/token?grant_type=password`;

    const basePayload: Record<string, unknown> = { email, password };
    if (captchaToken) {
      basePayload.gotrue_meta_security = { captcha_token: captchaToken };
    }

    // Attempt 1: official client-like path (anon apikey, no service-role auth header).
    // This best matches Supabase's normal signInWithPassword semantics.
    let upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
      },
      body: JSON.stringify(basePayload),
    });
    let payload = await upstream.json().catch(() => ({}));

    // Attempt 2: service-role fallback (legacy mobile route behavior).
    // This is optional so missing env config doesn't break mobile email auth.
    if (!upstream.ok && mode === 'login' && serviceRole) {
      upstream = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceRole,
          Authorization: `Bearer ${serviceRole}`,
        },
        body: JSON.stringify(basePayload),
      });
      payload = await upstream.json().catch(() => ({}));
    }

    if (!upstream.ok) {
      const msg = (payload as any)?.msg || (payload as any)?.error_description || (payload as any)?.error || 'Email authentication failed';
      return res.status(upstream.status).json({ error: String(msg) });
    }

    const access_token = (payload as any)?.access_token;
    const refresh_token = (payload as any)?.refresh_token;
    const payloadUserEmail = ((payload as any)?.user?.email || '').toLowerCase().trim();
    if (payloadUserEmail && payloadUserEmail !== email) {
      console.warn('[mobile-email-auth] email mismatch', { requestedEmail: email, payloadUserEmail, client });
      return res.status(401).json({ error: 'Session mismatch detected. Please try again.' });
    }
    if (!access_token || !refresh_token) {
      return res.status(400).json({ error: mode === 'signup'
        ? 'Account created. Please verify your email before signing in.'
        : 'Unable to establish session for this account.' });
    }

    return res.status(200).json({
      access_token,
      refresh_token,
      expires_in: (payload as any)?.expires_in ?? null,
      token_type: (payload as any)?.token_type ?? 'bearer',
    });
  } catch (error) {
    console.error('[mobile-email-auth]', error);
    return res.status(500).json({ error: 'Mobile email auth failed. Please try again.' });
  }
}
