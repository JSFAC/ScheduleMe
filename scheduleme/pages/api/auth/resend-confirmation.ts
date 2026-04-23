import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { setSecurityHeaders, rateLimit } from '../../../lib/apiSecurity';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
  if (!url || !key) throw new Error('Supabase service role is not configured.');
  return createClient(url, key, { auth: { persistSession: false } });
}

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured.');
  return new Resend(key);
}

function isAllowedRedirect(redirectTo: string, siteUrl: string): boolean {
  try {
    const requested = new URL(redirectTo);
    const configured = new URL(siteUrl);
    const host = configured.hostname.replace(/^www\./i, '').toLowerCase();
    const reqHost = requested.hostname.replace(/^www\./i, '').toLowerCase();
    return requested.protocol === 'https:' && reqHost === host;
  } catch {
    return false;
  }
}

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resendHtml(actionLink: string) {
  return `
    <div style="font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0b1020;color:#e5e7eb;border-radius:16px;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8ea0b8;">ScheduleMe</p>
      <h1 style="margin:0 0 10px;font-size:26px;line-height:1.2;color:#ffffff;">Your sign-in link is ready</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#c8d2e0;">Use this link to verify your email and continue into your account.</p>
      <a href="${actionLink}" style="display:inline-block;padding:13px 22px;background:#00a38d;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;">Open ScheduleMe</a>
      <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#93a2b8;">If the button does not work, copy and paste this URL in your browser:</p>
      <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#9eb0c9;word-break:break-all;">${esc(actionLink)}</p>
    </div>
  `;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 10, windowMs: 15 * 60_000, keyPrefix: 'auth-resend-confirmation' }))) return;

  const { email, redirectTo } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';
  const safeRedirectTo = typeof redirectTo === 'string' && isAllowedRedirect(redirectTo, siteUrl)
    ? redirectTo
    : `${siteUrl}/auth/verified?source=email_signup`;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: { redirectTo: safeRedirectTo },
    });

    if (error || !data?.properties?.action_link) {
      // Avoid email enumeration: return success even if user is missing.
      return res.status(200).json({ ok: true });
    }

    const resend = getResend();
    await resend.emails.send({
      from: 'ScheduleMe <notifications@usescheduleme.com>',
      to: normalizedEmail,
      subject: 'Your ScheduleMe confirmation link',
      html: resendHtml(data.properties.action_link),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: msg });
  }
}
