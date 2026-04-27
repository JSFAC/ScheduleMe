// pages/auth/callback.tsx
// Single OAuth landing page — figures out where to send the user
import type { NextPage } from 'next';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getSupabaseClient } from '../../lib/supabaseClient';

function getSupabase() {
  return getSupabaseClient();
}

function hasValidAdminCodeSession(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = sessionStorage.getItem('sm_admin_code_ok');
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.exp && Date.now() < Number(parsed.exp));
  } catch {
    return false;
  }
}

const AuthCallback: NextPage = () => {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    const supabase = getSupabase();
    let handled = false;

    async function finalizeSession(session: any) {
      if (handled || !session?.user) return;
      handled = true;
        const email = session.user.email ?? '';
        const userId = session.user.id;
        const firstName = String(session.user.user_metadata?.first_name || '').trim();
        const lastName = String(session.user.user_metadata?.last_name || '').trim();
        const fallbackFromParts = `${firstName} ${lastName}`.trim();
        const name =
          String(session.user.user_metadata?.full_name || '').trim() ||
          String(session.user.user_metadata?.name || '').trim() ||
          fallbackFromParts;

        const querySource = typeof router.query.source === 'string' ? router.query.source : '';
        const metadataIntent = String(session.user?.user_metadata?.signup_intent || '').trim().toLowerCase();
        const source = localStorage.getItem('auth_source');
        localStorage.removeItem('auth_source');
        localStorage.removeItem('auth_intent');

        const isProviderSignup =
          querySource === 'provider_signup' ||
          metadataIntent === 'provider' ||
          source === 'business';

        if (isProviderSignup) {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle();
          const nextRole = existingProfile?.role === 'admin' ? 'admin' : 'business';
          await supabase.from('profiles').upsert({
            id: userId,
            email,
            name,
            role: nextRole,
            has_seen_welcome: true,
          }, { onConflict: 'id', ignoreDuplicates: false });

          const providerBusinessName = String(
            session.user.user_metadata?.provider_business_name ||
            session.user.user_metadata?.business_name ||
            name ||
            'New Provider'
          ).trim();

          const draftRes = await fetch('/api/business-create-draft', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              businessName: providerBusinessName,
              agree: true,
            }),
          });
          const draftData = await draftRes.json().catch(() => ({}));
          if (!draftRes.ok) {
            throw new Error(draftData?.error || 'Could not finish provider setup.');
          }

          router.replace('/provider/dashboard');
          return;
        } else {
          // Consumer flow — profiles is source of truth (trigger creates row on signup)
          // Belt+suspenders: create profile if trigger didn't fire (e.g. existing auth users)
          await supabase.from('profiles').upsert({
            id: userId,
            email,
            name,
            has_seen_welcome: false,
          }, { onConflict: 'id', ignoreDuplicates: true });

          // Admin redirect override (set from /admin/login)
          const adminNext = typeof window !== 'undefined' ? sessionStorage.getItem('sm_admin_next') : null;
          const allowAdminRedirect = adminNext === '/admin' && hasValidAdminCodeSession();

          // Check if they've seen the welcome screen
          const { data: userRow } = await supabase
            .from('profiles')
            .select('has_seen_welcome')
            .eq('id', userId)
            .maybeSingle();

          const isNewUser = !userRow || userRow.has_seen_welcome === false;

          if (adminNext && allowAdminRedirect) {
            if (typeof window !== 'undefined') sessionStorage.removeItem('sm_admin_next');
            router.replace(adminNext);
            return;
          } else if (adminNext) {
            if (typeof window !== 'undefined') sessionStorage.removeItem('sm_admin_next');
          }
          if (isNewUser) {
            router.replace('/home');
          } else {
            const { data: profile } = await supabase
              .from('profiles')
              .select('edu_verified')
              .eq('id', userId)
              .maybeSingle();
            if (profile?.edu_verified) {
              router.replace('/campus');
            } else {
              router.replace('/home');
            }
          }
        }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finalizeSession(session).catch(() => {});
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session) {
        await finalizeSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, [router, router.isReady, router.query.source]);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
      </div>
    </div>
  );
};

export default AuthCallback;
