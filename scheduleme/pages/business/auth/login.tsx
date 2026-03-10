// pages/business/auth/login.tsx — Business-only login with consumer redirect popup
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

const BusinessLogin: NextPage = () => {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [consumerPopup, setConsumerPopup] = useState(false);

  // Check if logged-in user is a consumer (not a business) and show redirect popup
  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      // Check if this user has a business record
      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_email', session.user.email)
        .single();
      if (!business) {
        // Logged in but no business account — show consumer redirect popup
        setConsumerPopup(true);
      } else {
        router.push('/business/dashboard');
      }
    });
  }, [router]);

  async function handleGoogle() {
    const supabase = getSupabase();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/business/dashboard` },
    });
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setSuccess(null);
    const supabase = getSupabase();
    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/business/auth/reset`,
        });
        if (error) throw error;
        setSuccess('Check your email for a password reset link.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Check if they have a business account
        const { data: business } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_email', email)
          .single();
        if (!business) {
          setConsumerPopup(true);
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

      {/* Consumer redirect popup */}
      {consumerPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/70 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="h-14 w-14 rounded-full bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center mx-auto mb-4">
              <svg className="h-7 w-7 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Consumer account detected</h2>
            <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
              This login is for service businesses. Your account appears to be a consumer account. Would you like to go to the consumer site instead?
            </p>
            <div className="flex flex-col gap-3">
              <a href="/account" className="btn-primary w-full justify-center">
                Go to Consumer Account →
              </a>
              <button onClick={() => { setConsumerPopup(false); getSupabase().auth.signOut(); }}
                className="w-full text-sm text-neutral-500 hover:text-neutral-300 transition-colors py-2">
                Sign out and try a different account
              </button>
            </div>
          </div>
        </div>
      )}

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
              {mode === 'reset' ? "We'll email you a reset link" : 'Log in to your business dashboard'}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
            {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 mb-5">{error}</div>}
            {success && <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400 mb-5">{success}</div>}

            {mode === 'reset' ? (
              <form onSubmit={handleEmail} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1.5">Email</label>
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
                <button onClick={() => setShowEmail(true)}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 transition-colors text-sm font-semibold text-white">
                  <svg className="h-5 w-5 flex-shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  Continue with Email
                </button>
                <p className="text-center text-xs text-neutral-600 pt-2">
                  No account?{' '}
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
                  <label className="block text-sm font-medium text-neutral-400 mb-1.5">Email</label>
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
            Looking for the consumer site?{' '}
            <a href="/signin" className="hover:text-neutral-400 text-accent">Sign in here →</a>
          </p>
        </div>
      </div>
    </>
  );
};

export default BusinessLogin;
