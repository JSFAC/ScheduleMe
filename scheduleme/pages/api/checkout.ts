// @ts-nocheck
// pages/api/checkout.ts — Legacy compatibility route for website booking payment
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await rateLimit(req, res, { max: 10, windowMs: 60_000, keyPrefix: 'checkout' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { booking_id } = req.body;
  if (!booking_id || !isValidUuid(booking_id))
    return res.status(400).json({ error: 'Valid booking_id required' });

  const supabase = getSupabase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, user_id, paid_at, status, amount_cents, stripe_payment_method_id, businesses(id, stripe_account_id, stripe_onboarded), profiles(email)')
    .eq('id', booking_id)
    .maybeSingle();

  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  let canAccess = booking.user_id === user.id;
  if (!canAccess && user.email) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();
    if (profile?.id && booking.user_id === profile.id) canAccess = true;
    if (!canAccess) {
      try {
        const { data: legacyUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        if (legacyUser?.id && booking.user_id === legacyUser.id) canAccess = true;
      } catch {}
    }
  }
  if (!canAccess) return res.status(403).json({ error: 'Access denied' });
  if (booking.status !== 'confirmed' && booking.status !== 'pending') return res.status(400).json({ error: 'Booking must be pending or confirmed before payment' });
  if (booking.paid_at) return res.status(400).json({ error: 'Booking already paid' });

  // Amount: use booking amount_cents if set, otherwise require it to be set
  const amountCents = booking.amount_cents;
  if (!amountCents || amountCents < 100)
    return res.status(400).json({ error: 'Payment amount not set for this booking. Contact the business.' });
  return res.status(200).json({ url: `${siteUrl}/pay/${booking_id}` });
}
