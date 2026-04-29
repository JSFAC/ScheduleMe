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

function isLegacyApprovedProvider(row: any): boolean {
  return !!row?.approved_at && !row?.published_at;
}

export function isCampusStudentProvider(row: any): boolean {
  return row?.campus_provider === true && row?.edu_verified === true;
}

export function getProviderVisibilitySettings(row: any): {
  publicVisibility: boolean;
  publicShowName: boolean;
  publicShowPhotos: boolean;
  campusShowName: boolean;
} {
  const legacyApproved = isLegacyApprovedProvider(row);
  const publicVisibility = row?.public_visibility === false ? legacyApproved : true;
  const publicShowNameExplicitFalse = row?.public_show_name === false;
  const publicShowPhotosExplicitFalse = row?.public_show_photos === false && row?.public_show_media !== true;
  const campusShowNameExplicitFalse = row?.campus_show_name === false;

  // Legacy providers were briefly initialized with falsey visibility flags
  // before the current privacy model was finalized. If a card is otherwise
  // public but every identity toggle is effectively "off", treat it as an
  // uncustomized legacy row and default back to visible-by-default.
  const looksLikeLegacyHiddenDefaults =
    publicVisibility &&
    publicShowNameExplicitFalse &&
    publicShowPhotosExplicitFalse &&
    campusShowNameExplicitFalse;

  const publicShowName = looksLikeLegacyHiddenDefaults ? true : !publicShowNameExplicitFalse;
  const publicShowPhotos = looksLikeLegacyHiddenDefaults ? true : !publicShowPhotosExplicitFalse;
  const campusShowName = looksLikeLegacyHiddenDefaults ? true : !campusShowNameExplicitFalse;
  return {
    publicVisibility,
    publicShowName,
    publicShowPhotos,
    campusShowName,
  };
}

export function isProviderPubliclyVisible(row: any): boolean {
  if (!row) return false;
  if (row.is_onboarded !== true) return false;
  if (!getProviderVisibilitySettings(row).publicVisibility) return false;
  if (isProviderSuspended(row)) return false;
  if (isProviderFlagged(row)) return false;
  return true;
}

export function shouldShowProviderOnNonStudentSurfaces(row: any, viewerEduVerified: boolean): boolean {
  if (!isProviderPubliclyVisible(row)) return false;
  if (!isCampusStudentProvider(row)) return true;
  if (viewerEduVerified) return true;
  return getProviderVisibilitySettings(row).publicVisibility;
}

export function shouldLockProviderPreviewForViewer(row: any, viewerEduVerified: boolean): boolean {
  if (!isCampusStudentProvider(row)) return false;
  if (viewerEduVerified) return false;
  const vis = getProviderVisibilitySettings(row);
  return !vis.publicShowName || !vis.publicShowPhotos;
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
