// pages/auth/callback.tsx
// Single OAuth landing page — figures out where to send the user
import type { NextPage } from 'next';
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

const AuthCallback: NextPage = () => {
  const router = useRouter();
  const [authSource, setAuthSource] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setAuthSource(localStorage.getItem('auth_source') || '');
  }, []);

  useEffect(() => {
    const supabase = getSupabase();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const email = session.user.email ?? '';
        const userId = session.user.id;
        const firstName = String(session.user.user_metadata?.first_name || '').trim();
        const lastName = String(session.user.user_metadata?.last_name || '').trim();
        const fallbackFromParts = `${firstName} ${lastName}`.trim();
        const name =
          String(session.user.user_metadata?.full_name || '').trim() ||
          String(session.user.user_metadata?.name || '').trim() ||
          fallbackFromParts;

        const source = localStorage.getItem('auth_source');
        localStorage.removeItem('auth_source');
        localStorage.removeItem('auth_intent');

        if (source === 'business') {
          // Check businesses table for this email
          const { data: biz } = await supabase
            .from('businesses')
            .select('id')
            .eq('owner_email', email)
            .maybeSingle();

          if (biz) {
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', userId)
              .maybeSingle();
            const nextRole = existingProfile?.role === 'admin' ? 'admin' : 'business';
            // Mark as business role in profiles
            await supabase.from('profiles').upsert({
              id: userId, email, name, role: nextRole, has_seen_welcome: true,
            }, { onConflict: 'id', ignoreDuplicates: false });
            router.replace('/business/dashboard');
          } else {
            // Not a registered business — sign out but DO NOT delete their account
            // Route to provider signup so they can agree to terms + complete onboarding.
            await supabase.auth.signOut();
            router.replace(`/business/signup?from=oauth-login&email=${encodeURIComponent(email || '')}`);
          }
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
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="flex flex-col items-center text-center">
        <div className="mb-3 leading-none">
          <p className="text-4xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>ScheduleMe</p>
          <p className="text-[12px] font-semibold tracking-[0.14em] uppercase text-accent mt-1">
            {authSource === 'business' ? 'for providers' : 'secure sign in'}
          </p>
        </div>
        <div className="relative h-8 w-8 mt-1">
          <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
