// lib/cronAuth.ts
import type { NextApiRequest } from 'next';
import { timingSafeEqual } from 'crypto';

function safeEqual(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function isCronAuthorized(req: NextApiRequest): boolean {
  const headerSecret = req.headers['x-notify-secret'];
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  const notifySecret = process.env.NOTIFY_SECRET || '';
  const cronSecret = process.env.CRON_SECRET || '';

  if (safeEqual(typeof headerSecret === 'string' ? headerSecret : null, notifySecret)) return true;
  if (safeEqual(token, cronSecret)) return true;
  return false;
}
