// pages/signin.tsx — Consumer sign in / guest continue
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Nav from '../components/Nav';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const SignIn: NextPage = () => {
  const router = useRouter();
  const { next = '/bookings' } = router.query;
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleGoogle() {
    const supabase = getSupabase();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/bookings?welcome=1` },
    });
  }


  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const supabase = getSupabase();
    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
        if (error) throw error;
        setSent(true);
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // Detect Google-linked account trying to sign in with email
          if (error.message.toLowerCase().includes('invalid') || error.message.toLowerCase().includes('credentials')) {
            // Check if this email exists as a Google OAuth user
            const msg = `This email is linked to a Google account. Please use "Continue with Google" to sign in.`;
            throw new Error(msg);
          }
          throw error;
        }
        router.push('/bookings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <>
        <Nav />
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6 pt-20">
          <div className="text-center max-w-sm">
            <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-5">
              <svg className="h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">Check your email</h1>
            <p className="text-neutral-500 mb-6">We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</p>
            <button onClick={() => setSent(false)} className="text-accent text-sm hover:underline">Use a different email</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Sign In — ScheduleMe</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Nav />
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6 pt-20 pb-16">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-neutral-900 mb-1">Welcome to ScheduleMe</h1>
            <p className="text-neutral-500 text-sm">Sign in to track your bookings and requests</p>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 p-8 shadow-card">
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 mb-5">{error}</div>
            )}

            {!showEmail ? (
              <div className="space-y-3">
                {/* Google */}
                <button onClick={handleGoogle}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors text-sm font-semibold text-neutral-700">
                  <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>

                {/* Email */}
                <button onClick={() => setShowEmail(true)}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors text-sm font-semibold text-neutral-700">
                  <svg className="h-5 w-5 flex-shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  Continue with Email
                </button>

                {/* Divider */}
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-100" /></div>
                  <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-neutral-400">or</span></div>
                </div>

                {/* Guest */}
                <div className="text-center">
                  <Link href={next as string} className="text-sm text-accent hover:underline font-medium">
                    Continue as guest →
                  </Link>
                  <p className="text-xs text-neutral-400 mt-1">No account needed to find a pro</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleEmail} className="space-y-4">
                <button type="button" onClick={() => setShowEmail(false)}
                  className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 mb-2 transition-colors">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  Back
                </button>

                {/* Login / Signup toggle */}
                <div className="flex rounded-xl bg-neutral-100 p-1 gap-1 mb-2">
                  {(['login', 'signup'] as const).map(m => (
                    <button key={m} type="button" onClick={() => setMode(m)}
                      className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === m ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}>
                      {m === 'login' ? 'Log In' : 'Sign Up'}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email</label>
                  <input type="email" required className="form-input" placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                {mode !== 'reset' && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">Password</label>
                    <input type="password" required className="form-input" placeholder="••••••••"
                      value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                  {loading ? 'Please wait…' : mode === 'reset' ? 'Send Reset Email' : mode === 'login' ? 'Log In' : 'Create Account'}
                </button>
                {mode === 'login' && (
                  <div className="text-center">
                    <button type="button" onClick={() => setMode('reset')}
                      className="text-xs text-neutral-400 hover:text-accent transition-colors">
                      Forgot password?
                    </button>
                  </div>
                )}
                {mode === 'reset' && (
                  <button type="button" onClick={() => setMode('login')}
                    className="w-full text-center text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
                    ← Back to log in
                  </button>
                )}
              </form>
            )}
          </div>

          <p className="text-center text-xs text-neutral-400 mt-5">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="hover:underline">Terms</Link> and{' '}
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>.
          </p>

          <p className="text-center mt-4">
            <Link href="/auth/login" className="text-xs text-neutral-500 hover:text-neutral-700">
              Are you a business? Log in here →
            </Link>
          </p>
        </div>
      </div>
    </>
  );
};

export default SignIn;
