// pages/api/admin-verify.ts — verify admin access
import type { NextApiRequest, NextApiResponse } from 'next';
import { setSecurityHeaders, requireAdmin } from '../../lib/apiSecurity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  return res.status(200).json({ ok: true });
}
