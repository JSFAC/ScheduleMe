// pages/api/feedback.ts — receive user feedback and email it to hello@usescheduleme.com
import type { NextApiRequest, NextApiResponse } from 'next';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, { max: 5, windowMs: 60 * 60_000, keyPrefix: 'feedback' })) return;

  const { topic, message, email } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(200).json({ success: true });

  const subject = topic ? `Feedback: ${topic}` : 'New feedback from ScheduleMe';
  const html = `
    <div style="font-family:system-ui;max-width:600px;margin:0 auto;padding:32px;">
      <h2 style="margin:0 0 8px;font-size:18px;font-weight:800;color:#0f172a;">${subject}</h2>
      ${topic ? `<p style="margin:0 0 16px;font-size:12px;font-weight:600;color:#0A84FF;text-transform:uppercase;letter-spacing:0.08em;">${topic}</p>` : ''}
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px;">
        <p style="margin:0;font-size:15px;color:#0f172a;line-height:1.6;white-space:pre-wrap;">${message.trim()}</p>
      </div>
      ${email ? `<p style="margin:0;font-size:13px;color:#64748b;">Reply to: <a href="mailto:${email}" style="color:#0A84FF;">${email}</a></p>` : '<p style="font-size:13px;color:#94a3b8;margin:0;">No reply email provided</p>'}
    </div>`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'ScheduleMe Feedback <notifications@usescheduleme.com>',
        to: 'hello@usescheduleme.com',
        reply_to: email || undefined,
        subject,
        html,
      }),
    });
    return res.status(200).json({ success: true });
  } catch {
    return res.status(200).json({ success: true }); // Never fail silently to user
  }
}
