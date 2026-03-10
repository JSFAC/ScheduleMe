// pages/api/notify.ts — Internal notification endpoint
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import {
  sendBookingConfirmation,
  sendStatusUpdate,
  sendWelcomeEmail,
} from '../../lib/email';

// ─── Temporary: redirect all emails to ops inbox until custom domain is set up
// When you have a verified domain, remove this line and emails go to real users.
const OPS_EMAIL = 'imjoshuasf@gmail.com';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function userWantsNotif(email: string, prefKey: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return true;
  try {
    const { data } = await supabase
      .from('users')
      .select('raw_user_meta_data')
      .eq('email', email)
      .single();
    const prefs = data?.raw_user_meta_data?.notif_prefs;
    if (!prefs) return true;
    return prefs.emailChannel !== false && prefs[prefKey] !== false;
  } catch {
    return true;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const secret = req.headers['x-notify-secret'];
  if (secret !== process.env.NOTIFY_SECRET && process.env.NODE_ENV === 'production') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { type, to: _to, name, ...rest } = req.body;

  // Always send to ops inbox for now (remove OPS_EMAIL line above when domain is ready)
  const to = OPS_EMAIL;

  if (!type) {
    return res.status(400).json({ error: 'Missing required field: type' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn('[notify] RESEND_API_KEY not set — skipping email send');
    return res.status(200).json({ skipped: true, reason: 'RESEND_API_KEY not configured' });
  }

  try {
    let result;

    switch (type) {
      case 'booking_confirmation': {
        const wantsIt = await userWantsNotif(_to, 'bookingConfirmed');
        if (!wantsIt) return res.status(200).json({ skipped: true, reason: 'User opted out' });
        result = await sendBookingConfirmation({
          to,
          name: name || 'there',
          service: rest.service || 'Service Request',
          urgency: rest.urgency || 'Standard',
          location: rest.location || '',
          matches: rest.matches || [],
        });
        break;
      }

      case 'status_update': {
        const wantsIt = await userWantsNotif(_to, 'statusUpdates');
        if (!wantsIt) return res.status(200).json({ skipped: true, reason: 'User opted out' });
        result = await sendStatusUpdate({
          to,
          name: name || 'there',
          service: rest.service || 'Service Request',
          status: rest.status || 'updated',
          businessName: rest.businessName,
        });
        break;
      }

      case 'welcome': {
        result = await sendWelcomeEmail({ to, name: name || 'there' });
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown notification type: ${type}` });
    }

    return res.status(200).json({ success: true, id: (result as any)?.data?.id });
  } catch (err) {
    console.error('[notify] Error sending email:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to send email' });
  }
}