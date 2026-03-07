// lib/mockProviders.ts
export interface Provider {
  id: string;
  name: string;
  service: string;               // primary service category (lowercase)
  serviceAliases: string[];      // additional matching keywords
  location: string;              // city name for substring match
  rating: number;                // 1–5
  reviewCount: number;
  phone: string;
  badge?: string;                // e.g. "Top Rated", "Verified"
  available: boolean;
}

export const MOCK_PROVIDERS: Provider[] = [
  // ── Plumbing ──────────────────────────────────────────────────────────────
  {
    id: 'p-001',
    name: 'Mike R. Plumbing',
    service: 'plumbing',
    serviceAliases: ['pipe', 'drain', 'faucet', 'toilet', 'leak', 'water heater', 'sewer'],
    location: 'Austin',
    rating: 4.9,
    reviewCount: 312,
    phone: '5125550101',
    badge: 'Top Rated',
    available: true,
  },
  {
    id: 'p-002',
    name: 'AquaFix Services',
    service: 'plumbing',
    serviceAliases: ['pipe', 'drain', 'faucet', 'leak', 'water heater'],
    location: 'Austin',
    rating: 4.7,
    reviewCount: 198,
    phone: '5125550102',
    badge: 'Verified',
    available: true,
  },
  {
    id: 'p-003',
    name: 'Capital City Plumbers',
    service: 'plumbing',
    serviceAliases: ['pipe', 'drain', 'toilet', 'sewer', 'leak'],
    location: 'Austin',
    rating: 4.6,
    reviewCount: 134,
    phone: '5125550103',
    available: true,
  },
  // ── HVAC ─────────────────────────────────────────────────────────────────
  {
    id: 'h-001',
    name: 'CoolBreeze HVAC',
    service: 'hvac',
    serviceAliases: ['ac', 'air conditioning', 'furnace', 'heating', 'heat pump', 'thermostat', 'duct'],
    location: 'Austin',
    rating: 4.8,
    reviewCount: 275,
    phone: '5125550201',
    badge: 'Top Rated',
    available: true,
  },
  {
    id: 'h-002',
    name: 'Polar Air Systems',
    service: 'hvac',
    serviceAliases: ['ac', 'air conditioning', 'furnace', 'heating', 'heat pump'],
    location: 'Austin',
    rating: 4.6,
    reviewCount: 187,
    phone: '5125550202',
    badge: 'Verified',
    available: true,
  },
  {
    id: 'h-003',
    name: 'Texas Comfort HVAC',
    service: 'hvac',
    serviceAliases: ['ac', 'furnace', 'heating', 'thermostat'],
    location: 'Austin',
    rating: 4.5,
    reviewCount: 112,
    phone: '5125550203',
    available: true,
  },
  // ── Automotive ────────────────────────────────────────────────────────────
  {
    id: 'a-001',
    name: 'FastLane Auto Repair',
    service: 'automotive',
    serviceAliases: ['car', 'brake', 'engine', 'tire', 'oil', 'transmission', 'battery', 'mechanic'],
    location: 'Austin',
    rating: 4.8,
    reviewCount: 401,
    phone: '5125550301',
    badge: 'Top Rated',
    available: true,
  },
  {
    id: 'a-002',
    name: 'Downtown Auto Service',
    service: 'automotive',
    serviceAliases: ['car', 'brake', 'engine', 'oil', 'mechanic', 'battery'],
    location: 'Austin',
    rating: 4.6,
    reviewCount: 223,
    phone: '5125550302',
    badge: 'Verified',
    available: true,
  },
  {
    id: 'a-003',
    name: 'Lopez Mobile Mechanic',
    service: 'automotive',
    serviceAliases: ['car', 'brake', 'engine', 'tire', 'mechanic'],
    location: 'Austin',
    rating: 4.5,
    reviewCount: 98,
    phone: '5125550303',
    available: true,
  },
  // ── Salon / Beauty ────────────────────────────────────────────────────────
  {
    id: 's-001',
    name: 'Luxe Salon & Spa',
    service: 'salon',
    serviceAliases: ['hair', 'cut', 'color', 'highlights', 'nails', 'wax', 'beauty', 'blowout'],
    location: 'Austin',
    rating: 4.9,
    reviewCount: 521,
    phone: '5125550401',
    badge: 'Top Rated',
    available: true,
  },
  {
    id: 's-002',
    name: 'The Style Bar',
    service: 'salon',
    serviceAliases: ['hair', 'cut', 'color', 'nails', 'beauty'],
    location: 'Austin',
    rating: 4.7,
    reviewCount: 340,
    phone: '5125550402',
    badge: 'Verified',
    available: true,
  },
  {
    id: 's-003',
    name: 'CutAbove Barbershop',
    service: 'salon',
    serviceAliases: ['hair', 'cut', 'beard', 'shave', 'barber'],
    location: 'Austin',
    rating: 4.6,
    reviewCount: 178,
    phone: '5125550403',
    available: true,
  },
  // ── Home Repair ───────────────────────────────────────────────────────────
  {
    id: 'r-001',
    name: 'ProFix Handyman',
    service: 'home repair',
    serviceAliases: ['handyman', 'fix', 'repair', 'drywall', 'paint', 'door', 'window', 'fence', 'deck', 'carpentry'],
    location: 'Austin',
    rating: 4.8,
    reviewCount: 267,
    phone: '5125550501',
    badge: 'Top Rated',
    available: true,
  },
  {
    id: 'r-002',
    name: 'Home Heroes',
    service: 'home repair',
    serviceAliases: ['handyman', 'drywall', 'paint', 'door', 'window', 'carpentry', 'repair'],
    location: 'Austin',
    rating: 4.6,
    reviewCount: 183,
    phone: '5125550502',
    badge: 'Verified',
    available: true,
  },
  {
    id: 'r-003',
    name: 'Austin Patch & Paint',
    service: 'home repair',
    serviceAliases: ['paint', 'drywall', 'patch', 'repair', 'handyman'],
    location: 'Austin',
    rating: 4.5,
    reviewCount: 91,
    phone: '5125550503',
    available: true,
  },
  // ── Electrical ────────────────────────────────────────────────────────────
  {
    id: 'e-001',
    name: 'Volt Masters Electric',
    service: 'electrical',
    serviceAliases: ['outlet', 'breaker', 'wiring', 'panel', 'switch', 'lighting', 'electrician'],
    location: 'Austin',
    rating: 4.9,
    reviewCount: 344,
    phone: '5125550601',
    badge: 'Top Rated',
    available: true,
  },
  {
    id: 'e-002',
    name: 'Bright Spark Electric',
    service: 'electrical',
    serviceAliases: ['outlet', 'breaker', 'wiring', 'panel', 'electrician'],
    location: 'Austin',
    rating: 4.7,
    reviewCount: 201,
    phone: '5125550602',
    badge: 'Verified',
    available: true,
  },
  {
    id: 'e-003',
    name: 'Capital Electricians',
    service: 'electrical',
    serviceAliases: ['outlet', 'wiring', 'panel', 'lighting'],
    location: 'Austin',
    rating: 4.5,
    reviewCount: 117,
    phone: '5125550603',
    available: true,
  },
  // ── Cleaning ──────────────────────────────────────────────────────────────
  {
    id: 'c-001',
    name: 'SparkleClean Pro',
    service: 'cleaning',
    serviceAliases: ['clean', 'maid', 'housekeeping', 'deep clean', 'move-out', 'carpet'],
    location: 'Austin',
    rating: 4.8,
    reviewCount: 412,
    phone: '5125550701',
    badge: 'Top Rated',
    available: true,
  },
  {
    id: 'c-002',
    name: 'Maid Easy',
    service: 'cleaning',
    serviceAliases: ['clean', 'maid', 'housekeeping', 'recurring', 'deep clean'],
    location: 'Austin',
    rating: 4.6,
    reviewCount: 289,
    phone: '5125550702',
    badge: 'Verified',
    available: true,
  },
];

