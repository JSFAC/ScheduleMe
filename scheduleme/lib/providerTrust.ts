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
  if (row.public_visibility === false) return false;
  if (isProviderSuspended(row)) return false;
  if (isProviderFlagged(row)) return false;
  return true;
}

export function canUserTransactWithStudentProvider(opts: {
  business: any;
  profile: any;
}): { ok: boolean; code?: string; message?: string } {
  const business = opts.business || {};
  const profile = opts.profile || {};

  const isStudentProvider = business.campus_provider === true && business.edu_verified === true;
  if (!isStudentProvider) return { ok: true };

  const userEduVerified = profile.edu_verified === true;
  if (!userEduVerified) {
    return {
      ok: false,
      code: 'edu_verification_required',
      message: 'This student provider requires .edu verification before booking or messaging.',
    };
  }

  const userDomain =
    normalizeDomain(profile.school_domain)
    || normalizeDomain(profile.school_email)
    || normalizeCampusKey(profile.campus_key);
  const bizDomain =
    normalizeDomain(business.school_domain)
    || normalizeCampusKey(business.campus_key);

  if (!userDomain || !bizDomain) {
    return {
      ok: false,
      code: 'campus_match_required',
      message: 'Campus verification is incomplete. Please re-verify your .edu email.',
    };
  }

  const userNormalized = normalizeCampusKey(userDomain) || userDomain;
  const bizNormalized = normalizeCampusKey(bizDomain) || bizDomain;
  const userAlt = userNormalized.replace(/\.edu$/g, '');
  const bizAlt = bizNormalized.replace(/\.edu$/g, '');

  const sameCampus =
    userNormalized === bizNormalized
    || userNormalized === bizAlt
    || userAlt === bizNormalized
    || userAlt === bizAlt;

  if (!sameCampus) {
    return {
      ok: false,
      code: 'campus_match_required',
      message: 'This student provider is limited to verified users at the same school.',
    };
  }

  return { ok: true };
}
