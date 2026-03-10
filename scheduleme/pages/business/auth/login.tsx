// pages/business/auth/login.tsx — Business-only login
// Blocks consumer/new accounts from accessing business dashboard
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import BusinessNav from '../../../components/BusinessNav';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type Mode = 'login' | 'reset';

const BusinessLoginPage: NextPage = () => {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // On mount: if someone returned from Google OAuth,
  // check if they're a real business — if not, delete the orphaned auth account and show error
  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;

      const { data: biz } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_email', session.user.email)
        .maybeSingle();

      if (biz) {
        router.replace('/business/dashboard');
      } else {
        // Not a business — sign out AND delete the orphaned auth account
        const userId = session.user.id;
        const email = session.user.email ?? '';
        await supabase.auth.signOut();
        await fetch('/api/cleanup-auth-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, email }),
        });
        setError('not_a_business');
      }
    });
  }, [router]);

  async function handleGoogle() {
    const supabase = getSupabase();
    // We redirect back to THIS page after Google auth
    // The useEffect above will then check and reject non-business accounts
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/business/auth/login` },
    });
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setSuccess(null);
    const supabase = getSupabase();
    try {
      if (mode === 'reset') {
        // Only send reset if they actually have a business account
        const { data: biz } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_email', email)
          .maybeSingle();

        if (!biz) {
          setError('No business account found for this email.');
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/business/dashboard`,
        });
        if (error) throw error;
        setSuccess('Check your email for a reset link.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Check business account
        const { data: biz } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_email', email)
          .maybeSingle();

        if (!biz) {
          // Sign them back out — not a business account
          await supabase.auth.signOut();
          setError('No business account found for this email. If you applied, please wait for your approval email.');
          setLoading(false);
          return;
        }

        router.push('/business/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head><title>Business Login — ScheduleMe for Business</title></Head>
      <BusinessNav />
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-6 pt-20 pb-16">
        <div className="w-full max-w-sm">

          <div className="text-center mb-8">
            <div className="flex flex-col leading-none items-center mb-4">
              <span className="text-2xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>ScheduleMe</span>
              <span className="text-[10px] font-semibold tracking-widest uppercase text-accent mt-0.5">for Business</span>
            </div>
            <h1 className="text-xl font-bold text-white mb-1">
              {mode === 'reset' ? 'Reset your password' : 'Welcome back'}
            </h1>
            <p className="text-neutral-500 text-sm">
              {mode === 'reset' ? "We'll email you a reset link" : 'Sign in to your business dashboard'}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 mb-5">
                <p className="font-semibold mb-1 text-red-300">No business account found</p>
                <p className="text-red-400 leading-relaxed">
                  {error === 'not_a_business'
                    ? 'This email is not registered as a ScheduleMe business. If you applied, wait for your approval email. Otherwise choose an option below.'
                    : error}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link href="/business/signup"
                    className="flex items-center justify-center px-3 py-2 rounded-lg bg-accent/20 border border-accent/30 text-accent text-xs font-semibold hover:bg-accent/30 transition-colors text-center">
                    Apply as a Business
                  </Link>
                  <Link href="/signin"
                    className="flex items-center justify-center px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-semibold hover:bg-neutral-700 transition-colors text-center">
                    Consumer Sign In
                  </Link>
                </div>
              </div>
            )}
            {success && (
              <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400 mb-5">{success}</div>
            )}

            {mode === 'reset' ? (
              <form onSubmit={handleEmail} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1.5">Business email</label>
                  <input type="email" required
                    className="form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600"
                    placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                  {loading ? 'Sending…' : 'Send Reset Email'}
                </button>
                <button type="button" onClick={() => setMode('login')}
                  className="w-full text-center text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
                  ← Back to login
                </button>
              </form>
            ) : !showEmail ? (
              <div className="space-y-3">
                <button onClick={handleGoogle}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 transition-colors text-sm font-semibold text-white">
                  <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>
                <p className="text-xs text-neutral-600 text-center -mt-1">For approved businesses only</p>

                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-px bg-neutral-800" />
                  <span className="text-xs text-neutral-600">or</span>
                  <div className="flex-1 h-px bg-neutral-800" />
                </div>

                <button onClick={() => setShowEmail(true)}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 transition-colors text-sm font-semibold text-white">
                  <svg className="h-5 w-5 flex-shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  Continue with Email
                </button>

                <p className="text-center text-xs text-neutral-600 pt-1">
                  New business?{' '}
                  <Link href="/business/signup" className="text-accent hover:underline">Apply to join →</Link>
                </p>
              </div>
            ) : (
              <form onSubmit={handleEmail} className="space-y-4">
                <button type="button" onClick={() => setShowEmail(false)}
                  className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 mb-2 transition-colors">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  Back
                </button>
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1.5">Business email</label>
                  <input type="email" required
                    className="form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600"
                    placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1.5">Password</label>
                  <input type="password" required
                    className="form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600"
                    placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                  {loading ? 'Please wait…' : 'Log In'}
                </button>
                <button type="button" onClick={() => { setMode('reset'); setShowEmail(false); }}
                  className="w-full text-center text-xs text-neutral-600 hover:text-neutral-400 transition-colors">
                  Forgot password?
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-xs text-neutral-600 mt-5">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="hover:text-neutral-400">Terms</Link> and{' '}
            <Link href="/privacy" className="hover:text-neutral-400">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </>
  );
};

export default BusinessLoginPage;
