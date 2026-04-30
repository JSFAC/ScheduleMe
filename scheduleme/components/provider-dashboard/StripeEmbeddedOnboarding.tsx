import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    StripeConnect?: {
      init: (options: {
        publishableKey: string;
        fetchClientSecret: () => Promise<string>;
        appearance?: Record<string, unknown>;
      }) => Promise<{
        create: (component: 'account-onboarding') => {
          setOnExit?: (callback: () => void | Promise<void>) => void;
          setOnLoadError?: (callback: (error: { message?: string }) => void) => void;
          remove?: () => void;
        } & HTMLElement;
      }>;
    };
  }
}

let stripeConnectLoader: Promise<void> | null = null;

function loadStripeConnectScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Stripe can only load in the browser.'));
  if (window.StripeConnect?.init) return Promise.resolve();
  if (stripeConnectLoader) return stripeConnectLoader;

  stripeConnectLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-stripe-connect-script="true"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Stripe Connect.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://connect-js.stripe.com/v1.0/connect.js';
    script.async = true;
    script.dataset.stripeConnectScript = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Stripe Connect.'));
    document.head.appendChild(script);
  });

  return stripeConnectLoader;
}

type StripeEmbeddedOnboardingProps = {
  dm: boolean;
  mode: 'onboarding' | 'update';
  onClose: () => void;
  onOpenHostedFallback: () => void;
  onRefreshStatus: () => Promise<boolean>;
  requestClientSecret: (mode: 'onboarding' | 'update') => Promise<string>;
};

export default function StripeEmbeddedOnboarding({
  dm,
  mode,
  onClose,
  onOpenHostedFallback,
  onRefreshStatus,
  requestClientSecret,
}: StripeEmbeddedOnboardingProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let onboardingElement: (HTMLElement & {
      setOnExit?: (callback: () => void | Promise<void>) => void;
      setOnLoadError?: (callback: (error: { message?: string }) => void) => void;
      remove?: () => void;
    }) | null = null;

    const mount = async () => {
      try {
        setLoading(true);
        setError('');

        const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
        if (!publishableKey) {
          throw new Error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.');
        }

        await loadStripeConnectScript();
        if (!active) return;
        if (!window.StripeConnect?.init) {
          throw new Error('Stripe Connect is unavailable in this browser.');
        }

        const connect = await window.StripeConnect.init({
          publishableKey,
          fetchClientSecret: () => requestClientSecret(mode),
          appearance: {
            overlays: 'dialog',
            variables: {
              colorPrimary: '#007e6d',
              colorBackground: dm ? '#17181a' : '#ffffff',
              colorText: dm ? '#f3f4f6' : '#171717',
              colorDanger: '#dc2626',
              borderRadius: '18px',
            },
          },
        });
        if (!active) return;

        onboardingElement = connect.create('account-onboarding');
        onboardingElement.setOnLoadError?.((nextError) => {
          if (!active) return;
          setLoading(false);
          setError(nextError?.message || 'Stripe setup could not load here.');
        });
        onboardingElement.setOnExit?.(async () => {
          if (!active) return;
          setRefreshing(true);
          try {
            await onRefreshStatus();
          } finally {
            if (active) {
              setRefreshing(false);
              onClose();
            }
          }
        });

        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(onboardingElement);
        }
        setLoading(false);
      } catch (err) {
        if (!active) return;
        setLoading(false);
        setError(err instanceof Error ? err.message : 'Stripe setup could not load here.');
      }
    };

    void mount();

    return () => {
      active = false;
      onboardingElement?.remove?.();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [dm, mode, onClose, onRefreshStatus, requestClientSecret]);

  return (
    <div
      className="mt-5 rounded-[24px] border p-4"
      style={{
        borderColor: dm ? '#2f3136' : '#dbe4df',
        background: dm ? '#141416' : '#f7fbf8',
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: dm ? '#f5f5f5' : '#171717' }}>
            Finish Stripe inside ScheduleMe
          </h3>
          <p className="mt-1 text-xs" style={{ color: dm ? '#a3a3a3' : '#6b7280' }}>
            {mode === 'update'
              ? 'Update your payout setup without leaving the dashboard.'
              : 'Complete Stripe onboarding here so payouts can turn on faster.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border px-3 py-2 text-xs font-semibold transition-colors"
          style={{
            borderColor: dm ? '#35363b' : '#d1d5db',
            color: dm ? '#e5e7eb' : '#374151',
            background: dm ? '#1a1b1f' : '#ffffff',
          }}
        >
          Close
        </button>
      </div>

      {loading && (
        <div
          className="mb-3 rounded-2xl border px-4 py-3 text-sm"
          style={{
            borderColor: dm ? '#2f3136' : '#d1d5db',
            color: dm ? '#d1d5db' : '#374151',
            background: dm ? '#1a1b1f' : '#ffffff',
          }}
        >
          Loading Stripe setup…
        </div>
      )}

      {refreshing && (
        <div
          className="mb-3 rounded-2xl border px-4 py-3 text-sm"
          style={{
            borderColor: dm ? '#2f3136' : '#d1d5db',
            color: dm ? '#d1d5db' : '#374151',
            background: dm ? '#1a1b1f' : '#ffffff',
          }}
        >
          Refreshing your payout status…
        </div>
      )}

      {error && (
        <div
          className="mb-3 rounded-2xl border px-4 py-3"
          style={{
            borderColor: dm ? 'rgba(190,60,80,0.42)' : '#fecaca',
            background: dm ? 'rgba(104,23,31,0.35)' : '#fef2f2',
          }}
        >
          <p className="text-sm font-semibold" style={{ color: dm ? '#fecdd3' : '#b91c1c' }}>
            Stripe setup could not load here.
          </p>
          <p className="mt-1 text-xs" style={{ color: dm ? '#fca5a5' : '#991b1b' }}>
            {error}
          </p>
          <button
            type="button"
            onClick={onOpenHostedFallback}
            className="mt-3 rounded-xl px-3 py-2 text-xs font-semibold text-white"
            style={{ background: '#007e6d' }}
          >
            Open Stripe instead
          </button>
        </div>
      )}

      <div ref={containerRef} />
    </div>
  );
}
