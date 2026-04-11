import type { NextApiRequest, NextApiResponse } from 'next';
import { setSecurityHeaders, rateLimit, isValidEmail, clampString } from '../../lib/apiSecurity';

type AuthMode = 'login' | 'signup';

type MobileAuthBody = {
  email?: string;
  password?: string;
  mode?: AuthMode;
  client?: string;
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
  if (!(await rateLimit(req, res, {
    max: 30,
    windowMs: 60_000,
    keyPrefix: 'mobile-email-auth',
    allowInProcessFallback: true,
  }))) return;

  const body = (req.body || {}) as MobileAuthBody;
  const email = clampString(body.email, 254).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const mode: AuthMode = body.mode === 'signup' ? 'signup' : 'login';
  const client = clampString(body.client, 40).toLowerCase();

  if (!isAllowedMobileClient(client)) return res.status(403).json({ error: 'Unsupported mobile client' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email address' });
  if (password.length < 6 || password.length > 128) return res.status(400).json({ error: 'Invalid password length' });

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!anonKey) return res.status(500).json({ error: 'Server auth config missing' });

  try {
    const authBase = getSupabaseAuthBaseUrl();
    const endpoint = mode === 'signup'
      ? `${authBase}/auth/v1/signup`
      : `${authBase}/auth/v1/token?grant_type=password`;

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10_000),
    });

    const payload = await upstream.json().catch(() => ({}));
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
