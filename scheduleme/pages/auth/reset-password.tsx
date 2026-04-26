import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Nav from '../../components/Nav';
import { getSupabaseClient } from '../../lib/supabaseClient';

const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 128;

function getBrowserSupabase() {
  if (typeof window === 'undefined') return null;
  return getSupabaseClient();
}

const ResetPasswordPage: NextPage = () => {
  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseClient> | null>(null);
  const [bootState, setBootState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bootError, setBootError] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSupabase(getBrowserSupabase());
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    (async () => {
      try {
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (accessToken && refreshToken && type === 'recovery') {
          const { error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionErr) throw sessionErr;
          if (mounted) setBootState('ready');
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (data.session) {
          if (mounted) setBootState('ready');
          return;
        }

        if (mounted) {
          setBootState('error');
          setBootError('This reset link is invalid or expired. Request a new password reset email.');
        }
      } catch (e: any) {
        if (mounted) {
          setBootState('error');
          setBootError(e?.message || 'Unable to verify reset link. Please request a new one.');
        }
      }
    })();
    return () => { mounted = false; };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (!supabase) {
      setError('Reset is not ready yet. Please try again in a moment.');
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
    } catch (e: any) {
      setError(e?.message || 'Could not reset password. Please request a new reset link.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Reset Password — ScheduleMe</title>
        <meta name="description" content="Reset your ScheduleMe account password." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Nav />
      <main className="min-h-screen pt-28 pb-16 bg-white">
        <div className="mx-auto max-w-md px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#007e6d] mb-3">Account</p>
          <h1 className="text-3xl font-black mb-3 text-neutral-900" style={{ letterSpacing: '-0.03em' }}>
            Reset password
          </h1>
          <p className="text-sm text-neutral-600 mb-7">
            Set a new password for your ScheduleMe account.
          </p>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            {bootState === 'loading' && (
              <p className="text-sm text-neutral-600">Verifying reset link…</p>
            )}

            {bootState === 'error' && (
              <div className="space-y-4">
                <p className="text-sm text-red-600">{bootError}</p>
                <Link href="/signin" className="text-sm font-semibold text-[#007e6d] hover:opacity-80">
                  Back to sign in
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
                    className="mt-1.5 w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#007e6d]"
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
                    className="mt-1.5 w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#007e6d]"
                    placeholder="Repeat your new password"
                    autoComplete="new-password"
                  />
                </label>

                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  style={{ background: '#007e6d' }}
                >
                  {submitting ? 'Updating…' : 'Update password'}
                </button>
              </form>
            )}

            {done && (
              <div className="space-y-4">
                <p className="text-sm text-emerald-700">Your password has been updated successfully.</p>
                <Link href="/signin" className="text-sm font-semibold text-[#007e6d] hover:opacity-80">
                  Continue to sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
};

export default ResetPasswordPage;
