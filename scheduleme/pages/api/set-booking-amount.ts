// @ts-nocheck
// pages/api/set-booking-amount.ts
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { booking_id, amount_cents } = req.body;
  if (!booking_id || !amount_cents) return res.status(400).json({ error: 'Missing fields' });

  // Get booking (two-step to avoid FK join issues)
  const { data: booking, error: bErr } = await sb
    .from('bookings')
    .select('id, status, user_id, business_id')
    .eq('id', booking_id)
    .in('status', ['pending', 'confirmed', 'payment_pending'])
    .maybeSingle();

  if (bErr || !booking) return res.status(404).json({ error: 'Booking not found' });

  // Ensure business has Stripe connected
  const { data: biz } = await sb.from('businesses').select('stripe_onboarded, stripe_account_id, name').eq('id', booking.business_id).maybeSingle();
  if (!biz?.stripe_onboarded || !biz?.stripe_account_id) {
    return res.status(400).json({ error: 'Business has not connected their bank account yet' });
  }

  // Update the amount
  const { error: uErr } = await sb
    .from('bookings')
    .update({ amount_cents })
    .eq('id', booking_id);

  if (uErr) return res.status(500).json({ error: uErr.message });

  // Try to send notification email (optional — don't fail if it errors)
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';
    const secret = process.env.NOTIFY_SECRET || '';
    const { data: profile } = await sb.from('profiles').select('email, name').eq('id', booking.user_id).maybeSingle();
    if (profile?.email) {
      await fetch(siteUrl + '/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
        body: JSON.stringify({
          type: 'payment_request_customer',
          to: profile.email,
          name: profile.name || 'there',
          service: 'Custom Request',
          businessName: biz?.name || 'Your provider',
          amountDollars: (amount_cents / 100).toFixed(2),
          bookingId: booking.id,
        }),
      });
    }
  } catch (e) {
    // Non-fatal
  }

  return res.status(200).json({ ok: true });
}
