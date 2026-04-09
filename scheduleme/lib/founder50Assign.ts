import type { SupabaseClient } from '@supabase/supabase-js';
import { isFounder50CampusAllowed, normalizeFounder50CampusKey } from './founder50Policy';

type BusinessSeed = {
  id: string;
  founder50?: boolean | null;
  founder50_status?: string | null;
  campus_provider?: boolean | null;
  campus_key?: string | null;
  campus_school_name?: string | null;
  edu_verified?: boolean | null;
};

export async function assignFounder50IfEligible(
  supabase: SupabaseClient,
  business: BusinessSeed
): Promise<{ assigned: boolean; reason?: string }> {
  if (!business?.id) return { assigned: false, reason: 'missing_business_id' };
  if (business.founder50) return { assigned: false, reason: 'already_founder50' };
  if (!business.campus_provider) return { assigned: false, reason: 'not_campus_provider' };
  if (!business.edu_verified) return { assigned: false, reason: 'not_edu_verified' };

  const campusKey = normalizeFounder50CampusKey(business.campus_key || business.campus_school_name);
  if (!campusKey) return { assigned: false, reason: 'missing_campus_key' };

  const campusAllowed = await isFounder50CampusAllowed(supabase, {
    campusKey,
    campusSchoolName: business.campus_school_name,
  });
  if (!campusAllowed) return { assigned: false, reason: 'campus_not_allowlisted' };

  // Count active+paused+revoked founder50 rows for this campus as the 50-slot cap.
  const { count, error: countErr } = await supabase
    .from('businesses')
    .select('id', { head: true, count: 'exact' })
    .eq('campus_provider', true)
    .eq('campus_key', campusKey)
    .eq('founder50', true);
  if (countErr) return { assigned: false, reason: 'count_failed' };
  if ((count || 0) >= 50) return { assigned: false, reason: 'campus_full' };

  const { error: updErr } = await supabase
    .from('businesses')
    .update({
      campus_key: campusKey,
      founder50: true,
      founder50_status: 'active',
    })
    .eq('id', business.id)
    .eq('founder50', false);
  if (updErr) return { assigned: false, reason: 'update_failed' };

  return { assigned: true };
}
