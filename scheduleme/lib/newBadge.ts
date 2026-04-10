// lib/newBadge.ts
// Single source of truth for "New" badge visibility.

const DEFAULT_NEW_BADGE_DAYS = 14;

export function shouldShowNewBadge(opts: {
  createdAt?: string | null;
  reviewCount?: number | null;
  windowDays?: number;
}): boolean {
  const reviews = Number(opts.reviewCount ?? 0);
  if (reviews > 0) return false;

  const createdRaw = opts.createdAt;
  if (!createdRaw) return false;
  const createdMs = new Date(createdRaw).getTime();
  if (!Number.isFinite(createdMs)) return false;

  const windowDays = Number(opts.windowDays ?? DEFAULT_NEW_BADGE_DAYS);
  const maxAgeMs = windowDays * 24 * 60 * 60 * 1000;
  return Date.now() - createdMs <= maxAgeMs;
}

