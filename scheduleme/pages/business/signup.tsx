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

  useEffect(() => {
    let active = true;

    (async () => {
      const result = await getProviderAccessState();
      if (!active) return;
      setStatus(result.state);
      setSignedInEmail(result.user?.email || null);
    })();

    return () => {
      active = false;
    };
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
          content="Use your ScheduleMe account to become a provider, create your draft, and finish setup in Provider Hub."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0a0a0a" />
      </Head>
      <BusinessNav />

      <div className="min-h-screen bg-neutral-950 pt-24 pb-20 px-4 md:px-6 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse 80% 70% at 50% 0%, black 30%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 0%, black 30%, transparent 100%)',
          }}
        />
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-7 relative">
            <span className="section-eyebrow mb-3 block">Provider Setup</span>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3" style={{ letterSpacing: '-0.02em' }}>
              One account. Provider role when you&apos;re ready.
            </h1>
            <p className="text-neutral-400 max-w-xl mx-auto">
              ScheduleMe consumers and providers use the same account. When you become a provider, we create your draft and send you straight into Provider Hub to finish the checklist.
            </p>
          </div>

          <div className="relative rounded-2xl border border-neutral-800 bg-neutral-900/95 p-6 md:p-7 space-y-5 shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
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
                    Sign in with your existing ScheduleMe account or create one first. After auth, we&apos;ll resume provider conversion and take you into Provider Hub.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link href="/signin?mode=login&intent=provider" className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-700 text-center transition-colors">
                    Log in to continue
                  </Link>
                  <Link href="/signin?mode=signup&intent=provider" className="btn-primary w-full px-4 py-3 text-sm font-semibold text-center">
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
                    Becoming a provider creates your draft on this same account. You&apos;ll finish services, pricing, media, and payouts inside Provider Hub.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleBecomeProvider}
                  disabled={loading}
                  className="btn-primary w-full py-3 text-sm font-bold disabled:opacity-60"
                >
                  {loading ? 'Creating provider draft…' : 'Become a Provider'}
                </button>
              </>
            )}

            {status === 'provider' && (
              <>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                  <h2 className="text-lg font-semibold text-white mb-2">Your provider profile is ready to manage</h2>
                  <p className="text-sm text-neutral-300 leading-relaxed">
                    This account already has a provider profile. Open Provider Hub to keep working on your checklist, availability, bookings, and payouts.
                  </p>
                </div>

                <Link href="/provider/dashboard" className="btn-primary w-full px-4 py-3 text-sm font-semibold text-center block">
                  Open Provider Hub
                </Link>
              </>
            )}

            <div className="rounded-xl border border-neutral-800 p-4">
              <p className="text-xs uppercase tracking-[0.12em] font-semibold text-neutral-500 mb-2">How it works</p>
              <ol className="space-y-2 text-sm text-neutral-400 list-decimal list-inside">
                <li>Authenticate with your regular ScheduleMe account.</li>
                <li>Create your provider draft on that same account.</li>
                <li>Finish setup inside Provider Hub when you&apos;re ready.</li>
              </ol>
            </div>
          </div>

          <div className="relative mt-8 text-center">
            <Link href="/" className="text-sm font-medium text-neutral-500 hover:text-neutral-300 transition-colors">
              Back to consumer page →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignupPage;
