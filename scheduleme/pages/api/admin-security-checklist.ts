// pages/api/admin-security-checklist.ts
// Admin-only: returns current security configuration flags
import type { NextApiRequest, NextApiResponse } from 'next';
import { setSecurityHeaders, rateLimit, requireAdmin } from '../../lib/apiSecurity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'admin-security-checklist' }))) return;

  return res.status(200).json({
    ok: true,
    env: {
      NEXT_PUBLIC_SITE_URL: !!process.env.NEXT_PUBLIC_SITE_URL,
      HCAPTCHA_SITE_KEY: !!process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY,
      HCAPTCHA_SECRET: !!process.env.HCAPTCHA_SECRET,
      UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
      ADMIN_EMAIL_ALLOWLIST: !!process.env.ADMIN_EMAIL_ALLOWLIST,
      NOTIFY_SECRET: !!process.env.NOTIFY_SECRET,
    },
    notes: [
      'Bot protection and WAF rules must be verified in Vercel dashboard.',
      'Supabase Auth settings (email confirmation, password strength, MFA) must be verified in Supabase dashboard.',
      'Backups/DR must be confirmed in Supabase dashboard.',
    ],
  });
}
