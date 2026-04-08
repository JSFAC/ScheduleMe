import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { setSecurityHeaders, rateLimit, getClientIp } from '../../../lib/apiSecurity';
import { verifyHcaptcha } from '../../../lib/captcha';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role is not configured.');
  return createClient(url, key, { auth: { persistSession: false } });
}

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured.');
  return new Resend(key);
}

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function confirmationHtml(name: string, actionLink: string) {
  return `
    <div style="font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0b1020;color:#e5e7eb;border-radius:16px;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8ea0b8;">ScheduleMe</p>
      <h1 style="margin:0 0 10px;font-size:26px;line-height:1.2;color:#ffffff;">Confirm your account</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#c8d2e0;">Hi ${esc(name || 'there')}, tap below to verify your email and finish setting up your ScheduleMe account.</p>
      <a href="${actionLink}" style="display:inline-block;padding:13px 22px;background:#00a38d;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;">Confirm Email</a>
      <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#93a2b8;">If the button does not work, copy and paste this URL in your browser:</p>
      <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#9eb0c9;word-break:break-all;">${esc(actionLink)}</p>
    </div>
  `;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 6, windowMs: 15 * 60_000, keyPrefix: 'auth-email-signup' }))) return;

  const { email, password, firstName, lastName, captchaToken, redirectTo } = req.body || {};

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedFirstName = String(firstName || '').trim().slice(0, 40);
  const normalizedLastName = String(lastName || '').trim().slice(0, 40);
  const normalizedName = `${normalizedFirstName} ${normalizedLastName}`.trim().slice(0, 80);
  const pwd = String(password || '');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';
  const safeRedirectTo = typeof redirectTo === 'string' && redirectTo.startsWith(siteUrl)
    ? redirectTo
    : `${siteUrl}/auth/callback`;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!normalizedFirstName || !normalizedLastName) {
    return res.status(400).json({ error: 'Please enter your first and last name.' });
  }
  if (pwd.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters.' });

  try {
    const ip = getClientIp(req);
    if (typeof captchaToken === 'string' && captchaToken.trim()) {
      const ok = await verifyHcaptcha(captchaToken.trim(), ip);
      if (!ok) return res.status(400).json({ error: 'Captcha verification failed. Please try again.' });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: normalizedEmail,
      password: pwd,
      options: {
        redirectTo: safeRedirectTo,
        data: {
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
          full_name: normalizedName,
          name: normalizedName,
        },
      },
    });

    if (error) {
      const msg = error.message || 'Could not create account.';
      if (/already|exists|registered/i.test(msg)) {
        return res.status(409).json({ error: 'That email is already registered. Please log in instead.' });
      }
      return res.status(400).json({ error: msg });
    }

    const actionLink = data?.properties?.action_link;
    if (!actionLink) return res.status(500).json({ error: 'Could not generate confirmation link.' });

    const resend = getResend();
    await resend.emails.send({
      from: 'ScheduleMe <notifications@usescheduleme.com>',
      to: normalizedEmail,
      subject: 'Confirm your ScheduleMe account',
      html: confirmationHtml(normalizedName, actionLink),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: msg });
  }
}
