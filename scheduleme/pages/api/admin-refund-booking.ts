// pages/api/admin-refund-booking.ts — SECURED (admin only)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import stripe from '../../lib/stripe';
import { setSecurityHeaders, rateLimit, isValidUuid, logAuditEvent } from '../../lib/apiSecurity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.headers['x-notify-secret'];
  if (!process.env.NOTIFY_SECRET || secret !== process.env.NOTIFY_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });

  if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'admin-refund' }))) return;

  const { bookingId } = req.body || {};
  if (!bookingId || !isValidUuid(bookingId)) return res.status(400).json({ error: 'Valid bookingId required' });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, status, stripe_payment_intent_id, paid_at')
    .eq('id', bookingId)
    .maybeSingle();

  if (error || !booking) return res.status(404).json({ error: 'Booking not found' });
  if (!booking.stripe_payment_intent_id) return res.status(400).json({ error: 'No payment to refund for this booking' });

  try {
    await stripe.refunds.create({
      payment_intent: booking.stripe_payment_intent_id,
      reverse_transfer: true,
      refund_application_fee: true,
    });
  } catch (err: any) {
    console.error('[admin-refund-booking]', err);
    return res.status(500).json({ error: err?.message || 'Refund failed' });
  }

  await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
  await logAuditEvent(req, 'admin_refund_booking', {
    entity_type: 'booking',
    entity_id: bookingId,
    actor_role: 'admin',
  });
  return res.status(200).json({ ok: true, message: 'Refund issued and booking cancelled' });
}
