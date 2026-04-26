import type { SupabaseClient } from '@supabase/supabase-js';

type BusinessSeed = {
  id: string;
  campus_key?: string | null;
  edu_verified?: boolean | null;
};

export async function assignFounder50IfEligible(
  supabase: SupabaseClient,
  business: BusinessSeed
): Promise<{ assigned: boolean; reason?: string }> {
  if (!business?.id) return { assigned: false, reason: 'missing_business_id' };
  const { data, error } = await supabase.rpc('assign_founder50_if_eligible', {
    p_business_id: business.id,
  });
  if (error) return { assigned: false, reason: 'rpc_failed' };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { assigned: false, reason: 'rpc_empty' };
  return { assigned: !!row.assigned, reason: row.reason || undefined };
}
