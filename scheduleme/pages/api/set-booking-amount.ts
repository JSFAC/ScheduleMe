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
    .select('id, status, customer_id, business_id')
    .eq('id', booking_id)
    .in('status', ['pending', 'confirmed'])
    .maybeSingle();

  if (bErr || !booking) return res.status(404).json({ error: 'Booking not found' });

  // Update the amount
  const { error: uErr } = await sb
    .from('bookings')
    .update({ amount_cents })
    .eq('id', booking_id);

  if (uErr) return res.status(500).json({ error: uErr.message });

  // Try to send notification email (optional — don't fail if it errors)
  try {
    const { data: biz } = await sb.from('businesses').select('name').eq('id', booking.business_id).maybeSingle();
    await fetch(process.env.NEXT_PUBLIC_SITE_URL + '/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_user_id: booking.customer_id,
        subject: 'Your booking amount has been set',
        message: 'The business' + (biz?.name ? ' (' + biz.name + ')' : '') + ' has set your booking amount to $' + (amount_cents / 100).toFixed(2) + '.',
      }),
    });
  } catch (e) {
    // Non-fatal
  }

  return res.status(200).json({ ok: true });
}
