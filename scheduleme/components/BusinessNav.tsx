// components/BusinessNav.tsx
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createProviderDraft, getProviderAccessState, type ProviderAccessState } from '../lib/providerClient';

export default function BusinessNav() {
  const [status, setStatus] = useState<ProviderAccessState>('loading');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await getProviderAccessState();
      if (!active) return;
      setStatus(result.state);
    })();
    return () => { active = false; };
  }, []);

  async function handleBecomeProvider() {
    setLoading(true);
    const result = await createProviderDraft();
    if (result.ok) {
      window.location.href = '/provider/dashboard';
      return;
    }
    setLoading(false);
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed left-0 right-0 z-[51] bg-neutral-950"
        style={{ top: 0, height: 'env(safe-area-inset-top, 0px)' }}
      />
      <header
        className="fixed left-0 right-0 z-50 bg-neutral-950/95 backdrop-blur-md border-b border-neutral-800"
        style={{ top: 'env(safe-area-inset-top, 0px)' }}
      >
      <nav className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between" style={{ height: 'clamp(56px, 10vw, 72px)' }} aria-label="Provider navigation">
        <div className="flex-1 flex items-center min-w-0">
          <Link href="/provider" className="group flex flex-col leading-none" aria-label="ScheduleMe for Providers">
            <span className="text-xl font-black text-white transition-opacity group-hover:opacity-70" style={{ letterSpacing: '-0.03em' }}>
              ScheduleMe
            </span>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-accent mt-0.5">
              for Providers
            </span>
          </Link>
        </div>

        <ul className="hidden md:flex items-center justify-center gap-1 flex-1" role="list">
          {[
            { label: 'Why Join', href: '/provider#why' },
            { label: 'How It Works', href: '/provider#how' },
            { label: 'Pricing', href: '/provider#pricing' },
            { label: 'FAQ', href: '/provider#faq' },
          ].map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="px-4 py-2 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex-1 flex items-center justify-end gap-2 sm:gap-3">
          <Link href="/" className="hidden md:block text-sm text-neutral-400 hover:text-neutral-200 transition-colors">
            Consumer site →
          </Link>
          {status === 'logged_out' || status === 'loading' ? (
            <>
              <Link
                href="/signin?mode=login&intent=provider"
                className="text-[11px] sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-neutral-800 text-neutral-200 hover:bg-neutral-700 border border-neutral-700 transition-colors whitespace-nowrap"
              >
                Log In
              </Link>
              <Link href="/signin?mode=signup&intent=provider" className="btn-primary text-[11px] sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 whitespace-nowrap">
                Create Account
              </Link>
            </>
          ) : status === 'provider' ? (
            <Link href="/provider/dashboard" className="btn-primary text-[11px] sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 whitespace-nowrap">
              Provider Hub
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleBecomeProvider}
              disabled={loading}
              className="btn-primary text-[11px] sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 whitespace-nowrap disabled:opacity-60"
            >
              {loading ? 'Opening…' : 'Become a Provider'}
            </button>
          )}
        </div>
      </nav>
      </header>
    </>
  );
}
