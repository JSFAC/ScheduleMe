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

    setSuccess('Provider account created. Redirecting to dashboard…');
    if (typeof window !== 'undefined') sessionStorage.removeItem(PROVIDER_SIGNUP_CTX_KEY);
    setTimeout(() => router.replace('/business/dashboard'), 350);
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
    let active = true;
    (async () => {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (session?.user?.email) {
        setSignedInEmail(session.user.email);
      } else {
        setSignedInEmail(null);
      }

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

        if (!token || !agreed) {
          setError('Please complete terms + captcha, then click Create provider account.');
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
    if (!agree) {
      setError('You must agree to the terms to create a provider account.');
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
          redirectTo: `${window.location.origin}/business/signup?oauth=1`,
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
    if (!cleanName) {
      setError('Please enter your full name.');
      return;
    }
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
        options: { data: { full_name: cleanName } },
      });
      if (signUpError) throw signUpError;

      if (!data.session) {
        setSuccess('Check your email to verify your account, then return here to complete provider setup.');
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

  const finalizeSignedIn = async () => {
    if (!validateGate()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    const ok = await ensureDraft({ agreed: true, token: captchaToken, name: businessName.trim() });
    if (!ok) setLoading(false);
  };

  return (
    <>
      <Head>
        <title>Create Provider Account — ScheduleMe</title>
        <meta name="description" content="Create your provider account with Google, Apple, or email. Then finish setup in your dashboard." />
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
              Sign up with Google, Apple, or email. We&apos;ll create your draft profile instantly and you can finish setup in dashboard.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 md:p-7 space-y-5">
            {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</div>}
            {success && <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400">{success}</div>}

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1.5">Business / profile name <span className="text-neutral-600">(optional)</span></label>
              <input
                type="text"
                maxLength={60}
                className="form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600"
                placeholder="e.g. Mike R. Plumbing"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleOAuth('google')}
                disabled={loading}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-60"
              >
                Continue with Google
              </button>
              <button
                type="button"
                onClick={() => handleOAuth('apple')}
                disabled={loading}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-60"
              >
                Continue with Apple
              </button>
            </div>

            <div className="relative py-1">
              <div className="h-px bg-neutral-800" />
              <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-1/2 px-2 text-xs text-neutral-500 bg-neutral-900">or sign up with email</span>
            </div>

            <form onSubmit={handleEmailSignup} className="space-y-3">
              <input
                type="text"
                autoComplete="name"
                className="form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <input
                type="email"
                autoComplete="email"
                className="form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                autoComplete="new-password"
                className="form-input bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600"
                placeholder="Create password (8+ chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm font-bold disabled:opacity-60">
                {loading ? 'Creating account…' : 'Create provider account'}
              </button>
            </form>

            {signedInEmail && (
              <div className="rounded-xl border border-accent/30 bg-accent/10 p-3.5">
                <p className="text-xs text-neutral-300">
                  Signed in as <span className="font-semibold text-white">{signedInEmail}</span>. Need to finish draft creation?
                </p>
                <button
                  type="button"
                  onClick={finalizeSignedIn}
                  disabled={loading}
                  className="mt-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-accent text-white disabled:opacity-60"
                >
                  Finish provider setup
                </button>
              </div>
            )}

            <div className={`rounded-xl border p-4 ${agree ? 'border-neutral-700' : 'border-neutral-800'}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-accent focus:ring-accent"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span className="text-sm text-neutral-400">
                  I agree to the <Link href="/terms" className="text-accent hover:underline">Terms of Service</Link>,{' '}
                  <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>, and provider platform terms.
                </span>
              </label>
            </div>

            {siteKey && (
              <div className="flex flex-col items-start w-full">
                <div ref={captchaRef} className="hcaptcha-shell w-full" style={{ minHeight: 78 }} />
                {!captchaWidgetId && <p className="mt-2 text-xs text-neutral-500">Captcha loading… If it doesn&apos;t appear, disable ad blockers and refresh.</p>}
                {captchaLoadError && <p className="mt-2 text-xs text-red-400">{captchaLoadError}</p>}
              </div>
            )}
          </div>

          <p className="text-center text-xs text-neutral-600 mt-4">
            Already have a provider account? <Link href="/business/auth/login" className="text-accent hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </>
  );
};

export default SignupPage;
