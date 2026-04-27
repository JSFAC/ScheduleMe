import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';

export type ProviderAccessState = 'loading' | 'logged_out' | 'consumer' | 'provider';

export function defaultProviderNameForUser(user: User | null | undefined): string {
  const fullName =
    String(user?.user_metadata?.full_name || '').trim() ||
    String(user?.user_metadata?.name || '').trim();
  if (fullName) return `${fullName}'s Services`;

  const emailLocal = String(user?.email || '').split('@')[0]?.replace(/[^a-z0-9]+/gi, ' ').trim();
  if (emailLocal) return `${emailLocal} Services`;

  return 'New Provider';
}

export async function getProviderAccessState(): Promise<{ state: Exclude<ProviderAccessState, 'loading'>; user: User | null }> {
  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) return { state: 'logged_out', user: null };

  const byOwnerId = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();
  if (byOwnerId.data?.id) return { state: 'provider', user };

  const normalizedEmail = String(user.email || '').trim().toLowerCase();
  if (!normalizedEmail) return { state: 'consumer', user };

  const byOwnerEmail = await supabase
    .from('businesses')
    .select('id')
    .ilike('owner_email', normalizedEmail)
    .maybeSingle();

  return { state: byOwnerEmail.data?.id ? 'provider' : 'consumer', user };
}

export async function createProviderDraft(): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token || !session.user) {
    return { ok: false, error: 'Please sign in to continue.' };
  }

  const res = await fetch('/api/business-create-draft', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      agree: true,
      businessName: defaultProviderNameForUser(session.user),
    }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) return { ok: false, error: data?.error || 'Could not create provider draft.' };
  return { ok: true };
}

export function isProviderIntent(value: unknown): boolean {
  return String(value || '').trim().toLowerCase() === 'provider';
}
