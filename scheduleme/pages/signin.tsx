// @ts-nocheck
// pages/signin.tsx — Consumer sign in / sign up
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect, useRef } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';
import Nav from '../components/Nav';
import { safeRedirect } from '../lib/safeRedirect';

function getSupabase() {
  return getSupabaseClient();
}

const SignIn: NextPage = () => {
  const router = useRouter();
  const { next, admin } = router.query;
  const [tab, setTab] = useState<'login' | 'signup'>('login');

  // Default to signup tab if ?mode=signup is in the URL
  useEffect(() => {
    if (router.query.mode === 'signup') setTab('signup');
  }, [router.query.mode]);
  const [showEmail, setShowEmail] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [tabVisible, setTabVisible] = useState(true);
  const [businessRedirecting, setBusinessRedirecting] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaWidgetId, setCaptchaWidgetId] = useState<number | null>(null);
  const [captchaLoadError, setCaptchaLoadError] = useState<string | null>(null);
  const captchaRef = useRef<HTMLDivElement | null>(null);
  const captchaReadyRef = useRef(false);
  const isDark = false;
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;
  const captchaRequired = !!siteKey && (tab === 'signup' || failedCount >= 3);
  const captchaBlocked = !!captchaLoadError;
  const emailRedirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/verified?source=email_signup`
      : undefined;

  useEffect(() => {
    if (!siteKey || !captchaRequired) return;

    let cancelled = false;
    let pollId: number | null = null;
    let failId: number | null = null;

    const renderCaptcha = (): boolean => {
      if (cancelled) return false;
      const hcaptcha = (window as any).hcaptcha;
      if (!hcaptcha || !captchaRef.current || captchaWidgetId !== null) return false;
      try {
        const id = hcaptcha.render(captchaRef.current, {
          sitekey: siteKey,
          theme: isDark ? 'dark' : 'light',
          size: 'normal',
          callback: (token: string) => {
            setCaptchaLoadError(null);
            setCaptchaToken(token);
          },
          'expired-callback': () => setCaptchaToken(''),
          'error-callback': () => {
            setCaptchaToken('');
            setCaptchaLoadError('Captcha failed to load. Disable blockers/shields and refresh.');
          },
        });
        setCaptchaWidgetId(id);
        captchaReadyRef.current = true;
        setCaptchaLoadError(null);
        return true;
      } catch {
        setCaptchaLoadError('Captcha failed to load. Disable blockers/shields and refresh.');
        return false;
      }
    };

    const startRenderFlow = () => {
      if (renderCaptcha()) return;

      pollId = window.setInterval(() => {
        if (renderCaptcha() && pollId) {
          window.clearInterval(pollId);
          pollId = null;
        }
      }, 250);

      failId = window.setTimeout(() => {
        if (!captchaReadyRef.current && captchaWidgetId === null) {
          setCaptchaLoadError('Captcha did not appear. Disable blockers/shields, then refresh.');
        }
        if (pollId) {
          window.clearInterval(pollId);
          pollId = null;
        }
      }, 7000);
    };

    if ((window as any).hcaptcha) {
      startRenderFlow();
    } else {
      const script = document.createElement('script');
      script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = startRenderFlow;
      script.onerror = () => setCaptchaLoadError('Captcha script was blocked. Disable blockers/shields and refresh.');
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (pollId) window.clearInterval(pollId);
      if (failId) window.clearTimeout(failId);
    };
  }, [siteKey, captchaRequired, captchaWidgetId]);

  async function handleGoogle() {
    const supabase = getSupabase();
    localStorage.setItem('auth_source', 'consumer');
    const isAdminSignin = admin === '1' || next === '/admin';
    if (isAdminSignin && typeof window !== 'undefined') {
      localStorage.setItem('sm_admin_next', '/admin');
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: 'select_account' } },
    });
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const supabase = getSupabase();
    try {
      const loginNeedsCaptcha = tab === 'login' && captchaRequired;
      const signupNeedsCaptcha = tab === 'signup' && captchaRequired && !captchaBlocked;
      if ((loginNeedsCaptcha || signupNeedsCaptcha) && !captchaToken) {
        setError('Please complete the captcha.');
        setLoading(false);
        return;
      }
      if (showReset) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
        if (error) throw error;
        setSent(true);
      } else if (tab === 'signup') {
        if (!firstName.trim() || !lastName.trim()) {
          throw new Error('Please enter your first and last name.');
        }
        if (password.length < 10) {
          throw new Error('Password must be at least 10 characters.');
        }
        const response = await fetch('/api/auth/email-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            firstName: firstName.trim().slice(0, 40),
            lastName: lastName.trim().slice(0, 40),
            captchaToken: captchaToken || undefined,
            redirectTo: emailRedirectTo,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || 'Could not create account.');
        setSent(true);
      } else {
        const signInPayload: any = { email, password };
        if (captchaToken) {
          signInPayload.options = { captchaToken };
        }
        const { error } = await supabase.auth.signInWithPassword(signInPayload);
        if (error) {
          if (error.message.toLowerCase().includes('captcha')) {
            setFailedCount(c => Math.max(c + 1, 3));
            throw new Error('Please complete the captcha and try again.');
          }
          if (error.message.toLowerCase().includes('invalid') || error.message.toLowerCase().includes('credentials')) {
            throw new Error('This email is linked to a Google account. Please use "Continue with Google" to sign in.');
          }
          throw error;
        }
        setFailedCount(0);
        const isAdminSignin = admin === '1' || next === '/admin';
        const nextTarget = typeof next === 'string' ? next : '';
        const redirectTarget = safeRedirect(nextTarget || (isAdminSignin ? '/admin' : '/home'), isAdminSignin ? '/admin' : '/home');
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('edu_verified')
            .eq('id', session.user.id)
            .maybeSingle();
          if (profile?.edu_verified && redirectTarget === '/home') {
            router.push('/campus');
            return;
          }
        }
        router.push(redirectTarget);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setFailedCount(c => c + 1);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendCooldown]);

  async function handleResendConfirmation() {
    if (!email || resendBusy || resendCooldown > 0) return;
    setResendBusy(true);
    setResendMsg(null);
    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          redirectTo: emailRedirectTo,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Could not resend confirmation email.');
      setResendMsg(`Confirmation email resent to ${email}.`);
      setResendCooldown(30);
    } catch (err) {
      setResendMsg(err instanceof Error ? err.message : 'Could not resend confirmation email.');
    } finally {
      setResendBusy(false);
    }
  }

  useEffect(() => {
    if (!sent || showReset) return;
    let cancelled = false;
    const supabase = getSupabase();

    const continueToVerified = async (session: any) => {
      if (cancelled || !session) return;
      await router.replace('/auth/verified?source=email_wait');
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) continueToVerified(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) continueToVerified(session);
    });

    const pollId = window.setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) continueToVerified(session);
    }, 3000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearInterval(pollId);
    };
  }, [sent, showReset, router]);

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
            <p className="text-neutral-500 mb-6">
              {showReset
                ? <>We sent a password reset link to <strong>{email}</strong>.</>
                : <>We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</>}
            </p>
            {!showReset && (
              <p className="text-xs text-neutral-400 mb-5">
                Once verified, this page will continue automatically.
              </p>
            )}
            {!showReset && (
              <div className="space-y-2 mb-4">
                <button
                  onClick={handleResendConfirmation}
                  disabled={resendBusy || resendCooldown > 0}
                  className="text-accent text-sm hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {resendBusy
                    ? 'Resending…'
                    : resendCooldown > 0
                      ? `Resend available in ${resendCooldown}s`
                      : 'Resend confirmation email'}
                </button>
                {resendMsg && (
                  <p className="text-xs text-neutral-500">{resendMsg}</p>
                )}
              </div>
            )}
            <button onClick={() => { setSent(false); setShowReset(false); }} className="text-accent text-sm hover:underline">
              Use a different email
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{tab === 'login' ? 'Log In' : 'Sign Up'} — ScheduleMe</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Nav />
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6 pt-20 pb-16">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-neutral-900 mb-1">Welcome to ScheduleMe</h1>
            <p className="text-neutral-500 text-sm">Sign in to track your bookings and requests</p>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 p-8 shadow-card">
            {/* Tab switcher — always visible */}
            <div className="flex rounded-xl bg-neutral-100 p-1 gap-1 mb-6">
              {(['login', 'signup'] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => {
                  setTabVisible(false);
                  setTimeout(() => { setTab(t); setShowEmail(false); setShowReset(false); setError(null); setTabVisible(true); }, 220);
                }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${tab === t ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}>
                  {t === 'login' ? 'Log In' : 'Sign Up'}
                </button>
              ))}
            </div>

            <div style={{ opacity: tabVisible ? 1 : 0, transform: tabVisible ? 'translateY(0)' : 'translateY(4px)', transition: 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 mb-5">{error}</div>
            )}

            {!showEmail ? (
              <div className="space-y-3">
                <button onClick={handleGoogle}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors text-sm font-semibold text-neutral-700">
                  <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {tab === 'login' ? 'Continue with Google' : 'Sign up with Google'}
                </button>

                <button onClick={() => setShowEmail(true)}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors text-sm font-semibold text-neutral-700">
                  <svg className="h-5 w-5 flex-shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  {tab === 'login' ? 'Continue with Email' : 'Sign up with Email'}
                </button>

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-100" /></div>
                  <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-neutral-400">or</span></div>
                </div>

                <div className="text-center">
                  <Link href={(next as string) || '/bookings'} className="text-sm text-accent hover:underline font-medium">
                    Continue as guest →
                  </Link>
                  <p className="text-xs text-neutral-400 mt-1">No account needed to find a pro</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleEmail} className="space-y-4">
                <button type="button" onClick={() => { setShowEmail(false); setShowReset(false); setError(null); }}
                  className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 mb-2 transition-colors">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  Back
                </button>

                {showReset ? (
                  <>
                    <p className="text-sm text-neutral-600 mb-1">Enter your email and we'll send a reset link.</p>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email</label>
                      <input type="email" required className="form-input" placeholder="you@example.com"
                        value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                      {loading ? 'Sending…' : 'Send Reset Email'}
                    </button>
                    <button type="button" onClick={() => setShowReset(false)}
                      className="w-full text-center text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
                      ← Back to log in
                    </button>
                  </>
                ) : (
                  <>
                    {tab === 'signup' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-1.5">First name</label>
                          <input type="text" required className="form-input" placeholder="First name"
                            value={firstName} onChange={e => setFirstName(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Last name</label>
                          <input type="text" required className="form-input" placeholder="Last name"
                            value={lastName} onChange={e => setLastName(e.target.value)} />
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email</label>
                      <input type="email" required className="form-input" placeholder="you@example.com"
                        value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">Password</label>
                      <input type="password" required className="form-input" placeholder="••••••••"
                        value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    {captchaRequired && (
                      <div className="pt-1 flex flex-col items-start w-full">
                        <div ref={captchaRef} className="hcaptcha-shell w-full" style={{ minHeight: 78 }} />
                        {!captchaWidgetId && !captchaLoadError && <p className="mt-2 text-xs text-neutral-500">Captcha loading… If it doesn’t appear, disable ad blockers and refresh.</p>}
                        {captchaLoadError && <p className="mt-2 text-xs text-red-500">{captchaLoadError}</p>}
                        {captchaLoadError && (
                          <p className="mt-1 text-xs text-neutral-500">
                            You can still continue signup below while captcha is unavailable.
                          </p>
                        )}
                      </div>
                    )}
                    <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                      {loading ? 'Please wait…' : tab === 'login' ? 'Log In' : 'Create Account'}
                    </button>
                    {tab === 'login' && (
                      <div className="text-center">
                        <button type="button" onClick={() => setShowReset(true)}
                          className="text-xs text-neutral-400 hover:text-accent transition-colors">
                          Forgot password?
                        </button>
                      </div>
                    )}
                  </>
                )}
              </form>
            )}
          </div>
            </div>

          <p className="text-center text-xs text-neutral-400 mt-5">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="hover:underline">Terms</Link> and{' '}
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>.
          </p>
          <p className="text-center mt-4">
            {businessRedirecting ? (
              <span className="inline-flex items-center gap-2 text-xs text-neutral-500">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-accent" />
                </span>
                Loading provider portal…
              </span>
            ) : (
              <button
                onClick={() => {
                  setBusinessRedirecting(true);
                  setTimeout(() => { window.location.href = '/business/auth/login'; }, 1200);
                }}
                className="text-xs text-neutral-500 hover:text-accent transition-colors">
                Are you a provider? Log in here →
              </button>
            )}
          </p>
        </div>
      </div>
    </>
  );
};

export default SignIn;
