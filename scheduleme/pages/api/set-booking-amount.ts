// @ts-nocheck
// pages/api/set-booking-amount.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';

const PLATFORM_FEE_PERCENT = 12;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).end();

  const limited = await rateLimit(req, res, { max: 20, windowMs: 60000 });
  if (limited) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { booking_id, amount_cents, notify_customer = true } = req.body;

  if (!booking_id || !isValidUuid(booking_id))
    return res.status(400).json({ error: 'Valid booking_id required' });

  if (!amount_cents || typeof amount_cents !== 'number' || amount_cents < 100)
    return res.status(400).json({ error: 'amount_cents must be a number >= 100' });

  if (amount_cents > 9999900)
    return res.status(400).json({ error: 'Amount too large' });

  const supabase = getSupabase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';

  // Step 1: Fetch the booking directly (no join)
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', booking_id)
    .maybeSingle();

  if (bookingErr || !booking) {
    console.error('[set-booking-amount] booking fetch error:', bookingErr);
    return res.status(404).json({ error: 'Booking not found' });
  }

  // Step 2: Verify ownership — fetch business by id and check owner_email
  const { data: biz, error: bizErr } = await supabase
    .from('businesses')
    .select('id, name, owner_email')
    .eq('id', booking.business_id)
    .maybeSingle();

  if (bizErr || !biz) {
    console.error('[set-booking-amount] business fetch error:', bizErr);
    return res.status(404).json({ error: 'Business not found' });
  }

  if (biz.owner_email !== user.email)
    return res.status(403).json({ error: 'Access denied — you do not own this booking' });

  if (['paid', 'cancelled', 'completed'].includes(booking.status))
    return res.status(400).json({ error: `Cannot set price on a ${booking.status} booking` });

  // Step 3: Update booking amount and status
  const newStatus = booking.status === 'confirmed' || booking.status === 'pending' ? 'payment_pending' : booking.status;

  const { error: updateError } = await supabase
    .from('bookings')
    .update({ amount_cents, status: newStatus })
    .eq('id', booking_id);

  if (updateError) {
    console.error('[set-booking-amount]', updateError);
    return res.status(500).json({ error: 'Failed to update booking' });
  }

  // Step 4: Notify customer if they have an email
  const customerEmail = booking.customer_email || booking.user_email || null;

  if (notify_customer && customerEmail) {
    try {
      const { sendEmail } = await import('../../lib/notify');
      await sendEmail('payment_request_customer', customerEmail, {
        business_name: biz.name,
        amount: (amount_cents / 100).toFixed(2),
        booking_id,
        payment_url: `${siteUrl}/bookings?pay=${booking_id}`,
      });
    } catch (e) {
      console.error('[set-booking-amount] notify error:', e);
      // Don't fail the request just because email failed
    }
  }

  return res.status(200).json({ success: true, status: newStatus, amount_cents });
}
