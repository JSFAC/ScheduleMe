import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function StripeConnectReturnPage() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;

    const targetParam = typeof router.query.target === 'string' ? router.query.target : '';
    const fallbackParam = typeof router.query.fallback === 'string' ? router.query.fallback : '';

    const target = targetParam.trim();
    const fallback = fallbackParam.trim() || '/business/dashboard';

    if (!target) {
      window.location.replace(fallback);
      return;
    }

    // Attempt app deep-link first, then fallback to web dashboard.
    window.location.assign(target);
    const timeout = window.setTimeout(() => {
      window.location.replace(fallback);
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [router.isReady, router.query.fallback, router.query.target]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#05070c',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', opacity: 0.92 }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Returning to ScheduleMe Provider</h1>
        <p style={{ margin: 0, color: '#94a3b8' }}>If the app does not open automatically, you can close this page.</p>
      </div>
    </main>
  );
}

