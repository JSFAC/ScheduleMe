// pages/_app.tsx
import type { AppProps } from 'next/app';
import { Analytics } from '@vercel/analytics/react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import '../styles/globals.css';
import { DarkModeProvider } from '../lib/DarkModeContext';

const isBiz = (url: string) => url.startsWith('/business') || url.startsWith('/auth');

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayFade, setOverlayFade] = useState(false);
  const [toBusiness, setToBusiness] = useState(false);
  const isTransitioning = useRef(false);
  // We track scroll position and restore it ourselves so Next's
  // built-in scroll-restoration doesn't cause the jarring jump.
  const scrollRef = useRef(0);

  // Sync theme-color meta tag with dark mode OS preference in real time
  useEffect(() => {
    function updateThemeColor() {
      const isDark = document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', isDark ? '#0a0a0a' : '#EDF5FF');
    }
    updateThemeColor();
    const observer = new MutationObserver(updateThemeColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', updateThemeColor);
    return () => { observer.disconnect(); mq.removeEventListener('change', updateThemeColor); };
  }, []);

  // Fade in on first mount + set theme-color from localStorage immediately
  useEffect(() => {
    const isDark = localStorage.getItem('sm_dark_mode') === 'true';
    const meta = document.getElementById('theme-color-meta') as HTMLMetaElement | null;
    if (meta) meta.content = isDark ? '#0a0a0a' : '#EDF5FF';
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    // Disable Next.js default scroll restoration so we control it
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    const onStart = (url: string) => {
      scrollRef.current = window.scrollY;
      if (isBiz(router.asPath) !== isBiz(url)) {
        // Business/consumer transition — show overlay for full duration
        isTransitioning.current = true;
        setVisible(false);
        setToBusiness(isBiz(url));
        setShowOverlay(true);
        setOverlayFade(false);
        requestAnimationFrame(() => requestAnimationFrame(() => setOverlayFade(true)));
      }
    };

    const onDone = () => {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      if (isTransitioning.current) {
        isTransitioning.current = false;
        // Keep overlay showing briefly so no gap, then fade out with page
        setTimeout(() => {
          setVisible(true);
          setOverlayFade(false);
          setTimeout(() => setShowOverlay(false), 380);
        }, 200);
      } else {
        setVisible(true);
      }
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
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#EDF5FF" id="theme-color-meta" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var dark = localStorage.getItem('sm_dark_mode') === 'true';
              var meta = document.getElementById('theme-color-meta');
              if (meta) meta.content = dark ? '#0a0a0a' : '#EDF5FF';
              if (dark) document.documentElement.classList.add('dark');
              document.documentElement.style.overflowX = 'hidden';
              document.body && (document.body.style.overflowX = 'hidden');
            } catch(e) {}
          })();
        `}} />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ScheduleMe" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </Head>
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
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#0A84FF', marginBottom: 20 }}>
              {toBusiness ? 'for Business' : 'for Everyone'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                border: '2px solid rgba(10,132,255,0.25)',
                borderTopColor: '#0A84FF',
                animation: 'spin 0.7s linear infinite',
              }} />
            </div>
          </div>
        </div>
      )}

      <div style={{ opacity: visible ? 1 : 0, transition: showOverlay ? (visible ? 'opacity 0.28s ease' : 'opacity 0.18s ease') : 'none' }}>
        <DarkModeProvider>
          <Component {...pageProps} />
        </DarkModeProvider>
      </div>
      <Analytics />
    </>
  );
}
