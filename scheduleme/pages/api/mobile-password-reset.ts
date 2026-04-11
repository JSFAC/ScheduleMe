import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, checkRateLimit, getClientIp, isValidEmail, clampString } from '../../lib/apiSecurity';
import { sendPasswordResetEmail } from '../../lib/email';

type MobilePasswordResetBody = {
  email?: string;
  client?: string;
  captchaToken?: string;
  captcha_token?: string;
};

function isAllowedMobileClient(client: string): boolean {
  return client === 'ios-consumer' || client === 'ios-provider';
}

function getRedirectUrlForClient(client: string): string {
  if (client === 'ios-provider') {
    return process.env.MOBILE_PROVIDER_REDIRECT_URL || 'schedulemeprovider://auth/callback';
  }
  return process.env.MOBILE_CONSUMER_REDIRECT_URL || 'scheduleme://auth/callback';
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

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!serviceRole || !supabaseUrl) return res.status(500).json({ error: 'Server auth config missing' });
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'Email service is not configured' });

  try {
    const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const redirectTo = getRedirectUrlForClient(client);

    const generatePayload: Record<string, unknown> = {
      type: 'recovery',
      email,
      options: { redirectTo },
    };
    if (captchaToken) {
      (generatePayload as any).options.captchaToken = captchaToken;
    }

    const { data, error } = await (supabase.auth.admin as any).generateLink(generatePayload);
    if (error) {
      // Do not reveal account existence for reset requests.
      const msg = String(error.message || '');
      const notFoundLike = /not found|no user|email/i.test(msg);
      if (!notFoundLike) {
        console.error('[mobile-password-reset][generate-link]', msg);
      }
      return res.status(200).json({ ok: true });
    }

    const resetUrl =
      (data as any)?.properties?.action_link ||
      (data as any)?.action_link ||
      '';
    if (!resetUrl) return res.status(200).json({ ok: true });

    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('email', email)
      .maybeSingle();
    const firstName = String((profile as any)?.name || email.split('@')[0] || 'there').trim() || 'there';

    await sendPasswordResetEmail({
      to: email,
      name: firstName,
      resetUrl,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[mobile-password-reset]', error);
    return res.status(500).json({ error: 'Password reset failed. Please try again.' });
  }
}
