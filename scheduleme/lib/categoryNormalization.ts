// lib/categoryNormalization.ts
// Canonical category normalization for provider service tags.

type CategoryDef = {
  key: string;
  label: string;
  aliases: string[];
  keywords: string[];
};

const CATEGORY_DEFS: CategoryDef[] = [
  {
    key: 'hair_and_beauty',
    label: 'Hair & Beauty',
    aliases: [
      'hair_and_beauty',
      'hair and beauty',
      'hair & beauty',
      'hair beauty',
      'hair salon',
      'beauty salon',
      'haircuts',
      'haircut',
      'barber',
      'barbershop',
      'salon',
      'salon_beauty',
      'salon/beauty',
      'salon / beauty',
      'salon beauty',
      'beauty',
      'cosmetology',
      'cosmetologist',
      'esthetician',
      'esthetics',
      'lashes',
      'lash',
      'brows',
      'makeup',
      'nails',
    ],
    keywords: ['hair', 'beauty', 'cut', 'cuts', 'barber', 'salon', 'stylist', 'cosmet', 'esthetic', 'lash', 'brow', 'makeup', 'nail'],
  },
  {
    key: 'design_and_3d_printing',
    label: 'Design and 3d Printing',
    aliases: ['design_and_3d_printing', 'design and 3d printing', '3d printing', '3d_printing', 'design'],
    keywords: ['design', '3d', 'printing', 'print', 'cad', 'prototype'],
  },
  {
    key: 'photography',
    label: 'Photography',
    aliases: ['photography', 'photographer', 'photo'],
    keywords: ['photo', 'photos', 'photography', 'photographer', 'camera', 'shoot'],
  },
  {
    key: 'tutoring',
    label: 'Tutoring',
    aliases: ['tutoring', 'tutor'],
    keywords: ['tutor', 'tutoring', 'homework', 'study', 'lesson'],
  },
  {
    key: 'plumbing',
    label: 'Plumbing',
    aliases: ['plumbing', 'plumber'],
    keywords: ['plumb', 'pipe', 'drain', 'toilet', 'faucet', 'water heater'],
  },
  {
    key: 'electrical',
    label: 'Electrical',
    aliases: ['electrical', 'electrician', 'electric'],
    keywords: ['electrical', 'electric', 'electrician', 'wiring', 'breaker', 'outlet'],
  },
  {
    key: 'hvac',
    label: 'HVAC',
    aliases: ['hvac', 'ac', 'heating and cooling'],
    keywords: ['hvac', 'ac', 'air conditioning', 'cooling', 'heating', 'furnace'],
  },
  {
    key: 'cleaning',
    label: 'Cleaning',
    aliases: ['cleaning', 'cleaner', 'deep clean'],
    keywords: ['clean', 'cleaning', 'maid', 'housekeeping', 'deep clean'],
  },
  {
    key: 'home_repair_handyman',
    label: 'Home Repair / Handyman',
    aliases: ['home_repair_handyman', 'home repair', 'handyman', 'home repair / handyman'],
    keywords: ['repair', 'handyman', 'install', 'mount', 'assemble', 'fix'],
  },
  {
    key: 'painting',
    label: 'Painting',
    aliases: ['painting', 'painter', 'paint'],
    keywords: ['paint', 'painting', 'painter'],
  },
  {
    key: 'landscaping',
    label: 'Landscaping',
    aliases: ['landscaping', 'landscape', 'lawn care', 'yard work'],
    keywords: ['landscape', 'landscaping', 'lawn', 'yard', 'garden'],
  },
  {
    key: 'moving',
    label: 'Moving',
    aliases: ['moving', 'movers', 'move'],
    keywords: ['move', 'moving', 'mover', 'haul'],
  },
  {
    key: 'automotive',
    label: 'Automotive',
    aliases: ['automotive', 'auto repair', 'auto', 'mechanic'],
    keywords: ['auto', 'automotive', 'car', 'mechanic', 'brake', 'battery'],
  },
  {
    key: 'arts_and_crafts',
    label: 'Arts & Crafts',
    aliases: ['arts_and_crafts', 'arts and crafts', 'crafts', 'art'],
    keywords: ['art', 'arts', 'craft', 'crafts'],
  },
  {
    key: 'pest_control',
    label: 'Pest Control',
    aliases: ['pest_control', 'pest control', 'pest'],
    keywords: ['pest', 'bugs', 'rodent', 'roach', 'ants'],
  },
];

const ALIAS_TO_KEY = new Map<string, string>();
const KEY_TO_LABEL = new Map<string, string>();

for (const def of CATEGORY_DEFS) {
  KEY_TO_LABEL.set(def.key, def.label);
  for (const alias of def.aliases) {
    ALIAS_TO_KEY.set(baseNormalize(alias), def.key);
  }
}

function baseNormalize(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[/,+_-]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function keyFromText(input: string): string {
  return baseNormalize(input).replace(/\s+/g, '_');
}

export function normalizeServiceTag(input?: string | null): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const normalized = baseNormalize(raw);
  if (!normalized) return '';

  const exact = ALIAS_TO_KEY.get(normalized);
  if (exact) return exact;

  // Keyword-based scoring for loose free-text inputs.
  let bestKey: string | null = null;
  let bestScore = 0;
  for (const def of CATEGORY_DEFS) {
    let score = 0;
    for (const kw of def.keywords) {
      if (normalized.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestKey = def.key;
    }
  }
  if (bestKey && bestScore > 0) return bestKey;

  return keyFromText(raw);
}

export function normalizeServiceTags(inputs: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const raw of inputs || []) {
    const normalized = normalizeServiceTag(raw);
    if (!normalized) continue;
    if (!out.includes(normalized)) out.push(normalized);
  }
  return out;
}

export function serviceTagToLabel(tag?: string | null): string {
  const key = normalizeServiceTag(tag);
  if (!key) return 'General';
  const canonical = KEY_TO_LABEL.get(key);
  if (canonical) return canonical;
  return key
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