/**
 * matchProviders
 *
 * Rule-based matching: score each provider and return top N.
 *
 * Scoring:
 *  +10  exact service category match (lowercase)
 *  +5   alias keyword found in user message (lowercase)
 *  +3   location substring match (case-insensitive)
 *  +2   per 0.1 rating above 4.0 (max ~+4)
 *  only `available` providers are considered
 *
 * @param serviceCategory  triage service_category from Claude
 * @param userMessage      raw user message for keyword scan
 * @param userLocation     user-provided location string
 * @param topN             number of results to return (default 3)
 */
export function matchProviders(
  serviceCategory: string,
  userMessage: string,
  userLocation: string,
  topN = 3,
): Provider[] {
  const cat = serviceCategory.toLowerCase();
  const msg = userMessage.toLowerCase();
  const loc = userLocation.toLowerCase();

  const scored = MOCK_PROVIDERS.filter((p) => p.available).map((p) => {
    let score = 0;

    // Service category match
    if (p.service.toLowerCase() === cat) score += 10;
    else if (cat.includes(p.service.toLowerCase()) || p.service.toLowerCase().includes(cat)) score += 6;

    // Alias keyword scan in message
    for (const alias of p.serviceAliases) {
      if (msg.includes(alias.toLowerCase())) {
        score += 5;
        break; // count once per provider
      }
    }

    // Location match
    if (loc.includes(p.location.toLowerCase()) || p.location.toLowerCase().includes(loc)) {
      score += 3;
    }

    // Rating bonus
    if (p.rating > 4.0) score += Math.round((p.rating - 4.0) * 20);

    return { provider: p, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(({ provider }) => provider);
}
