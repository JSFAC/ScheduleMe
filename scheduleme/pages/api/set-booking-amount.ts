// pages/api/set-booking-amount.ts
// Business sets the price on a booking and optionally notifies the customer
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
  if (!rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'set-amount' })) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { booking_id, amount_cents, notify_customer = true } = req.body;

  if (!booking_id || !isValidUuid(booking_id))
    return res.status(400).json({ error: 'Valid booking_id required' });

  if (!amount_cents || typeof amount_cents !== 'number' || amount_cents < 100)
    return res.status(400).json({ error: 'amount_cents must be a number >= 100' });

  if (amount_cents > 99999_00)
    return res.status(400).json({ error: 'Amount too large' });

  const supabase = getSupabase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';

  // Fetch booking with business info to verify ownership
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, businesses!bookings_business_id_fkey(id, name, owner_email), users(id, name, email)')
    .eq('id', booking_id)
    .maybeSingle();

  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  // Verify the caller owns the business on this booking
  // businesses join can return array or object depending on relationship type
  const biz = Array.isArray(booking.businesses) ? booking.businesses[0] : booking.businesses as any;
  if (!biz || biz.owner_email !== user.email) {
    // Fallback: check businesses table directly
    const { data: bizDirect } = await supabase
      .from('businesses')
      .select('owner_email')
      .eq('id', booking.business_id)
      .maybeSingle();
    if (!bizDirect || bizDirect.owner_email !== user.email)
      return res.status(403).json({ error: 'Access denied — you do not own this booking' });
  }

  if (['paid', 'cancelled', 'completed'].includes(booking.status))
    return res.status(400).json({ error: `Cannot set price on a ${booking.status} booking` });

  // Update amount and set status to payment_pending if currently confirmed
  const newStatus = booking.status === 'confirmed' ? 'payment_pending' : booking.status;

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      amount_cents,
      status: newStatus,
    })
    .eq('id', booking_id);

  if (updateError) {
    console.error('[set-booking-amount]', updateError);
    return res.status(500).json({ error: 'Failed to update booking' });
  }

  // Notify customer if they have an email
  const customer = booking.users as any;
  if (notify_customer && customer?.email) {
    const amountDollars = (amount_cents / 100).toFixed(2);
    fetch(`${siteUrl}/api/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-notify-secret': process.env.NOTIFY_SECRET || '',
      },
      body: JSON.stringify({
        type: 'payment_request_customer',
        to: customer.email,
        name: customer.name || 'there',
        service: booking.service,
        businessName: biz.name,
        amountDollars,
        bookingId: booking_id,
      }),
    }).catch(console.error);
  }

  const platformFeeCents = Math.round(amount_cents * PLATFORM_FEE_PERCENT / 100);
  const payoutCents = amount_cents - platformFeeCents;

  return res.status(200).json({
    success: true,
    booking_id,
    amount_cents,
    status: newStatus,
    platform_fee_cents: platformFeeCents,
    payout_cents: payoutCents,
    customer_notified: notify_customer && !!customer?.email,
  });
}
