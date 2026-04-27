import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import BusinessNav from '../../components/BusinessNav';
import { createProviderDraft, getProviderAccessState, type ProviderAccessState } from '../../lib/providerClient';

const SignupPage: NextPage = () => {
  const router = useRouter();
  const [status, setStatus] = useState<ProviderAccessState>('loading');
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await getProviderAccessState();
      if (!active) return;
      setStatus(result.state);
      setSignedInEmail(result.user?.email || null);
    })();
    return () => { active = false; };
  }, []);

  async function handleBecomeProvider() {
    setLoading(true);
    setError(null);
    const result = await createProviderDraft();
    if (!result.ok) {
      setError(result.error || 'Could not create provider draft.');
      setLoading(false);
      return;
    }
    router.replace('/provider/dashboard');
  }

  return (
    <>
      <Head>
        <title>Become a Provider — ScheduleMe</title>
        <meta
          name="description"
          content="Use your ScheduleMe account to become a provider, create your draft, and finish setup from your dashboard."
        />
      </Head>
      <BusinessNav />

      <div className="min-h-screen bg-neutral-950 pt-24 pb-20 px-4 md:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-7">
            <span className="section-eyebrow mb-3 block">Provider Setup</span>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3" style={{ letterSpacing: '-0.02em' }}>
              One account. Provider role when you&apos;re ready.
            </h1>
            <p className="text-neutral-400 max-w-xl mx-auto">
              ScheduleMe consumers and providers use the same account. When you become a provider, we create your draft and send you straight into your dashboard to finish the checklist.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 md:p-7 space-y-5">
            {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</div>}

            {status === 'loading' && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-5 text-sm text-neutral-400 text-center">
                Checking your account…
              </div>
            )}

            {status === 'logged_out' && (
              <>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
                  <h2 className="text-lg font-semibold text-white mb-2">Authenticate once, then continue</h2>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    Sign in with your existing ScheduleMe account or create one first. After auth, we&apos;ll resume provider conversion and take you straight into setup.
                  </p>
                </div>

                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Before you continue</p>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    Consumer and provider activity live on one ScheduleMe account. By continuing, you&apos;re asking us to create a provider draft on that same account so you can finish services, payouts, and profile details from the dashboard.
                  </p>
                  <label className="flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900/70 px-4 py-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-neutral-300 leading-relaxed">
                      I understand this uses my regular ScheduleMe account and I agree to the provider{' '}
                      <Link href="/terms" className="text-accent hover:underline">terms</Link>{' '}
                      and{' '}
                      <Link href="/privacy" className="text-accent hover:underline">privacy policy</Link>.
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link
                    href={agreed ? "/signin?mode=login&intent=provider" : "#"}
                    aria-disabled={!agreed}
                    className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold text-center transition-colors ${
                      agreed
                        ? 'border-neutral-700 bg-neutral-800 text-white hover:bg-neutral-700'
                        : 'pointer-events-none border-neutral-800 bg-neutral-900 text-neutral-600'
                    }`}
                  >
                    Log in to continue
                  </Link>
                  <Link
                    href={agreed ? "/signin?mode=signup&intent=provider" : "#"}
                    aria-disabled={!agreed}
                    className={`w-full px-4 py-3 text-sm font-semibold text-center rounded-xl transition-all ${
                      agreed
                        ? 'btn-primary'
                        : 'pointer-events-none border border-neutral-800 bg-neutral-900 text-neutral-600'
                    }`}
                  >
                    Create account
                  </Link>
                </div>
              </>
            )}

            {status === 'consumer' && (
              <>
                <div className="rounded-2xl border border-accent/20 bg-accent/10 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent mb-2">Signed in</p>
                  <p className="text-sm text-neutral-300">
                    You&apos;re signed in as <span className="font-semibold text-white">{signedInEmail}</span>.
                  </p>
                  <p className="mt-2 text-sm text-neutral-400">
                    Becoming a provider creates your draft on this same account. You&apos;ll finish services, pricing, media, and payouts from the same dashboard.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleBecomeProvider}
                  disabled={loading || !agreed}
                  className="btn-primary w-full py-3 text-sm font-bold disabled:opacity-60"
                >
                  {loading ? 'Creating provider draft…' : 'Become a Provider'}
                </button>
                <label className="flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-accent focus:ring-accent"
                  />
                  <span className="text-sm text-neutral-300 leading-relaxed">
                    I&apos;m ready to turn this account into a provider draft and continue under the provider{' '}
                    <Link href="/terms" className="text-accent hover:underline">terms</Link>.
                  </span>
                </label>
              </>
            )}

            {status === 'provider' && (
              <>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                  <h2 className="text-lg font-semibold text-white mb-2">Your provider profile is ready to manage</h2>
                  <p className="text-sm text-neutral-300 leading-relaxed">
                    This account already has a provider profile. Open your dashboard to keep working on your checklist, availability, bookings, and payouts.
                  </p>
                </div>

                <Link href="/provider/dashboard" className="btn-primary w-full px-4 py-3 text-sm font-semibold text-center block">
                  Start now
                </Link>
              </>
            )}

            <div className="rounded-xl border border-neutral-800 p-4">
              <p className="text-xs uppercase tracking-[0.12em] font-semibold text-neutral-500 mb-2">How it works</p>
              <ol className="space-y-2 text-sm text-neutral-400 list-decimal list-inside">
                <li>Authenticate with your regular ScheduleMe account.</li>
                <li>Create your provider draft on that same account.</li>
                <li>Finish setup from your dashboard when you&apos;re ready.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignupPage;
