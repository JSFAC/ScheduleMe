// @ts-nocheck
// pages/api/payment-method-saved.ts — send confirmation after payment method saved
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';
import { sendStatusUpdate } from '../../lib/email';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'payment-method-saved' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { booking_id } = req.body || {};
  if (!booking_id || !isValidUuid(booking_id)) return res.status(400).json({ error: 'Valid booking_id required' });

  const supabase = getSupabase();
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, user_id, service, businesses(name), profiles(name, email)')
    .eq('id', booking_id)
    .maybeSingle();

  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const isOwner = booking.user_id === user.id;
  if (!isOwner && user.email) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', user.email)
      .maybeSingle();
    if (!profile?.id || booking.user_id !== profile.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  const customerEmail = (booking.profiles as any)?.email || user.email;
  if (customerEmail) {
    await sendStatusUpdate({
      to: customerEmail,
      name: (booking.profiles as any)?.name || 'there',
      service: booking.service || 'Booking',
      status: 'payment method saved',
      businessName: (booking.businesses as any)?.name || undefined,
    }).catch(() => {});
  }

  return res.status(200).json({ success: true });
}
