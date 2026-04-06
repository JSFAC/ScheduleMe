// pages/api/admin-verify-code.ts — verify admin access code
import type { NextApiRequest, NextApiResponse } from 'next';
import { setSecurityHeaders, rateLimit, getClientIp } from '../../lib/apiSecurity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 10, windowMs: 10 * 60_000, keyPrefix: 'admin-code' }))) return;

  const secret = process.env.NOTIFY_SECRET;
  if (!secret) return res.status(500).json({ error: 'Admin access code not configured' });
  const code = String(req.body?.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Code required' });
  if (code !== secret) return res.status(401).json({ error: 'Invalid code' });
  return res.status(200).json({ ok: true });
}
