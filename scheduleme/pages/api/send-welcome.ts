// pages/api/send-welcome.ts
// Dedicated endpoint for sending welcome emails — called client-side on first signup.
// Uses server-side NOTIFY_SECRET so it's never exposed to the browser.
import type { NextApiRequest, NextApiResponse } from 'next';
import { sendWelcomeEmail } from '../../lib/email';
import { setSecurityHeaders, rateLimit, isValidEmail } from '../../lib/apiSecurity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit tightly — 3 per IP per hour (one per signup)
  if (!rateLimit(req, res, { max: 3, windowMs: 60 * 60_000, keyPrefix: 'send-welcome' })) return;

  const { email, name } = req.body;
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Valid email required' });
  if (!process.env.RESEND_API_KEY) return res.status(200).json({ skipped: true });

  try {
    await sendWelcomeEmail({ to: email, name: name || 'there' });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[send-welcome]', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
