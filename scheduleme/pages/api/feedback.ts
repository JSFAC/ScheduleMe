// @ts-nocheck
// pages/api/feedback.ts — receive user feedback and email it to hello@usescheduleme.com
import type { NextApiRequest, NextApiResponse } from 'next';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 5, windowMs: 60 * 60_000, keyPrefix: 'feedback' }))) return;

  const { topic, message, email } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(200).json({ success: true });

  const normalizedTopic = (topic || '').toString().trim();
  const normalizedMessage = (message || '').toString().trim();
  const normalizedEmail = (email || '').toString().trim();

  const subject = normalizedTopic ? `Feedback: ${normalizedTopic}` : 'New feedback from ScheduleMe';
  const safeSubject = escapeHtml(subject);
  const safeTopic = escapeHtml(normalizedTopic);
  const safeMessage = escapeHtml(normalizedMessage);
  const safeEmail = escapeHtml(normalizedEmail);

  const html = `
    <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f8fafc;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:22px;">
        <h2 style="margin:0 0 10px;font-size:20px;font-weight:800;color:#0f172a;">${safeSubject}</h2>
        ${normalizedTopic ? `<p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:0.08em;">${safeTopic}</p>` : ''}
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:14px;">
          <p style="margin:0;font-size:15px;color:#0f172a;line-height:1.6;white-space:pre-wrap;">${safeMessage}</p>
        </div>
        <p style="margin:0;font-size:12px;color:#64748b;">
          ${normalizedEmail ? `Reply to: <a href="mailto:${safeEmail}" style="color:#0f766e;text-decoration:none;">${safeEmail}</a>` : 'No reply email provided'}
        </p>
      </div>
    </div>`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'ScheduleMe Feedback <notifications@usescheduleme.com>',
        to: 'hello@usescheduleme.com',
        reply_to: normalizedEmail || undefined,
        subject,
        html,
      }),
    });
    return res.status(200).json({ success: true });
  } catch {
    return res.status(200).json({ success: true }); // Never fail silently to user
  }
}
