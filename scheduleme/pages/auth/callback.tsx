// pages/auth/callback.tsx
// Single OAuth landing page — figures out where to send the user
import type { NextPage } from 'next';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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

function getStoredProviderIntent() {
  if (typeof window === 'undefined') return false;
  return (
    localStorage.getItem('auth_source') === 'business' ||
    localStorage.getItem('auth_intent') === 'provider' ||
    sessionStorage.getItem('sm_provider_oauth_pending') === 'true'
  );
}

function clearStoredIntent() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_source');
  localStorage.removeItem('auth_intent');
  sessionStorage.removeItem('sm_provider_oauth_pending');
}

const AuthCallback: NextPage = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [providerFlow, setProviderFlow] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    const supabase = getSupabase();
    let active = true;
    let handled = false;
    const pendingProviderFlow =
      (typeof router.query.source === 'string' && router.query.source === 'provider_signup') ||
      getStoredProviderIntent();
    setProviderFlow(pendingProviderFlow);

    const failSafeId = window.setTimeout(() => {
      if (!handled && active) {
        setError('We could not finish sign-in automatically. Please continue from provider setup.');
      }
    }, 12000);

    async function ensureSessionFromHash() {
      if (typeof window === 'undefined') return;
      const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
      if (!rawHash) return;
      const hashParams = new URLSearchParams(rawHash);
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (!accessToken || !refreshToken) return;
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) throw sessionError;
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    }

    async function finalizeSession(session: any) {
      if (!active || handled || !session?.user) return;
      handled = true;

      try {
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
        const source = typeof window !== 'undefined' ? localStorage.getItem('auth_source') : '';
        const isProviderSignup =
          querySource === 'provider_signup' ||
          metadataIntent === 'provider' ||
          source === 'business' ||
          getStoredProviderIntent();

        setProviderFlow(isProviderSignup);

        if (isProviderSignup) {
          let nextRole = 'business';
          try {
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', userId)
              .maybeSingle();
            nextRole = existingProfile?.role === 'admin' ? 'admin' : 'business';
          } catch {}

          try {
            await supabase.from('profiles').upsert({
              id: userId,
              email,
              name,
              role: nextRole,
              has_seen_welcome: true,
            }, { onConflict: 'id', ignoreDuplicates: false });
          } catch {}

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
          if (!draftRes.ok && draftRes.status !== 409) {
            throw new Error(draftData?.error || 'Could not finish provider setup.');
          }

          clearStoredIntent();
          router.replace('/provider/dashboard');
          return;
        }

        try {
          await supabase.from('profiles').upsert({
            id: userId,
            email,
            name,
            has_seen_welcome: false,
          }, { onConflict: 'id', ignoreDuplicates: true });
        } catch {}

        const adminNext = typeof window !== 'undefined' ? sessionStorage.getItem('sm_admin_next') : null;
        const allowAdminRedirect = adminNext === '/admin' && hasValidAdminCodeSession();

        let isNewUser = true;
        try {
          const { data: userRow } = await supabase
            .from('profiles')
            .select('has_seen_welcome')
            .eq('id', userId)
            .maybeSingle();
          isNewUser = !userRow || userRow.has_seen_welcome === false;
        } catch {}

        clearStoredIntent();

        if (adminNext && allowAdminRedirect) {
          if (typeof window !== 'undefined') sessionStorage.removeItem('sm_admin_next');
          router.replace(adminNext);
          return;
        }
        if (adminNext && typeof window !== 'undefined') {
          sessionStorage.removeItem('sm_admin_next');
        }

        if (isNewUser) {
          router.replace('/home');
          return;
        }

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('edu_verified')
            .eq('id', userId)
            .maybeSingle();
          if (profile?.edu_verified) {
            router.replace('/campus');
            return;
          }
        } catch {}

        router.replace('/home');
      } catch (err) {
        handled = false;
        clearStoredIntent();
        setError(err instanceof Error ? err.message : 'We could not finish sign-in.');
      }
    }

    async function boot() {
      try {
        await ensureSessionFromHash();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await finalizeSession(session);
          return;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'We could not finish sign-in.');
      }
    }

    boot();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session) {
        await finalizeSession(session);
      }
    });

    return () => {
      active = false;
      window.clearTimeout(failSafeId);
      subscription.unsubscribe();
    };
  }, [router, router.isReady, router.query.source]);

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zm8.25-3.75a8.25 8.25 0 11-16.5 0 8.25 8.25 0 0116.5 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">We hit a snag finishing sign-in</h1>
          <p className="text-sm leading-relaxed text-neutral-400 mb-6">{error}</p>
          <div className="flex flex-col gap-3">
            <Link
              href={providerFlow ? '/provider/signup' : '/signin'}
              className="btn-primary w-full py-3 text-sm font-semibold"
            >
              {providerFlow ? 'Back to provider setup' : 'Back to sign in'}
            </Link>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full rounded-xl border border-neutral-700 px-4 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:bg-neutral-800"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

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
