import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import BusinessNav from '../../../components/BusinessNav';
import { getSupabaseClient } from '../../../lib/supabaseClient';

const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 128;

function getBrowserSupabase() {
  if (typeof window === 'undefined') return null;
  return getSupabaseClient();
}

const SetProviderPasswordPage: NextPage = () => {
  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseClient> | null>(null);
  const router = useRouter();
  const [bootState, setBootState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bootError, setBootError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setSupabase(getBrowserSupabase());
  }, []);

  async function findBusinessForSession(session: any) {
    if (!supabase) return null;
    const normalizedEmail = String(session?.user?.email || '').toLowerCase().trim();
    const byOwnerId = await supabase
      .from('businesses')
      .select('id, owner_id')
      .eq('owner_id', session.user.id)
      .maybeSingle();
    if (byOwnerId.data) return byOwnerId.data;

    if (!normalizedEmail) return null;
    const byOwnerEmail = await supabase
      .from('businesses')
      .select('id, owner_id')
      .ilike('owner_email', normalizedEmail)
      .maybeSingle();
    if (byOwnerEmail.data) {
      if (!byOwnerEmail.data.owner_id) {
        await supabase
          .from('businesses')
          .update({ owner_id: session.user.id })
          .eq('id', byOwnerEmail.data.id);
      }
      return { ...byOwnerEmail.data, owner_id: session.user.id };
    }
    return null;
  }

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    (async () => {
      try {
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          const { error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionErr) throw sessionErr;
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          if (mounted) {
            setBootState('error');
            setBootError('This setup link is invalid or expired. Use the newest approval email link.');
          }
          return;
        }

        const business = await findBusinessForSession(data.session);
        if (!business) {
          await supabase.auth.signOut();
          if (mounted) {
            setBootState('error');
            setBootError('No provider account was found for this sign-in. Please use the email sent after approval.');
          }
          return;
        }

        if (mounted) setBootState('ready');
      } catch (e: any) {
        if (mounted) {
          setBootState('error');
          setBootError(e?.message || 'Unable to verify setup link. Please request a new one.');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (!supabase) {
      setError('Password setup is not ready yet. Please try again in a moment.');
      return;
    }

    if (password.length < MIN_PASSWORD_LEN || password.length > MAX_PASSWORD_LEN) {
      setError(`Password must be between ${MIN_PASSWORD_LEN} and ${MAX_PASSWORD_LEN} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;
      setDone(true);
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        router.replace('/business/dashboard?onboard=stripe');
      }, 600);
    } catch (e: any) {
      setError(e?.message || 'Could not set password. Please retry from your approval email.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Create Provider Password — ScheduleMe</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <BusinessNav />
      <main className="min-h-screen bg-neutral-950 pt-24 pb-16 px-6">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-7">
            <h1 className="text-2xl font-black text-white" style={{ letterSpacing: '-0.02em' }}>
              Create your password
            </h1>
            <p className="text-sm text-neutral-400 mt-2 mb-6">
              Set your provider password once, then continue to Stripe onboarding.
            </p>

            {bootState === 'loading' && (
              <p className="text-sm text-neutral-400">Verifying secure link…</p>
            )}

            {bootState === 'error' && (
              <div className="space-y-4">
                <p className="text-sm text-red-400">{bootError}</p>
                <Link href="/business/auth/login" className="text-sm font-semibold text-accent hover:opacity-80">
                  Back to provider login
                </Link>
              </div>
            )}

            {bootState === 'ready' && !done && (
              <form onSubmit={onSubmit} className="space-y-4">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">New password</span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3.5 py-2.5 text-sm text-white outline-none focus:border-accent"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Confirm password</span>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3.5 py-2.5 text-sm text-white outline-none focus:border-accent"
                    placeholder="Repeat password"
                    autoComplete="new-password"
                  />
                </label>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  style={{ background: '#007e6d' }}
                >
                  {submitting ? 'Saving…' : 'Set password & continue'}
                </button>
              </form>
            )}

            {done && (
              <p className="text-sm text-emerald-400">Password set. Redirecting to your provider dashboard…</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
};

export default SetProviderPasswordPage;
