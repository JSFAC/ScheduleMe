import { isFounder50Active } from './founder50';

type HasFounder50 = {
  founder50?: boolean | null;
  founder50_status?: string | null;
  last_completed_booking_at?: string | null;
  away_start?: string | null;
  away_end?: string | null;
  availability_status?: string | null;
  break_until?: string | null;
};

const DEFAULT_PLATFORM_FEE_PERCENT = 12;
const FOUNDER50_PLATFORM_FEE_PERCENT = 6;

function isFounder50FeeEligible(business?: HasFounder50 | null): boolean {
  if (!business?.founder50) return false;
  // Founder50 fee is locked unless explicitly revoked.
  if (String(business.founder50_status || '').toLowerCase() === 'revoked') return false;
  return true;
}

export function getPlatformFeePercent(business?: HasFounder50 | null): number {
  if (isFounder50FeeEligible(business) || isFounder50Active(business)) return FOUNDER50_PLATFORM_FEE_PERCENT;
  return DEFAULT_PLATFORM_FEE_PERCENT;
}

export function assertPlatformFeePercent(business: HasFounder50 | null | undefined, percent: number): boolean {
  const expected = getPlatformFeePercent(business);
  return percent === expected;
}
