// pages/api/send-welcome.ts
// Dedicated endpoint for sending welcome emails — called client-side on first signup.
// Uses server-side NOTIFY_SECRET so it's never exposed to the browser.
import type { NextApiRequest, NextApiResponse } from 'next';
import { sendWelcomeEmail } from '../../lib/email';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, isValidEmail, requireAuth } from '../../lib/apiSecurity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit tightly — 3 per IP per hour (one per signup)
  if (!(await rateLimit(req, res, { max: 3, windowMs: 60 * 60_000, keyPrefix: 'send-welcome' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { email, name, userId } = req.body;
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Valid email required' });
  if (userId && user.id !== userId) return res.status(403).json({ error: 'Access denied' });
  if (user.email && user.email.toLowerCase() !== String(email).toLowerCase()) return res.status(403).json({ error: 'Access denied' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } });

  // Server-side guard: only send once
  try {
    let profile = null;
    if (userId) {
      const { data } = await sb.from('profiles').select('id, email, name, has_seen_welcome').eq('id', userId).maybeSingle();
      profile = data || null;
    } else {
      const { data } = await sb.from('profiles').select('id, email, name, has_seen_welcome').eq('email', email).maybeSingle();
      profile = data || null;
    }

    if (profile?.has_seen_welcome === true) {
      return res.status(200).json({ skipped: true, reason: 'already_seen' });
    }

    // Mark welcome as seen server-side (prevents repeats)
    await sb.from('profiles').upsert({
      id: userId || profile?.id,
      email,
      name: name || profile?.name || 'there',
      has_seen_welcome: true,
    }, { onConflict: 'id', ignoreDuplicates: false });

    if (!process.env.RESEND_API_KEY) return res.status(200).json({ skipped: true });

    await sendWelcomeEmail({ to: email, name: name || 'there' });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[send-welcome]', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
