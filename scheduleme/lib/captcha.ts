// lib/captcha.ts — hCaptcha verification helper
import type { NextApiRequest, NextApiResponse } from 'next';

export async function verifyHcaptcha(token: string, ip?: string | null): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) return true; // disabled unless configured
  if (!token) return false;

  try {
    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token);
    if (ip) body.set('remoteip', ip);

    const res = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.json();
    return data?.success === true;
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
