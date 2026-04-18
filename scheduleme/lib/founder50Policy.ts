import type { SupabaseClient } from '@supabase/supabase-js';

const UCSC_ALIASES = new Set([
  'ucsc',
  'ucsc.edu',
  'uc_santa_cruz',
  'university_of_california_santa_cruz',
]);
const SFSU_ALIASES = new Set([
  'sfsu',
  'sfsu.edu',
  'sf_state',
  'san_francisco_state_university',
  'csu_sf',
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
  if (SFSU_ALIASES.has(cleaned)) return 'sfsu';
  return cleaned;
}

export function normalizeFounder50CampusKey(input?: string | null): string | null {
  return normalizeCampusToken(input);
}

async function fetchAllowedFounder50Campuses(supabase: SupabaseClient): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('founder50_allowed_campuses')
      .select('campus_key')
      .eq('active', true);

    if (error || !Array.isArray(data)) {
      return new Set(['ucsc']);
    }
    const normalized = data
      .map((row: any) => normalizeCampusToken(row?.campus_key))
      .filter(Boolean) as string[];
    return new Set(normalized.length ? normalized : ['ucsc']);
  } catch {
    // Safe fallback while table is being rolled out.
    return new Set(['ucsc']);
  }
}

export async function isFounder50CampusAllowed(
  supabase: SupabaseClient,
  opts: { campusKey?: string | null; campusSchoolName?: string | null }
): Promise<boolean> {
  const allowed = await fetchAllowedFounder50Campuses(supabase);
  const keyFromCampusKey = normalizeCampusToken(opts.campusKey);
  const keyFromSchoolName = normalizeCampusToken(opts.campusSchoolName);
  if (keyFromCampusKey && allowed.has(keyFromCampusKey)) return true;
  if (keyFromSchoolName && allowed.has(keyFromSchoolName)) return true;
  return false;
}
