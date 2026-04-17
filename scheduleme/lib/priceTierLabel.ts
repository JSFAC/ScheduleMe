export function formatPriceTierLabel(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    return '$'.repeat(Math.max(1, Math.min(4, Math.floor(value))));
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\$+$/.test(raw)) {
    return raw.slice(0, 4);
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return '$'.repeat(Math.max(1, Math.min(4, Math.floor(parsed))));
}
