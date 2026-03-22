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
          // Check businesses table for this email
          const { data: biz } = await supabase
            .from('businesses')
            .select('id')
            .eq('owner_email', email)
            .maybeSingle();

          if (biz) {
            // Mark as business role in profiles
            await supabase.from('profiles').upsert({
              id: userId, email, name, role: 'business', has_seen_welcome: true,
            }, { onConflict: 'id', ignoreDuplicates: false });
            router.replace('/business/dashboard');
          } else {
            // Not a registered business — sign out but DO NOT delete their account
            // They may be a consumer who accidentally hit the business login
            await supabase.auth.signOut();
            router.replace('/business/auth/login?error=not_a_business');
          }
        } else {
          // Consumer flow — profiles is source of truth (trigger creates row on signup)
          const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';

          // Belt+suspenders: create profile if trigger didn't fire (e.g. existing auth users)
          await supabase.from('profiles').upsert({
            id: userId,
            email,
            name,
            has_seen_welcome: false,
          }, { onConflict: 'id', ignoreDuplicates: true });

          // Check if they've seen the welcome screen
          const { data: userRow } = await supabase
            .from('profiles')
            .select('has_seen_welcome')
            .eq('id', userId)
            .maybeSingle();

          const isNewUser = !userRow || userRow.has_seen_welcome === false;

          if (isNewUser) {
            router.replace('/bookings');
          } else {
            router.replace('/home');
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
