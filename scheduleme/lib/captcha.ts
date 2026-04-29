// lib/captcha.ts — hCaptcha verification helper
import type { NextApiRequest, NextApiResponse } from 'next';

function isLikelyIp(value: string): boolean {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  if (trimmed === 'unknown') return false;
  return /^[a-fA-F0-9:.]+$/.test(trimmed);
}

export async function verifyHcaptcha(token: string, ip?: string | null): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) return true; // disabled unless configured
  if (!token) return false;

  try {
    const submit = async (remoteIp?: string | null) => {
      const body = new URLSearchParams();
      body.set('secret', secret);
      body.set('response', token);
      if (remoteIp && isLikelyIp(remoteIp)) body.set('remoteip', remoteIp);

      const res = await fetch('https://hcaptcha.com/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      return res.json();
    };

    const firstAttempt = await submit(ip);
    if (firstAttempt?.success === true) return true;

    if (ip && isLikelyIp(ip)) {
      const fallbackAttempt = await submit(null);
      return fallbackAttempt?.success === true;
    }

    return false;
  } catch {
    return false;
  }
}

export async function requireCaptcha(
  req: NextApiRequest,
  res: NextApiResponse,
  token: unknown,
  ip?: string | null
): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) return true;
  if (typeof token !== 'string') {
    res.status(400).json({ error: 'Captcha required' });
    return false;
  }
  const ok = await verifyHcaptcha(token, ip);
  if (!ok) {
    res.status(400).json({ error: 'Captcha verification failed' });
    return false;
  }
  return true;
}
//test