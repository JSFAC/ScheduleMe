// pages/_app.tsx
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import '../styles/globals.css';

const isBiz = (url: string) => url.startsWith('/business') || url.startsWith('/auth');

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayFade, setOverlayFade] = useState(false);
  const [toBusiness, setToBusiness] = useState(false);
  // We track scroll position and restore it ourselves so Next's
  // built-in scroll-restoration doesn't cause the jarring jump.
  const scrollRef = useRef(0);

  // Fade in on first mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    // Disable Next.js default scroll restoration so we control it
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    const onStart = (url: string) => {
      scrollRef.current = window.scrollY;
      setVisible(false);
      if (isBiz(router.asPath) !== isBiz(url)) {
        setToBusiness(isBiz(url));
        setShowOverlay(true);
        setOverlayFade(false);
        requestAnimationFrame(() => requestAnimationFrame(() => setOverlayFade(true)));
      }
    };

    const onDone = () => {
      // Scroll to top instantly (no smooth) so there's no visible position jump
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      setTimeout(() => {
        setOverlayFade(false);
        setTimeout(() => setShowOverlay(false), 350);
      }, 450);
    };

    const onError = () => { setVisible(true); setShowOverlay(false); };

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
      {showOverlay && (
        <div aria-hidden="true" style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          opacity: overlayFade ? 1 : 0,
          transition: 'opacity 0.32s ease',
          background: toBusiness ? '#0a0a0a' : '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: toBusiness
              ? 'linear-gradient(to right,rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.02) 1px,transparent 1px)'
              : 'linear-gradient(to right,rgba(0,0,0,0.03) 1px,transparent 1px),linear-gradient(to bottom,rgba(0,0,0,0.03) 1px,transparent 1px)',
            backgroundSize: '48px 48px',
          }} />
          <div style={{ position: 'relative', textAlign: 'center' }}>
            <p style={{ fontSize: '1.75rem', fontWeight: 900, color: toBusiness ? '#fff' : '#0a0a0a', letterSpacing: '-0.03em', marginBottom: 4 }}>ScheduleMe</p>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#0A84FF' }}>
              {toBusiness ? 'for Business' : 'for Everyone'}
            </p>
          </div>
        </div>
      )}

      {/* Pure opacity fade — absolutely no transform/translate */}
      <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.15s ease' }}>
        <Component {...pageProps} />
      </div>
    </>
  );
}
