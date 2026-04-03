type HasFounder50 = {
  founder50?: boolean | null;
};

const DEFAULT_PLATFORM_FEE_PERCENT = 12;
const FOUNDER50_PLATFORM_FEE_PERCENT = 6;

export function getPlatformFeePercent(business?: HasFounder50 | null): number {
  if (business?.founder50) return FOUNDER50_PLATFORM_FEE_PERCENT;
  return DEFAULT_PLATFORM_FEE_PERCENT;
}

export function assertPlatformFeePercent(business: HasFounder50 | null | undefined, percent: number): boolean {
  const expected = getPlatformFeePercent(business);
  return percent === expected;
}
