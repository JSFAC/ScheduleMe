type MaybeString = string | null | undefined;

export type TrustActionState =
  | 'clear'
  | 'flagged'
  | 'warned'
  | 'requested_info'
  | 'suspended';

export function normalizeDomain(value?: MaybeString): string | null {
  if (!value) return null;
  const trimmed = String(value).trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.includes('@')) return trimmed.split('@').pop() || null;
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}

export function normalizeCampusKey(value?: MaybeString): string | null {
  if (!value) return null;
  const cleaned = String(value).toLowerCase().replace(/[^a-z0-9.]+/g, '');
  return cleaned || null;
}

export function getTrustState(row: any): TrustActionState {
  const raw = String(row?.trust_status || '').trim().toLowerCase();
  if (raw === 'flagged' || raw === 'warned' || raw === 'requested_info' || raw === 'suspended') return raw;
  if (row?.trust_flagged === true) return 'flagged';
  return 'clear';
}

export function isProviderSuspended(row: any): boolean {
  return getTrustState(row) === 'suspended';
}

export function isProviderFlagged(row: any): boolean {
  return getTrustState(row) === 'flagged' || row?.trust_flagged === true;
}

export function isProviderPubliclyVisible(row: any): boolean {
  if (!row) return false;
  if (row.is_onboarded !== true) return false;
  // Legacy compatibility:
  // older approved providers may have public_visibility=false before the
  // publish flow existed. Treat those as public unless/until they explicitly
  // use the new publish toggle (published_at gets populated).
  if (row.public_visibility === false) {
    const legacyApproved = !!row.approved_at && !row.published_at;
    if (!legacyApproved) return false;
  }
  if (isProviderSuspended(row)) return false;
  if (isProviderFlagged(row)) return false;
  return true;
}

export function canUserTransactWithStudentProvider(opts: {
  business: any;
  profile: any;
}): { ok: boolean; code?: string; message?: string } {
  // Campus / .edu verification should influence discovery surfaces and what
  // identity details are shown, not whether an otherwise visible provider can
  // be booked or messaged. The old gate was over-blocking legitimate flows and
  // even produced false negatives for same-campus verified accounts.
  return { ok: true };
}
