// pages/auth/login.tsx — Business login via Supabase Auth
import type { NextPage } from 'next';
import Head from 'next/head';
import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import BusinessNav from '../../components/BusinessNav';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

type Mode = 'login' | 'signup' | 'reset';

const LoginPage: NextPage = () => {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setSuccess(null);
    const supabase = getSupabase();
    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
        if (error) throw error;
        setSuccess('Check your email for a password reset link.');
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess('Check your email to confirm your account, then log in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head><title>{mode === 'login' ? 'Log In' : mode === 'signup' ? 'Create Account' : 'Reset Password'} — ScheduleMe</title></Head>
      <BusinessNav />
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-6 pt-20">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">
              {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset password'}
            </h1>
            <p className="text-neutral-500 text-sm">
              {mode === 'login' ? 'Log in to your business dashboard' : mode === 'signup' ? 'Start getting leads today' : "We'll email you a reset link"}
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
            {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 mb-5">{error}</div>}
            {success && <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400 mb-5">{success}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1.5">Email</label>
                <input type="email" required autoComplete="email"
                  className="form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600"
                  placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              {mode !== 'reset' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1.5">Password</label>
                  <input type="password" required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600"
                    placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
                {loading ? 'Please wait…' : mode === 'login' ? 'Log In' : mode === 'signup' ? 'Create Account' : 'Send Reset Email'}
              </button>
            </form>
            <div className="mt-6 space-y-3 text-center text-sm">
              {mode === 'login' && (
                <>
                  <button onClick={() => setMode('reset')} className="text-neutral-500 hover:text-neutral-300 transition-colors block w-full">Forgot your password?</button>
                  <p className="text-neutral-600">No account?{' '}<button onClick={() => setMode('signup')} className="text-accent hover:underline">Sign up free</button></p>
                </>
              )}
              {mode === 'signup' && (
                <p className="text-neutral-600">Already have an account?{' '}<button onClick={() => setMode('login')} className="text-accent hover:underline">Log in</button></p>
              )}
              {mode === 'reset' && (
                <button onClick={() => setMode('login')} className="text-neutral-500 hover:text-neutral-300 transition-colors">← Back to login</button>
              )}
            </div>
          </div>
          <p className="text-center mt-6">
            <Link href="/business/signup" className="text-xs text-neutral-600 hover:text-neutral-400">Want to list your business? Apply here →</Link>
          </p>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
