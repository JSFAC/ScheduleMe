// @ts-nocheck
// pages/signin.tsx — Consumer sign in / sign up
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect, useRef } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';
import Nav from '../components/Nav';
import BusinessNav from '../components/BusinessNav';
import { isProviderIntent } from '../lib/providerClient';
import { safeRedirect } from '../lib/safeRedirect';

function getSupabase() {
  return getSupabaseClient();
}

function hasValidAdminCodeSession() {
  if (typeof window === 'undefined') return false;
  const raw = sessionStorage.getItem('sm_admin_code_ok');
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.exp && Date.now() < Number(parsed.exp));
  } catch {
    return false;
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROVIDER_COPY = {
  loginTitle: 'Welcome back',
  loginBody: 'Sign in with the same ScheduleMe account you use everywhere else, then continue provider setup.',
  signupTitle: 'Start your provider setup',
  signupBody: 'Create one ScheduleMe account, then we will turn on your provider role and send you straight into the dashboard checklist.',
};

const SignIn: NextPage = () => {
  const router = useRouter();
  const { next, admin } = router.query;
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const providerIntent = isProviderIntent(router.query.intent);

  // Default to signup tab if ?mode=signup is in the URL
  useEffect(() => {
    if (router.query.mode === 'signup') setTab('signup');
  }, [router.query.mode]);

  useEffect(() => {
    if (!router.isReady || !providerIntent) return;
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) router.replace('/provider/signup');
    });
  }, [router, router.isReady, providerIntent]);
  const [showEmail, setShowEmail] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
  const captchaRequired = !!siteKey && (tab === 'signup' || (tab === 'login' && showEmail) || failedCount >= 3);
  const captchaBlocked = !!captchaLoadError;
  const emailRedirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/verified?source=email_signup`
      : undefined;
  const emailLooksReal = !email || EMAIL_PATTERN.test(email.trim());
  const providerMode = providerIntent;
  const providerSignupMode = providerMode && tab === 'signup' && !showReset;
  const providerLoginMode = providerMode && tab === 'login' && !showReset;

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
    localStorage.setItem('auth_source', providerIntent ? 'business' : 'consumer');
    const adminIntentRequested = admin === '1' || next === '/admin';
    const isAdminSignin = adminIntentRequested && hasValidAdminCodeSession();
    if (adminIntentRequested && !isAdminSignin) {
      router.replace('/admin/login');
      return;
    }
    if (isAdminSignin && typeof window !== 'undefined') {
      sessionStorage.setItem('sm_admin_next', '/admin');
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
        if (!EMAIL_PATTERN.test(email.trim())) {
          throw new Error('Please use a real email address you can access.');
        }
        if (password.length < 10) {
          throw new Error('Password must be at least 10 characters.');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
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
            redirectTo: providerIntent
              ? `${window.location.origin}/auth/verified?source=provider_signup`
              : emailRedirectTo,
            intent: providerIntent ? 'provider' : undefined,
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
        const adminIntentRequested = admin === '1' || next === '/admin';
        const isAdminSignin = adminIntentRequested && hasValidAdminCodeSession();
        if (adminIntentRequested && !isAdminSignin) {
          router.push('/admin/login');
          return;
        }
        if (providerIntent) {
          router.push('/provider/signup');
          return;
        }
        const nextTarget = typeof next === 'string' ? next : '';
        if (isAdminSignin && typeof window !== 'undefined') {
          sessionStorage.setItem('sm_admin_next', '/admin');
        }
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
      {providerMode ? <BusinessNav /> : <Nav />}
      <div className={`min-h-screen flex items-center justify-center px-6 pt-20 pb-16 ${providerMode ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
        <div className="w-full max-w-sm animate-fade-up">
          <div className="text-center mb-8">
            {providerMode && (
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-accent mb-3">Provider Setup</p>
            )}
            <h1 className={`text-2xl font-bold mb-1 ${providerMode ? 'text-white' : 'text-neutral-900'}`}>
              {providerMode
                ? tab === 'login' ? PROVIDER_COPY.loginTitle : PROVIDER_COPY.signupTitle
                : 'Welcome to ScheduleMe'}
            </h1>
            <p className={`text-sm ${providerMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
              {providerMode
                ? tab === 'login' ? PROVIDER_COPY.loginBody : PROVIDER_COPY.signupBody
                : 'Sign in to track your bookings and requests'}
            </p>
          </div>

          <div className={`${providerMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200 shadow-card'} rounded-2xl border p-8`}>
            {/* Tab switcher — always visible */}
            <div className={`flex rounded-xl p-1 gap-1 mb-6 ${providerMode ? 'bg-neutral-950 border border-neutral-800' : 'bg-neutral-100'}`}>
              {(['login', 'signup'] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => {
                  setTabVisible(false);
                  setTimeout(() => { setTab(t); setShowEmail(false); setShowReset(false); setError(null); setConfirmPassword(''); setTabVisible(true); }, 220);
                }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    tab === t
                      ? providerMode ? 'bg-neutral-900 text-white shadow-sm' : 'bg-white text-neutral-900 shadow-sm'
                      : providerMode ? 'text-neutral-500 hover:text-neutral-200' : 'text-neutral-500'
                  }`}>
                  {t === 'login' ? 'Log In' : providerMode ? 'Create Account' : 'Sign Up'}
                </button>
              ))}
            </div>

            <div style={{ opacity: tabVisible ? 1 : 0, transform: tabVisible ? 'translateY(0)' : 'translateY(4px)', transition: 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            {error && (
              <div className={`rounded-xl px-4 py-3 text-sm mb-5 ${providerMode ? 'bg-red-500/10 border border-red-500/20 text-red-300' : 'bg-red-50 border border-red-100 text-red-700'}`}>{error}</div>
            )}

            {!showEmail ? (
              <div className="space-y-3">
                <button onClick={handleGoogle}
                  className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border transition-colors text-sm font-semibold ${
                    providerMode
                      ? 'border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-white'
                      : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'
                  }`}>
                  <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {tab === 'login' ? 'Continue with Google' : providerMode ? 'Create account with Google' : 'Sign up with Google'}
                </button>

                <button onClick={() => setShowEmail(true)}
                  className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border transition-colors text-sm font-semibold ${
                    providerMode
                      ? 'border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-white'
                      : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'
                  }`}>
                  <svg className={`h-5 w-5 flex-shrink-0 ${providerMode ? 'text-neutral-400' : 'text-neutral-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  {tab === 'login' ? 'Continue with Email' : providerMode ? 'Create account with Email' : 'Sign up with Email'}
                </button>

                {!providerMode && (
                  <>
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
                  </>
                )}
              </div>
            ) : (
              <form onSubmit={handleEmail} className="space-y-4">
                <button type="button" onClick={() => { setShowEmail(false); setShowReset(false); setError(null); }}
                  className={`flex items-center gap-1.5 text-sm mb-2 transition-colors ${providerMode ? 'text-neutral-500 hover:text-neutral-200' : 'text-neutral-500 hover:text-neutral-800'}`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  Back
                </button>

                {showReset ? (
                  <>
                    <p className={`text-sm mb-1 ${providerMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Enter your email and we&apos;ll send a reset link.</p>
                    <div>
                      <label className={`block text-sm font-medium mb-1.5 ${providerMode ? 'text-neutral-400' : 'text-neutral-700'}`}>Email</label>
                      <input type="email" required className={`form-input ${providerMode ? 'bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600' : ''}`} placeholder="you@example.com"
                        value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                      {loading ? 'Sending…' : 'Send Reset Email'}
                    </button>
                    <button type="button" onClick={() => setShowReset(false)}
                      className={`w-full text-center text-xs transition-colors ${providerMode ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-400 hover:text-neutral-600'}`}>
                      ← Back to log in
                    </button>
                  </>
                ) : (
                  <>
                    {tab === 'signup' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={`block text-sm font-medium mb-1.5 ${providerMode ? 'text-neutral-400' : 'text-neutral-700'}`}>First name</label>
                          <input type="text" required className={`form-input ${providerMode ? 'bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600' : ''}`} placeholder="First name"
                            value={firstName} onChange={e => setFirstName(e.target.value)} />
                        </div>
                        <div>
                          <label className={`block text-sm font-medium mb-1.5 ${providerMode ? 'text-neutral-400' : 'text-neutral-700'}`}>Last name</label>
                          <input type="text" required className={`form-input ${providerMode ? 'bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600' : ''}`} placeholder="Last name"
                            value={lastName} onChange={e => setLastName(e.target.value)} />
                        </div>
                      </div>
                    )}
                    <div>
                      <label className={`block text-sm font-medium mb-1.5 ${providerMode ? 'text-neutral-400' : 'text-neutral-700'}`}>Email</label>
                      <input type="email" required className={`form-input ${providerMode ? 'bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600' : ''}`} placeholder="you@example.com"
                        value={email} onChange={e => setEmail(e.target.value)} />
                      {tab === 'signup' && (
                        <p className={`mt-1.5 text-xs ${emailLooksReal ? (providerMode ? 'text-neutral-500' : 'text-neutral-400') : 'text-amber-500'}`}>
                          {emailLooksReal ? 'Use a real email you can access for verification and payout updates.' : 'Please enter a real email address.'}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-1.5 ${providerMode ? 'text-neutral-400' : 'text-neutral-700'}`}>Password</label>
                      <input type="password" required className={`form-input ${providerMode ? 'bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600' : ''}`} placeholder="••••••••"
                        value={password} onChange={e => setPassword(e.target.value)} />
                      {tab === 'signup' && (
                        <p className={`mt-1.5 text-xs ${providerMode ? 'text-neutral-500' : 'text-neutral-400'}`}>Use at least 10 characters.</p>
                      )}
                    </div>
                    {tab === 'signup' && password.length > 0 && (
                      <div>
                        <label className={`block text-sm font-medium mb-1.5 ${providerMode ? 'text-neutral-400' : 'text-neutral-700'}`}>Confirm password</label>
                        <input
                          type="password"
                          required
                          className={`form-input ${providerMode ? 'bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600' : ''}`}
                          placeholder="Re-enter password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                        />
                        {confirmPassword.length > 0 && (
                          <p className={`mt-1.5 text-xs ${confirmPassword === password ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {confirmPassword === password ? 'Passwords match.' : 'Passwords need to match before you continue.'}
                          </p>
                        )}
                      </div>
                    )}
                    {captchaRequired && (
                      <div className="pt-1 flex flex-col items-start w-full">
                        <div ref={captchaRef} className="hcaptcha-shell w-full" style={{ minHeight: captchaWidgetId || captchaLoadError ? 78 : 0 }} />
                        {!captchaWidgetId && !captchaLoadError && <p className={`mt-2 text-xs ${providerMode ? 'text-neutral-500' : 'text-neutral-500'}`}>Captcha loading… If it doesn’t appear, disable ad blockers and refresh.</p>}
                        {captchaLoadError && <p className="mt-2 text-xs text-red-500">{captchaLoadError}</p>}
                        {captchaLoadError && (
                          <p className={`mt-1 text-xs ${providerMode ? 'text-neutral-500' : 'text-neutral-500'}`}>
                            You can still continue signup below while captcha is unavailable.
                          </p>
                        )}
                      </div>
                    )}
                    <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                      {loading ? 'Please wait…' : tab === 'login' ? 'Log In' : providerMode ? 'Create account to continue' : 'Create Account'}
                    </button>
                    {tab === 'login' && (
                      <div className="text-center">
                        <button type="button" onClick={() => setShowReset(true)}
                          className={`text-xs transition-colors ${providerMode ? 'text-neutral-500 hover:text-accent' : 'text-neutral-400 hover:text-accent'}`}>
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

          <p className={`text-center text-xs mt-5 ${providerMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
            By continuing, you agree to our{' '}
            <Link href="/terms" className="hover:underline">Terms</Link> and{' '}
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>.
          </p>
          {providerMode ? (
            <p className="text-center mt-4 text-xs text-neutral-500">
              Your consumer account and provider role stay connected on one login.
            </p>
          ) : (
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
                    setTimeout(() => { window.location.href = '/provider/auth/login'; }, 1200);
                  }}
                  className="text-xs text-neutral-500 hover:text-accent transition-colors">
                  Are you a provider? Log in here →
                </button>
              )}
            </p>
          )}
        </div>
      </div>
    </>
  );
};

export default SignIn;
