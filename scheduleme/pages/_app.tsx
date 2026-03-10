// pages/_app.tsx
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import '../styles/globals.css';

const isBiz = (url: string) => url.startsWith('/business') || url.startsWith('/auth');

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  // Page-level fade
  const [pageVisible, setPageVisible] = useState(false);
  // Business/consumer splash overlay
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayFade, setOverlayFade] = useState(false);
  const [toBusiness, setToBusiness] = useState(false);

  // Fade in on first mount
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setPageVisible(true)));
  }, []);

  useEffect(() => {
    const onStart = (url: string) => {
      // Fade out current page
      setPageVisible(false);

      // If crossing consumer/business boundary, show splash
      if (isBiz(router.asPath) !== isBiz(url)) {
        setToBusiness(isBiz(url));
        setShowOverlay(true);
        setOverlayFade(false);
        requestAnimationFrame(() => requestAnimationFrame(() => setOverlayFade(true)));
      }
    };

    const onDone = () => {
      // Fade in new page
      requestAnimationFrame(() => requestAnimationFrame(() => setPageVisible(true)));

      // Dismiss overlay
      setTimeout(() => {
        setOverlayFade(false);
        setTimeout(() => setShowOverlay(false), 400);
      }, 480);
    };

    const onError = () => {
      setPageVisible(true);
      setShowOverlay(false);
    };

    router.events.on('routeChangeStart', onStart);
    router.events.on('routeChangeComplete', onDone);
    router.events.on('routeChangeError', onError);
    return () => {
      router.events.off('routeChangeStart', onStart);
      router.events.off('routeChangeComplete', onDone);
      router.events.off('routeChangeError', onError);
    };
  }, [router]);

  return (
    <>
      {/* Splash overlay for business/consumer boundary */}
      {showOverlay && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            opacity: overlayFade ? 1 : 0,
            transition: 'opacity 0.38s cubic-bezier(0.16, 1, 0.3, 1)',
            background: toBusiness ? '#0a0a0a' : '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: toBusiness
              ? 'linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)'
              : 'linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }} />
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%,-50%)',
            width: '500px', height: '500px', borderRadius: '50%',
            background: toBusiness
              ? 'radial-gradient(ellipse, rgba(10,132,255,0.12) 0%, transparent 70%)'
              : 'radial-gradient(ellipse, rgba(10,132,255,0.07) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative', textAlign: 'center' }}>
            <p style={{ fontSize: '1.75rem', fontWeight: 900, color: toBusiness ? '#ffffff' : '#0a0a0a', letterSpacing: '-0.03em', marginBottom: '4px' }}>
              ScheduleMe
            </p>
            <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#0A84FF' }}>
              {toBusiness ? 'for Business' : 'for Everyone'}
            </p>
          </div>
        </div>
      )}

      {/* Page fade wrapper */}
      <div style={{
        opacity: pageVisible ? 1 : 0,
        transform: pageVisible ? 'translateY(0)' : 'translateY(6px)',
        transition: 'opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1), transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <Component {...pageProps} />
      </div>
    </>
  );
}
