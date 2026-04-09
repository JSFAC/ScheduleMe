// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';

const SUPPORT_EMAIL = 'usescheduleme@gmail.com';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 6, windowMs: 60 * 60_000, keyPrefix: 'support' }))) return;

  const {
    name = '',
    email = '',
    subject = '',
    message = '',
    platform = '',
  } = req.body || {};

  if (!String(email).trim() || !String(message).trim()) {
    return res.status(400).json({ error: 'Email and message are required.' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return res.status(500).json({ error: 'Support email is not configured.' });
  }

  const safeName = String(name).trim() || 'Unknown';
  const safeEmail = String(email).trim();
  const safeSubject = String(subject).trim() || 'Support request';
  const safePlatform = String(platform).trim() || 'Not specified';
  const safeMessage = String(message).trim();

  const html = `
    <div style="font-family:Inter,system-ui,-apple-system,sans-serif;max-width:680px;margin:0 auto;padding:28px;">
      <h2 style="margin:0 0 8px;color:#0f172a;">ScheduleMe Support Request</h2>
      <p style="margin:0 0 20px;color:#475569;">A new support request was submitted from usescheduleme.com/support.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:18px;">
        <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Name:</strong> ${safeName}</td></tr>
        <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Email:</strong> ${safeEmail}</td></tr>
        <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Platform:</strong> ${safePlatform}</td></tr>
        <tr><td style="padding:12px 16px;"><strong>Subject:</strong> ${safeSubject}</td></tr>
      </table>
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;background:#f8fafc;">
        <p style="margin:0;white-space:pre-wrap;color:#0f172a;line-height:1.65;">${safeMessage}</p>
      </div>
    </div>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ScheduleMe Support <notifications@usescheduleme.com>',
        to: SUPPORT_EMAIL,
        reply_to: safeEmail,
        subject: `[Support] ${safeSubject}`,
        html,
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return res.status(502).json({ error: `Support email failed: ${errText || 'Unknown error'}` });
    }
    return res.status(200).json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to send support email' });
  }
}
