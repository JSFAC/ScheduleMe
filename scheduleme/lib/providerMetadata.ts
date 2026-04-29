type MaybeString = string | null | undefined;

export function normalizeDomain(value?: MaybeString): string | null {
  if (!value) return null;
  const trimmed = String(value).trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.includes('@')) return trimmed.split('@').pop() || null;
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}

export function normalizeCampusKey(value?: MaybeString): string | null {
  const normalized = normalizeDomain(value);
  if (!normalized) return null;
  return normalized.replace(/[^a-z0-9.]+/g, '') || null;
}

export function formatCampusLabel(domain?: MaybeString): string {
  const value = normalizeDomain(domain);
  if (!value) return '';
  const known: Record<string, string> = {
    'asu.edu': 'ASU',
    'berkeley.edu': 'UC Berkeley',
    'sfsu.edu': 'SF State',
    'stanford.edu': 'Stanford',
    'ucla.edu': 'UCLA',
    'ucdavis.edu': 'UC Davis',
    'uci.edu': 'UCI',
    'ucmerced.edu': 'UC Merced',
    'ucr.edu': 'UC Riverside',
    'ucsb.edu': 'UCSB',
    'ucsc.edu': 'UCSC',
    'ucsd.edu': 'UCSD',
    'ucsf.edu': 'UCSF',
    'usc.edu': 'USC',
  };
  if (known[value]) return known[value];
  const base = value.replace(/\.edu$/, '').split('.')[0] || value;
  return base.length <= 5 ? base.toUpperCase() : base.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export function inferCampusMetadataFromEmail(email?: MaybeString) {
  const schoolDomain = normalizeDomain(email);
  const campusKey = normalizeCampusKey(schoolDomain);
  return {
    schoolEmail: email ? String(email).trim().toLowerCase() : null,
    schoolDomain,
    campusKey,
    campusSchoolName: formatCampusLabel(schoolDomain) || null,
  };
}

export async function geocodeUsLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  const cleaned = String(location || '').trim();
  if (!cleaned) return null;
  try {
    const isZip = /^\d{5}(?:-\d{4})?$/.test(cleaned);
    const query = isZip ? `${cleaned}, USA` : cleaned;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`;
    const res = await fetch(url, { headers: { 'User-Agent': 'ScheduleMe/1.0' } });
    const data = await res.json();
    if (data?.[0]) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
  } catch {}
  return null;
}
