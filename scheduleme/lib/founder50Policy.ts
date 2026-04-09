const UCSC_ALIASES = new Set([
  'ucsc',
  'ucsc.edu',
  'uc_santa_cruz',
  'university_of_california_santa_cruz',
]);

function normalizeCampusToken(input?: string | null): string | null {
  if (!input) return null;
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9.]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned) return null;
  if (UCSC_ALIASES.has(cleaned)) return 'ucsc';
  return cleaned;
}

function parseAllowedCampuses(): Set<string> {
  // Comma-separated list. Example:
  // FOUNDER50_ALLOWED_CAMPUSES=ucsc
  // FOUNDER50_ALLOWED_CAMPUSES=ucsc,sjsu
  const raw = process.env.FOUNDER50_ALLOWED_CAMPUSES || 'ucsc';
  const items = raw
    .split(',')
    .map((v) => normalizeCampusToken(v))
    .filter(Boolean) as string[];
  return new Set(items.length ? items : ['ucsc']);
}

export function isFounder50CampusAllowed(opts: { campusKey?: string | null; campusSchoolName?: string | null }): boolean {
  const allowed = parseAllowedCampuses();
  const keyFromCampusKey = normalizeCampusToken(opts.campusKey);
  const keyFromSchoolName = normalizeCampusToken(opts.campusSchoolName);
  if (keyFromCampusKey && allowed.has(keyFromCampusKey)) return true;
  if (keyFromSchoolName && allowed.has(keyFromSchoolName)) return true;
  return false;
}

