import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import BusinessNav from '../../components/BusinessNav';
import { getSupabaseClient } from '../../lib/supabaseClient';

function getSupabase() {
  return getSupabaseClient();
}

const PROVIDER_SIGNUP_CTX_KEY = 'sm_provider_signup_ctx_v1';
type OAuthProvider = 'google' | 'apple';

const SignupPage: NextPage = () => {
  const router = useRouter();

  const [businessName, setBusinessName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaWidgetId, setCaptchaWidgetId] = useState<number | null>(null);
  const [captchaLoadError, setCaptchaLoadError] = useState<string | null>(null);
  const captchaRef = useRef<HTMLDivElement | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

  const [autoFinalizeDone, setAutoFinalizeDone] = useState(false);

  const ensureDraft = async (opts?: { name?: string; token?: string; agreed?: boolean }) => {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError('Please create or sign in to your provider account first.');
      return false;
    }

    const payload = {
      businessName: (opts?.name ?? businessName ?? '').trim(),
      captchaToken: (opts?.token ?? captchaToken ?? '').trim(),
      agree: opts?.agreed ?? agree,
    };

    const res = await fetch('/api/business-create-draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || 'Could not create provider draft.');
      return false;
    }

    setSuccess('Provider account created. Redirecting to dashboard...');
    if (typeof window !== 'undefined') sessionStorage.removeItem(PROVIDER_SIGNUP_CTX_KEY);
    setTimeout(() => router.replace('/provider/dashboard'), 350);
    return true;
  };

  useEffect(() => {
    if (!siteKey) return;
    const renderCaptcha = () => {
      const hcaptcha = (window as any).hcaptcha;
      if (!hcaptcha || !captchaRef.current || captchaWidgetId !== null) return;
      try {
        const id = hcaptcha.render(captchaRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          size: 'normal',
          callback: (token: string) => setCaptchaToken(token),
          'expired-callback': () => setCaptchaToken(''),
        });
        setCaptchaWidgetId(id);
        setCaptchaLoadError(null);
      } catch {
        setCaptchaLoadError('Captcha failed to load. Please refresh or disable ad blockers.');
      }
    };

    if ((window as any).hcaptcha) {
      renderCaptcha();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = renderCaptcha;
    document.body.appendChild(script);
  }, [siteKey, captchaWidgetId]);

  useEffect(() => {
    const queryEmail = typeof router.query.email === 'string' ? router.query.email.trim() : '';
    if (queryEmail) setEmail(queryEmail.toLowerCase());
  }, [router.query.email]);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;

      setSignedInEmail(session?.user?.email || null);

      if (autoFinalizeDone) return;
      const isOauthReturn = String(router.query.oauth || '') === '1';
      if (!isOauthReturn || !session?.user) return;

      setAutoFinalizeDone(true);
      try {
        const raw = typeof window !== 'undefined' ? sessionStorage.getItem(PROVIDER_SIGNUP_CTX_KEY) : null;
        const ctx = raw ? JSON.parse(raw) : null;
        const token = String(ctx?.captchaToken || '').trim();
        const agreed = !!ctx?.agree;
        const name = String(ctx?.businessName || '').trim();

        if (!token || !agreed || !name) {
          setError('Please complete business name, terms, and captcha, then continue.');
          return;
        }

        await ensureDraft({ name, token, agreed });
      } catch {
        setError('Could not finish provider setup after sign-in. Please try again.');
      }
    })();

    return () => { active = false; };
  }, [router.query.oauth, autoFinalizeDone]);

  const validateGate = () => {
    setError(null);
    if (!businessName.trim()) {
      setError('Business name is required.');
      return false;
    }
    if (!agree) {
      setError('You must agree to the provider terms to continue.');
      return false;
    }
    if (siteKey && !captchaToken) {
      setError('Please complete the captcha.');
      return false;
    }
    return true;
  };

  const handleOAuth = async (provider: OAuthProvider) => {
    if (!validateGate()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabase();
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(PROVIDER_SIGNUP_CTX_KEY, JSON.stringify({
          businessName: businessName.trim(),
          agree: true,
          captchaToken,
        }));
      }

      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/provider/signup?oauth=1`,
          ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {}),
        },
      });
    } catch (e: any) {
      setError(e?.message || `Could not continue with ${provider}.`);
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateGate()) return;

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabase();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { full_name: cleanName || businessName.trim() } },
      });
      if (signUpError) throw signUpError;

      if (!data.session) {
        setSuccess('Check your email to verify your account, then return here to finish provider setup.');
        setLoading(false);
        return;
      }

      const ok = await ensureDraft({ agreed: true, token: captchaToken, name: businessName.trim() });
      if (!ok) setLoading(false);
    } catch (e: any) {
      setError(e?.message || 'Could not create account.');
      setLoading(false);
    }
  };

  const GoogleIcon = () => (
    <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );

  const AppleIcon = () => (
    <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 12.06c.022 2.411 2.115 3.212 2.138 3.223-.018.056-.333 1.15-1.096 2.279-.658.976-1.34 1.948-2.415 1.97-1.057.021-1.397-.628-2.606-.628-1.21 0-1.588.607-2.585.648-1.038.039-1.83-1.038-2.493-2.01-1.357-1.967-2.394-5.557-1.004-8.038.69-1.232 1.928-2.013 3.27-2.034 1.02-.02 1.982.689 2.606.689.623 0 1.794-.852 3.023-.727.514.022 1.955.207 2.88 1.563-.074.046-1.718 1.002-1.718 3.065z" />
      <path d="M14.91 5.235c.553-.67.926-1.602.823-2.535-.797.032-1.761.53-2.333 1.198-.512.591-.963 1.539-.84 2.445.888.07 1.798-.454 2.35-1.108z" />
    </svg>
  );

  return (
    <>
      <Head>
        <title>Create Provider Account — ScheduleMe</title>
        <meta name="description" content="Create your provider account with email, Google, or Apple. Agree to terms and finish setup in your dashboard." />
      </Head>
      <BusinessNav />

      <div className="min-h-screen bg-neutral-950 pt-24 pb-20 px-4 md:px-6">
        <div className="mx-auto max-w-xl">
          <div className="text-center mb-7">
            <span className="section-eyebrow mb-3 block">Provider Account</span>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3" style={{ letterSpacing: '-0.02em' }}>
              Create your provider account
            </h1>
            <p className="text-neutral-400">
              Sign up with email and agree to provider terms. We&apos;ll create your listing and you can finish setup in Provider Hub.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 md:p-7 space-y-5">
            {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</div>}
            {success && <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400">{success}</div>}

            <form onSubmit={handleEmailSignup} className="space-y-3">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.12em] font-semibold text-neutral-500 mb-1.5">Business / provider name</label>
                <input
                  type="text"
                  maxLength={60}
                  required
                  className="form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600"
                  placeholder="e.g. Mike R. Plumbing"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.12em] font-semibold text-neutral-500 mb-1.5">Full name</label>
                <input
                  type="text"
                  autoComplete="name"
                  className="form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600"
                  placeholder="Jamie Rivera"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.12em] font-semibold text-neutral-500 mb-1.5">Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  className="form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.12em] font-semibold text-neutral-500 mb-1.5">Password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600"
                  placeholder="Create password (8+ chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className={`rounded-xl border p-4 ${agree ? 'border-neutral-700' : 'border-neutral-800'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-accent focus:ring-accent"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                  />
                  <span className="text-sm text-neutral-300 leading-snug">
                    I agree to the <Link href="/terms" className="text-accent hover:underline">Terms of Service</Link>,{' '}
                    <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>, and the{' '}
                    <strong className="text-white">12% commission structure</strong> on completed jobs.
                    <span className="block mt-2 text-xs text-neutral-500">
                      Founder50 note: standard platform fee is 12%, while Founder50 members are locked into 6% forever.
                    </span>
                  </span>
                </label>
              </div>

              {siteKey && (
                <div className="w-full flex flex-col items-center">
                  <div className="w-full rounded-xl border border-neutral-700/70 bg-neutral-900/70 py-4 flex justify-center">
                    <div ref={captchaRef} className="hcaptcha-shell" style={{ minHeight: 78 }} />
                  </div>
                  {!captchaWidgetId && <p className="mt-2 text-xs text-neutral-500 text-center">Captcha loading... If it doesn&apos;t appear, disable ad blockers and refresh.</p>}
                  {captchaLoadError && <p className="mt-2 text-xs text-red-400 text-center">{captchaLoadError}</p>}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm font-bold disabled:opacity-60">
                {loading ? 'Creating account...' : 'Create provider account'}
              </button>
            </form>

            <div className="relative py-1">
              <div className="h-px bg-neutral-800" />
              <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-1/2 px-2 text-xs text-neutral-500 bg-neutral-900">or continue with</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleOAuth('google')}
                disabled={loading}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-60 flex items-center justify-center gap-2.5"
              >
                <GoogleIcon />
                Continue with Google
              </button>
              <button
                type="button"
                onClick={() => handleOAuth('apple')}
                disabled={loading}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-60 flex items-center justify-center gap-2.5"
              >
                <AppleIcon />
                Continue with Apple
              </button>
            </div>

            {signedInEmail && (
              <div className="rounded-xl border border-accent/30 bg-accent/10 p-3.5">
                <p className="text-xs text-neutral-300">
                  Signed in as <span className="font-semibold text-white">{signedInEmail}</span>. Need to finish draft creation?
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (!validateGate()) return;
                    setLoading(true);
                    ensureDraft({ agreed: true, token: captchaToken, name: businessName.trim() }).finally(() => setLoading(false));
                  }}
                  disabled={loading}
                  className="mt-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-accent text-white disabled:opacity-60"
                >
                  Finish provider setup
                </button>
              </div>
            )}

          </div>

          <p className="text-center text-xs text-neutral-600 mt-4">
            Already have a provider account? <Link href="/provider/auth/login" className="text-accent hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </>
  );
};

export default SignupPage;
