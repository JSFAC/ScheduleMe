// pages/auth/callback.tsx
// Single OAuth landing page — figures out where to send the user
import type { NextPage } from 'next';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const AuthCallback: NextPage = () => {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabase();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const email = session.user.email ?? '';
        const userId = session.user.id;

        const source = localStorage.getItem('auth_source');
        localStorage.removeItem('auth_source');
        localStorage.removeItem('auth_intent');

        if (source === 'business') {
          const { data: biz } = await supabase
            .from('businesses')
            .select('id')
            .eq('owner_email', email)
            .maybeSingle();

          if (biz) {
            router.replace('/business/dashboard');
          } else {
            await supabase.auth.signOut();
            await fetch('/api/cleanup-auth-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, email }),
            });
            router.replace('/business/auth/login?error=not_a_business');
          }
        } else {
          // Consumer flow — check if account was just created (within last 30 seconds)
          const accountAgeMs = Date.now() - new Date(session.user.created_at).getTime();
          const isNewUser = accountAgeMs < 30000;

          if (isNewUser) {
            router.replace('/bookings?welcome=1');
          } else {
            router.replace('/account');
          }
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

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
