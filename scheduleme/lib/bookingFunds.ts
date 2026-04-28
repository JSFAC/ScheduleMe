import type { SupabaseClient } from '@supabase/supabase-js';
import stripe from './stripe';
import { getPlatformFeePercent } from './platformFees';

type BookingReleaseRow = {
  id: string;
  business_id: string | null;
  status: string | null;
  amount_cents: number | null;
  protection_fee_cents?: number | null;
  paid_at: string | null;
  stripe_payment_intent_id: string | null;
  completed_at?: string | null;
  businesses?: {
    id?: string | null;
    name?: string | null;
    stripe_account_id?: string | null;
    stripe_onboarded?: boolean | null;
    founder50?: boolean | null;
    founder50_status?: string | null;
    last_completed_booking_at?: string | null;
    owner_email?: string | null;
  } | null;
};

function isMissingColumnError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  const details = String(err?.details || '').toLowerCase();
  return msg.includes('column') || msg.includes('does not exist') || details.includes('does not exist');
}

function parseIntMeta(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

async function updateBookingReleaseFields(
  supabase: SupabaseClient<any, any, any>,
  bookingId: string,
  payload: Record<string, any>
) {
  const nextPayload = { ...payload };
  for (;;) {
    const { error } = await supabase.from('bookings').update(nextPayload).eq('id', bookingId);
    if (!error) return;
    if (!isMissingColumnError(error)) throw error;
    const msg = `${String(error.message || '')} ${String(error.details || '')}`.toLowerCase();
    const missingKey = Object.keys(nextPayload).find((key) => msg.includes(key.toLowerCase()));
    if (!missingKey) throw error;
    delete nextPayload[missingKey];
    if (Object.keys(nextPayload).length === 0) return;
  }
}

async function retrievePaymentIntentForBooking(bookingId: string, knownPaymentIntentId?: string | null) {
  if (knownPaymentIntentId) {
    return stripe.paymentIntents.retrieve(knownPaymentIntentId, {
      expand: ['latest_charge'],
    });
  }
  const result = await stripe.paymentIntents.search({
    query: `metadata['booking_id']:'${bookingId}' AND status:'succeeded'`,
    limit: 1,
  });
  const paymentIntent = result.data?.[0];
  if (!paymentIntent) return null;
  return stripe.paymentIntents.retrieve(paymentIntent.id, { expand: ['latest_charge'] });
}

async function getBookingForFunds(
  supabase: SupabaseClient<any, any, any>,
  bookingId: string
): Promise<BookingReleaseRow | null> {
  const { data } = await supabase
    .from('bookings')
    .select('id, business_id, status, amount_cents, protection_fee_cents, paid_at, stripe_payment_intent_id, completed_at, businesses(id, name, stripe_account_id, stripe_onboarded, founder50, founder50_status, last_completed_booking_at, owner_email)')
    .eq('id', bookingId)
    .maybeSingle();
  return (data as BookingReleaseRow | null) || null;
}

export async function releaseHeldFundsForBooking(opts: {
  supabase: SupabaseClient<any, any, any>;
  bookingId: string;
  reason: 'consumer_confirmed_completion' | 'consumer_confirmation_window_expired' | 'admin_release_funds';
}) {
  const booking = await getBookingForFunds(opts.supabase, opts.bookingId);
  if (!booking) return { ok: false, error: 'Booking not found' as const };
  if (!booking.paid_at) return { ok: false, error: 'Booking has not been paid' as const };
  if (!booking.amount_cents || booking.amount_cents <= 0) return { ok: false, error: 'Booking has no service amount' as const };

  const business = booking.businesses || null;
  if (!business?.stripe_account_id || !business?.stripe_onboarded) {
    return { ok: false, error: 'Provider Stripe account is not ready' as const };
  }

  const paymentIntent = await retrievePaymentIntentForBooking(opts.bookingId, booking.stripe_payment_intent_id);
  if (!paymentIntent || paymentIntent.status !== 'succeeded') {
    return { ok: false, error: 'Succeeded payment intent not found' as const };
  }

  const metadata = paymentIntent.metadata || {};
  const existingTransferId = String(metadata.provider_transfer_id || '').trim();
  const providerPayoutCentsFromMeta = parseIntMeta(metadata.provider_payout_cents, 0);
  const platformFeeCentsFromMeta = parseIntMeta(metadata.platform_fee_cents, 0);
  const alreadyReleasedAt = String(metadata.funds_released_at || '').trim();
  if (existingTransferId || alreadyReleasedAt) {
    return {
      ok: true,
      alreadyReleased: true,
      transferId: existingTransferId || null,
      providerPayoutCents: providerPayoutCentsFromMeta,
      platformFeeCents: platformFeeCentsFromMeta,
      releasedAt: alreadyReleasedAt || null,
    };
  }

  const latestChargeId =
    typeof paymentIntent.latest_charge === 'string'
      ? paymentIntent.latest_charge
      : (paymentIntent.latest_charge as any)?.id || null;
  if (!latestChargeId) {
    return { ok: false, error: 'Payment charge is missing for this booking' as const };
  }

  const platformFeePercent = getPlatformFeePercent(business as any);
  const platformFeeCents = Math.max(0, Math.round(booking.amount_cents * platformFeePercent / 100));
  const providerPayoutCents = Math.max(0, booking.amount_cents - platformFeeCents);
  const nowIso = new Date().toISOString();

  let transferId: string | null = null;
  if (providerPayoutCents > 0) {
    const transfer = await stripe.transfers.create(
      {
        amount: providerPayoutCents,
        currency: paymentIntent.currency || 'usd',
        destination: business.stripe_account_id,
        source_transaction: latestChargeId,
        transfer_group: `booking_${booking.id}`,
        metadata: {
          booking_id: booking.id,
          business_id: booking.business_id || '',
          release_reason: opts.reason,
        },
      },
      {
        idempotencyKey: `booking_${booking.id}_provider_release_v1`,
      }
    );
    transferId = transfer.id;
  }

  await stripe.paymentIntents.update(paymentIntent.id, {
    metadata: {
      ...metadata,
      booking_id: metadata.booking_id || booking.id,
      funds_release_state: 'released',
      funds_release_reason: opts.reason,
      funds_released_at: nowIso,
      provider_transfer_id: transferId || '',
      provider_payout_cents: String(providerPayoutCents),
      platform_fee_cents: String(platformFeeCents),
    },
  });

  await updateBookingReleaseFields(opts.supabase, booking.id, {
    status: 'completed',
    completed_at: booking.completed_at || nowIso,
    consumer_confirmation_due_at: null,
    funds_released_at: nowIso,
    funds_release_reason: opts.reason,
    stripe_transfer_id: transferId,
    provider_payout_cents: providerPayoutCents,
    platform_fee_cents: platformFeeCents,
  });

  return {
    ok: true,
    alreadyReleased: false,
    transferId,
    providerPayoutCents,
    platformFeeCents,
    releasedAt: nowIso,
  };
}

export async function refundBookingPayment(opts: {
  supabase: SupabaseClient<any, any, any>;
  bookingId: string;
  amountCents?: number;
}) {
  const booking = await getBookingForFunds(opts.supabase, opts.bookingId);
  if (!booking) return { refunded: false, reason: 'booking_not_found' };

  const paymentIntent = await retrievePaymentIntentForBooking(opts.bookingId, booking.stripe_payment_intent_id);
  if (!paymentIntent) return { refunded: false, reason: 'no_payment_found' };

  const existingRefunds = await stripe.refunds.list({ payment_intent: paymentIntent.id, limit: 25 });
  const alreadyRefunded = existingRefunds.data.reduce((sum, refund) => sum + (refund.amount || 0), 0);
  const maxRefundable = Math.max(0, (paymentIntent.amount_received || paymentIntent.amount || 0) - alreadyRefunded);
  if (maxRefundable <= 0) return { refunded: false, reason: 'already_refunded' };

  const refundAmount = typeof opts.amountCents === 'number'
    ? Math.max(1, Math.min(maxRefundable, Math.round(opts.amountCents)))
    : maxRefundable;

  const metadata = paymentIntent.metadata || {};
  const transferId = String(metadata.provider_transfer_id || '').trim();
  const providerPayoutCents = parseIntMeta(metadata.provider_payout_cents, 0);
  const serviceAmountCents = Math.max(0, Number(booking.amount_cents || 0));

  if (transferId && providerPayoutCents > 0 && serviceAmountCents > 0) {
    const transfer = await stripe.transfers.retrieve(transferId);
    const serviceRefundCents = Math.min(refundAmount, serviceAmountCents);
    const targetReversalCents = Math.min(
      providerPayoutCents,
      Math.round((serviceRefundCents / serviceAmountCents) * providerPayoutCents)
    );
    const reversibleCents = Math.max(0, (transfer.amount || 0) - (transfer.amount_reversed || 0));
    const reversalAmount = Math.min(targetReversalCents, reversibleCents);
    if (reversalAmount > 0) {
      await stripe.transfers.createReversal(transferId, {
        amount: reversalAmount,
        metadata: {
          booking_id: booking.id,
          refund_amount_cents: String(refundAmount),
        },
      });
    }
  }

  await stripe.refunds.create({
    payment_intent: paymentIntent.id,
    amount: refundAmount,
    reason: 'requested_by_customer',
    metadata: { booking_id: opts.bookingId },
  });

  return { refunded: true, amount_cents: refundAmount };
}
