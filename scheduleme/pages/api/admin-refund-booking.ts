// pages/api/admin-refund-booking.ts — SECURED (admin only)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import stripe from '../../lib/stripe';
import { setSecurityHeaders, rateLimit, isValidUuid, logAuditEvent, requireAdmin } from '../../lib/apiSecurity';
import { PROTECTION_FEE_CENTS } from '../../lib/fees';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'admin-refund' }))) return;

  const { bookingId } = req.body || {};
  if (!bookingId || !isValidUuid(bookingId)) return res.status(400).json({ error: 'Valid bookingId required' });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, status, stripe_payment_intent_id, paid_at, amount_cents, protection_fee_cents')
    .eq('id', bookingId)
    .maybeSingle();

  if (error || !booking) return res.status(404).json({ error: 'Booking not found' });
  if (!booking.stripe_payment_intent_id) return res.status(400).json({ error: 'No payment to refund for this booking' });

  try {
    const serviceRefundCents = Math.max(0, Number(booking.amount_cents || 0));
    if (serviceRefundCents > 0) {
      await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        amount: serviceRefundCents,
        reverse_transfer: true,
        refund_application_fee: true,
      });
    } else {
      // Safety fallback for legacy records without service amount.
      await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        reverse_transfer: true,
        refund_application_fee: true,
      });
    }
  } catch (err: any) {
    console.error('[admin-refund-booking]', err);
    return res.status(500).json({ error: err?.message || 'Refund failed' });
  }

  await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
  await logAuditEvent(req, 'admin_refund_booking', {
    entity_type: 'booking',
    entity_id: bookingId,
    actor_role: 'admin',
    meta: {
      policy: 'service_amount_only_refund',
      refunded_service_cents: Math.max(0, Number(booking.amount_cents || 0)),
      retained_protection_fee_cents: typeof booking.protection_fee_cents === 'number'
        ? booking.protection_fee_cents
        : PROTECTION_FEE_CENTS,
    },
  });
  return res.status(200).json({ ok: true, message: 'Service amount refund issued and booking cancelled' });
}
