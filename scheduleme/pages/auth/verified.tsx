import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabaseClient';

function getSupabase() {
  return getSupabaseClient();
}

function deriveNameFromMetadata(user: any): string {
  const first = String(user?.user_metadata?.first_name || '').trim();
  const last = String(user?.user_metadata?.last_name || '').trim();
  const fromParts = `${first} ${last}`.trim();
  return (
    String(user?.user_metadata?.full_name || '').trim() ||
    String(user?.user_metadata?.name || '').trim() ||
    fromParts
  );
}

const VerifiedPage: NextPage = () => {
  const router = useRouter();
  const [phase, setPhase] = useState<'verifying' | 'verified' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your email...');
  const handledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();

    const completeAndRedirect = async (session: any) => {
      if (cancelled || handledRef.current || !session?.user) return;
      handledRef.current = true;

      try {
        const email = session.user.email ?? '';
        const userId = session.user.id;
        const name = deriveNameFromMetadata(session.user);

        const source = localStorage.getItem('auth_source');
        localStorage.removeItem('auth_source');
        localStorage.removeItem('auth_intent');

        let target = '/home';

        if (source === 'business') {
          const { data: biz } = await supabase
            .from('businesses')
            .select('id')
            .eq('owner_email', email)
            .maybeSingle();

          if (biz) {
            await supabase.from('profiles').upsert({
              id: userId,
              email,
              name,
              role: 'business',
              has_seen_welcome: true,
            }, { onConflict: 'id', ignoreDuplicates: false });
            target = '/business/dashboard';
          } else {
            await supabase.auth.signOut();
            target = '/business/auth/login?error=not_a_business';
          }
        } else {
          await supabase.from('profiles').upsert({
            id: userId,
            email,
            name,
            has_seen_welcome: false,
          }, { onConflict: 'id', ignoreDuplicates: true });

          const adminNext = sessionStorage.getItem('sm_admin_next');
          if (adminNext) {
            sessionStorage.removeItem('sm_admin_next');
            target = adminNext;
          } else {
            const { data: userRow } = await supabase
              .from('profiles')
              .select('has_seen_welcome, edu_verified')
              .eq('id', userId)
              .maybeSingle();

            const isNewUser = !userRow || userRow.has_seen_welcome === false;
            if (isNewUser) target = '/bookings';
            else target = userRow?.edu_verified ? '/campus' : '/home';
          }
        }

        setPhase('verified');
        setMessage('Email verified. Taking you to ScheduleMe...');
        window.setTimeout(() => {
          if (!cancelled) router.replace(target);
        }, 1300);
      } catch (err) {
        console.error('[auth/verified] finalize failed', err);
        setPhase('error');
        setMessage('Verification completed, but we could not finish sign-in setup.');
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) completeAndRedirect(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session) {
        completeAndRedirect(session);
      }
    });

    const timeoutId = window.setTimeout(() => {
      if (!handledRef.current && !cancelled) {
        setPhase('error');
        setMessage('Verification link is expired or incomplete. Please request a new one.');
      }
    }, 12000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(timeoutId);
    };
  }, [router]);

  return (
    <>
      <Head>
        <title>Email Verification — ScheduleMe</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-6 relative h-24 w-24">
            <div className="absolute inset-0 rounded-full bg-accent/15 animate-pulse" />
            <div className="absolute inset-2 rounded-full border border-accent/30" />
            {phase === 'verified' ? (
              <div className="absolute inset-0 flex items-center justify-center text-accent">
                <svg className="h-11 w-11 animate-fade-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-10 w-10 rounded-full border-2 border-accent/25 border-t-accent animate-spin" />
              </div>
            )}
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">
            {phase === 'verified' ? 'Email verified' : phase === 'error' ? 'Verification issue' : 'Confirming your account'}
          </h1>
          <p className="text-sm text-neutral-400">{message}</p>

          {phase === 'error' && (
            <div className="mt-6 flex flex-col gap-2">
              <Link href="/signin?mode=signup" className="btn-primary w-full py-3">
                Request new verification email
              </Link>
              <Link href="/signin" className="text-xs text-neutral-400 hover:text-neutral-200">
                Back to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default VerifiedPage;

