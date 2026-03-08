// pages/_app.tsx
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import '../styles/globals.css';

const isBiz = (url: string) => url.startsWith('/business');

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [showOverlay, setShowOverlay] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [toBusiness, setToBusiness] = useState(false);

  useEffect(() => {
    const onStart = (url: string) => {
      if (isBiz(router.asPath) !== isBiz(url)) {
        setToBusiness(isBiz(url));
        setShowOverlay(true);
        setFadeIn(false);
        // Trigger fade-in on next frame
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setFadeIn(true))
        );
      }
    };

    const onDone = () => {
      // Hold so user can read it, then fade out and unmount
      setTimeout(() => {
        setFadeIn(false);
        // Wait for fade-out to finish before unmounting
        setTimeout(() => setShowOverlay(false), 450);
      }, 500);
    };

    const onError = () => setShowOverlay(false);

    router.events.on('routeChangeStart', onStart);
    router.events.on('routeChangeComplete', onDone);
    router.events.on('routeChangeError', onError);
    return () => {
      router.events.off('routeChangeStart', onStart);
      router.events.off('routeChangeComplete', onDone);
      router.events.off('routeChangeError', onError);
    };
  }, [router]);

  const dark = toBusiness;

  return (
    <>
      {showOverlay && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            opacity: fadeIn ? 1 : 0,
            transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            background: dark ? '#0a0a0a' : '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {/* Grid — only on dark */}
          {dark && (
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }} />
          )}

          {/* Grid — light version */}
          {!dark && (
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }} />
          )}

          {/* Glow */}
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%,-50%)',
            width: '500px', height: '500px', borderRadius: '50%',
            background: dark
              ? 'radial-gradient(ellipse, rgba(10,132,255,0.12) 0%, transparent 70%)'
              : 'radial-gradient(ellipse, rgba(10,132,255,0.07) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Brand text */}
          <div style={{ position: 'relative', textAlign: 'center' }}>
            <p style={{
              fontSize: '1.75rem', fontWeight: 900,
              color: dark ? '#ffffff' : '#0a0a0a',
              letterSpacing: '-0.03em', marginBottom: '4px',
            }}>
              ScheduleMe
            </p>
            <p style={{
              fontSize: '10px', fontWeight: 700,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: '#0A84FF',
            }}>
              {toBusiness ? 'for Business' : 'for Everyone'}
            </p>
          </div>
        </div>
      )}

      <Component {...pageProps} />
    </>
  );
}
