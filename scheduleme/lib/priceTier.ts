// lib/priceTier.ts
// Compute $ / $$ / $$$ automatically from service prices + category defaults.

export type PriceTier = 1 | 2 | 3 | null;

type Threshold = { low: number; mid: number };

const DEFAULT_THRESHOLDS: Threshold = { low: 3000, mid: 8000 };

const CATEGORY_THRESHOLDS: Record<string, Threshold> = {
  beauty: { low: 2000, mid: 4500 },
  salon: { low: 2000, mid: 4500 },
  barber: { low: 2000, mid: 4500 },
  haircut: { low: 2000, mid: 4500 },
  nails: { low: 2500, mid: 5000 },
  tutoring: { low: 2500, mid: 5000 },
  photography: { low: 8000, mid: 20000 },
  fitness: { low: 2000, mid: 4500 },
  coaching: { low: 3000, mid: 7000 },
  cleaning: { low: 4000, mid: 9000 },
  repair: { low: 6000, mid: 15000 },
  handyman: { low: 6000, mid: 15000 },
};

const CATEGORY_DEFAULTS: Record<string, number> = {
  beauty: 2500,
  salon: 2500,
  barber: 2500,
  haircut: 2500,
  nails: 3500,
  tutoring: 3500,
  photography: 12000,
  fitness: 3000,
  coaching: 4500,
  cleaning: 6000,
  repair: 9000,
  handyman: 9000,
};

function normalizeTag(tag?: string | null): string | null {
  if (!tag) return null;
  const cleaned = tag.toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned || null;
}

function thresholdsFor(tag?: string | null): Threshold {
  const t = normalizeTag(tag);
  if (t && CATEGORY_THRESHOLDS[t]) return CATEGORY_THRESHOLDS[t];
  return DEFAULT_THRESHOLDS;
}

function defaultPriceFor(tag?: string | null): number | null {
  const t = normalizeTag(tag);
  if (t && CATEGORY_DEFAULTS[t]) return CATEGORY_DEFAULTS[t];
  return 5000;
}

export function computePriceTier(avgPriceCents: number | null, categoryTag?: string | null): PriceTier {
  const base = (avgPriceCents && Number.isFinite(avgPriceCents)) ? avgPriceCents : defaultPriceFor(categoryTag);
  if (!base) return null;
  const { low, mid } = thresholdsFor(categoryTag);
  if (base <= low) return 1;
  if (base <= mid) return 2;
  return 3;
}

export function averagePriceCents(prices: number[]): number | null {
  const clean = prices.filter((p) => Number.isFinite(p) && p > 0);
  if (clean.length === 0) return null;
  const sum = clean.reduce((s, p) => s + p, 0);
  return Math.round(sum / clean.length);
}
