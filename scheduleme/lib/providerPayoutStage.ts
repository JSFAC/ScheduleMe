import type { SupabaseClient } from '@supabase/supabase-js';

export const MANUAL_PAYOUT_BOOKING_THRESHOLD = 3;

type StripeShape = {
  stripe_onboarded?: boolean | null;
  stripe_account_id?: string | null;
};

export type ProviderPayoutStage = 'manual_payout' | 'stripe_required' | 'booking_ready';

export type ProviderPayoutStageInfo = {
  stage: ProviderPayoutStage;
  threshold: number;
  paidBookingsCount: number;
  remainingBeforeStripeRequired: number;
  requiresStripeForNewBookings: boolean;
  canAcceptNewBookings: boolean;
  stripeReady: boolean;
};

export function isProviderStripeReady(provider?: StripeShape | null): boolean {
  return !!provider?.stripe_onboarded && !!provider?.stripe_account_id;
}

export function deriveProviderPayoutStage(input: {
  stripe_onboarded?: boolean | null;
  stripe_account_id?: string | null;
  paidBookingsCount?: number | null;
  threshold?: number;
}): ProviderPayoutStageInfo {
  const threshold = Math.max(1, Math.round(Number(input.threshold || MANUAL_PAYOUT_BOOKING_THRESHOLD)));
  const paidBookingsCount = Math.max(0, Math.round(Number(input.paidBookingsCount || 0)));
  const stripeReady = isProviderStripeReady(input);

  if (stripeReady) {
    return {
      stage: 'booking_ready',
      threshold,
      paidBookingsCount,
      remainingBeforeStripeRequired: 0,
      requiresStripeForNewBookings: false,
      canAcceptNewBookings: true,
      stripeReady,
    };
  }

  const remainingBeforeStripeRequired = Math.max(0, threshold - paidBookingsCount);
  const requiresStripeForNewBookings = paidBookingsCount >= threshold;

  return {
    stage: requiresStripeForNewBookings ? 'stripe_required' : 'manual_payout',
    threshold,
    paidBookingsCount,
    remainingBeforeStripeRequired,
    requiresStripeForNewBookings,
    canAcceptNewBookings: !requiresStripeForNewBookings,
    stripeReady,
  };
}

export async function countProviderPaidBookings(
  supabase: SupabaseClient<any, any, any>,
  businessId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .not('paid_at', 'is', null)
    .not('status', 'in', '(cancelled,payment_failed)');

  if (error) throw error;
  return Number(count || 0);
}

export async function loadProviderPayoutStage(
  supabase: SupabaseClient<any, any, any>,
  business: ({ id: string } & StripeShape) | null | undefined
): Promise<ProviderPayoutStageInfo | null> {
  if (!business?.id) return null;
  const paidBookingsCount = await countProviderPaidBookings(supabase, business.id);
  return deriveProviderPayoutStage({
    stripe_onboarded: business.stripe_onboarded,
    stripe_account_id: business.stripe_account_id,
    paidBookingsCount,
  });
}
