// @ts-nocheck
// components/Nav.tsx
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useDm } from '../lib/DarkModeContext';
import BrandRouteLoader from './BrandRouteLoader';

interface NavProps { variant?: 'light' | 'dark'; }

function getSupabase() {
  if (typeof window === 'undefined') return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Cache key — avoids async flash that causes the nav layout shift/shake
const AUTH_CACHE_KEY = 'sm_nav_user';

function readCache(): { email?: string; name?: string } | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(sessionStorage.getItem(AUTH_CACHE_KEY) || 'null'); } catch { return null; }
}
function writeCache(u: { email?: string; name?: string } | null) {
  if (typeof window === 'undefined') return;
  if (u) sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(u));
  else sessionStorage.removeItem(AUTH_CACHE_KEY);
}

const CONSUMER_TOUR_STEPS = [
  {
    path: '/home',
    icon: 'home',
    title: 'Home, your command center',
    body: 'See top-rated providers, quick-response pros, and personalized suggestions in one place.',
    cta: 'Next',
  },
  {
    path: '/browse',
    icon: 'browse',
    title: 'Browse with confidence',
    body: 'Filter by category, compare ratings, and find the right provider in seconds.',
    cta: 'Next',
  },
  {
    path: '/bookings',
    icon: 'bookings',
    title: 'Track every booking',
    body: 'Create requests and monitor progress from pending to completed without losing details.',
    cta: 'Next',
  },
  {
    path: '/messages',
    icon: 'messages',
    title: 'Stay in sync with pros',
    body: 'Keep confirmations, updates, and questions in one clean thread.',
    cta: 'Finish tour',
  },
] as const;

export default function Nav({ variant = 'light' }: NavProps) {
  const isDark = variant === 'dark';
  const router = useRouter();
  const { dm: darkMode, toggle: toggleDark } = useDm();

  // Update theme-color meta instantly when dark mode toggles
  useEffect(() => {
    const meta = document.getElementById('theme-color-meta') as HTMLMetaElement | null;
    if (meta) meta.content = (isDark || darkMode) ? '#0F1117' : '#EDF5FF';
  }, [darkMode, isDark]);
  // Initialise from cache synchronously — no layout shift on mount
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(readCache);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [routeTransitioning, setRouteTransitioning] = useState(false);
  const tourTargetPath = tourActive ? CONSUMER_TOUR_STEPS[tourStep]?.path : null;
  const tourStepData = CONSUMER_TOUR_STEPS[tourStep];

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    // Verify cache against real session (silently, no re-render if same)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ? {
        email: session.user.email,
        name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
      } : null;
      writeCache(u);
      // Only trigger re-render if value actually changed
      setUser(prev => {
        if (JSON.stringify(prev) === JSON.stringify(u)) return prev;
        return u;
      });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ? {
        email: session.user.email,
        name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
      } : null;
      writeCache(u);
      setUser(u);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const [signingOut, setSigningOut] = useState(false);
  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setMenuOpen(false);
    const supabase = getSupabase();
    if (supabase) {
      try {
        await Promise.race([
          supabase.auth.signOut(),
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
      } catch {
        // Continue with local cleanup even if remote sign-out request fails.
      }
    }
    writeCache(null);
    setUser(null);
    try {
      await router.replace('/');
    } finally {
      setTimeout(() => setSigningOut(false), 500);
    }
  }

  useEffect(() => {
    if (!user?.email) {
      setTourActive(false);
      setTourStep(0);
      return;
    }
    const emailKey = user.email.toLowerCase();
    const doneKey = `sm_consumer_tour_done_${emailKey}`;
    const activeKey = `sm_consumer_tour_active_${emailKey}`;
    const stepKey = `sm_consumer_tour_step_${emailKey}`;
    const isDone = localStorage.getItem(doneKey) === '1';
    if (isDone) {
      setTourActive(false);
      return;
    }

    const hasActive = localStorage.getItem(activeKey) === '1';
    const saved = Number(localStorage.getItem(stepKey) || 0);
    const safeSaved = Number.isFinite(saved) ? Math.max(0, Math.min(saved, CONSUMER_TOUR_STEPS.length - 1)) : 0;
    const pathIdx = CONSUMER_TOUR_STEPS.findIndex((s) => s.path === router.pathname);

    if (!hasActive) {
      localStorage.setItem(activeKey, '1');
      localStorage.setItem(stepKey, '0');
      setTourStep(0);
      setTourActive(true);
      if (router.pathname !== '/home') {
        router.push('/home', undefined, { scroll: false });
      }
      return;
    }

    setTourActive(true);
    if (pathIdx >= 0) {
      setTourStep(pathIdx);
      localStorage.setItem(stepKey, String(pathIdx));
    } else {
      setTourStep(safeSaved);
    }
  }, [user?.email, router.pathname]);

  useEffect(() => {
    const start = () => setRouteTransitioning(true);
    const done = () => setTimeout(() => setRouteTransitioning(false), 120);
    router.events.on('routeChangeStart', start);
    router.events.on('routeChangeComplete', done);
    router.events.on('routeChangeError', done);
    return () => {
      router.events.off('routeChangeStart', start);
      router.events.off('routeChangeComplete', done);
      router.events.off('routeChangeError', done);
    };
  }, [router.events]);

  function finishTour() {
    if (user?.email) {
      const emailKey = user.email.toLowerCase();
      localStorage.setItem(`sm_consumer_tour_done_${emailKey}`, '1');
      localStorage.removeItem(`sm_consumer_tour_active_${emailKey}`);
      localStorage.removeItem(`sm_consumer_tour_step_${emailKey}`);
    }
    setTourActive(false);
  }

  function nextTourStep() {
    if (tourStep >= CONSUMER_TOUR_STEPS.length - 1) {
      finishTour();
      return;
    }
    const next = tourStep + 1;
    setTourStep(next);
    if (user?.email) {
      const emailKey = user.email.toLowerCase();
      localStorage.setItem(`sm_consumer_tour_step_${emailKey}`, String(next));
    }
    router.push(CONSUMER_TOUR_STEPS[next].path, undefined, { scroll: false });
  }

  function getTourIcon(icon: string) {
    if (icon === 'browse') {
      return (
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      );
    }
    if (icon === 'bookings') {
      return (
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25M3 18.75A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75" />
        </svg>
      );
    }
    if (icon === 'messages') {
      return (
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      );
    }
    return (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
      </svg>
    );
  }

  function renderTabIcon(path: string, col: string, isActive: boolean) {
    const strokeWidth = isActive ? 2.2 : 1.8;
    if (path === '/campus') {
      return (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={col} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 14.25L3 9l9-5.25L21 9l-9 5.25z" />
          <path d="M21 9v4.5" />
          <path d="M6.75 11.25v4.25c0 .72 2.24 2.5 5.25 2.5s5.25-1.78 5.25-2.5v-4.25" />
        </svg>
      );
    }
    if (path === '/home') {
      return (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={col} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12" />
          <path d="M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
        </svg>
      );
    }
    if (path === '/browse') {
      return (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={col} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      );
    }
    if (path === '/bookings') {
      return (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={col} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
        </svg>
      );
    }
    return (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={col} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    );
  }

  // Cache edu_verified in localStorage so Campus tab never flashes on/off between pages
  const EDU_CACHE_KEY = 'sm_edu_verified';
  const [isBiz, setIsBiz] = useState(false);
  const [eduVerified, setEduVerified] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(EDU_CACHE_KEY) === 'true';
  });

  useEffect(() => {
    if (!user?.email) {
      setIsBiz(false);
      return;
    }
    // Check if user owns a business
    const sbBiz = getSupabase();
    const supabase = getSupabase();
    if (!sbBiz || !supabase) return;
    sbBiz.from('businesses').select('id').eq('owner_email', user.email).maybeSingle().then(({data}) => setIsBiz(!!data?.id));
    supabase.from('profiles').select('edu_verified').eq('email', user.email).maybeSingle()
      .then(({ data }) => {
        const verified = data?.edu_verified === true;
        setEduVerified(verified);
        localStorage.setItem(EDU_CACHE_KEY, String(verified));
      });
  }, [user?.email]);

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const appLinks = [
    ...(user && eduVerified ? [{ label: '🎓 Campus', href: '/campus' }] : []),
    { label: 'Home', href: '/home' },
    { label: 'Browse', href: '/browse' },
    { label: 'Bookings', href: '/bookings' },
    { label: 'Messages', href: '/messages' },
  ];
  const guestAppLinks = [
    { label: 'Home', href: '/home' },
    { label: 'Browse', href: '/browse' },
    { label: 'Bookings', href: '/bookings' },
    { label: 'Messages', href: '/messages' },
  ];
  const marketingLinks = [
    { label: 'Features', href: '/#features' },
    { label: 'How It Works', href: '/#how-it-works' },
    { label: 'Pricing', href: '/#pricing' },
    { label: 'FAQ', href: '/#faq' },
  ];
  const isLandingGuest = !user && router.pathname === '/';
  const isSigninGuestAppShell = !user && router.pathname === '/signin' && router.query.shell === 'app';
  const isGuestAppShell = !user && (
    router.pathname === '/home' ||
    router.pathname === '/browse' ||
    router.pathname === '/bookings' ||
    router.pathname === '/messages' ||
    router.pathname === '/biz/[slug]' ||
    isSigninGuestAppShell
  );
  const navLinks = user ? appLinks : (isGuestAppShell ? guestAppLinks : marketingLinks);
  const logoHref = (user || isGuestAppShell || isLandingGuest) ? '/home' : '/';
  const useSolidChrome = user || isGuestAppShell;
  const navBg = (isDark || darkMode) ? '#0a0a0a' : '#ffffff';
  const navBlur = useSolidChrome ? 'none' : 'blur(12px)';
  const useProviderLoader = router.pathname.startsWith('/provider') || router.pathname.startsWith('/business');

  return (
    <>
      <style jsx global>{`
        @keyframes sm-tour-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(15, 118, 110, 0.38); }
          50% { box-shadow: 0 0 0 8px rgba(15, 118, 110, 0); }
        }
      `}</style>
      {signingOut && <BrandRouteLoader audience={useProviderLoader ? 'provider' : 'consumer'} message="Signing out..." />}
      {routeTransitioning && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-[80] transition-opacity duration-300"
          style={{
            opacity: 1,
            background: darkMode ? 'rgba(8,8,8,0.16)' : 'rgba(15,23,42,0.08)',
            backdropFilter: 'blur(1.5px)',
            WebkitBackdropFilter: 'blur(1.5px)',
          }}
        />
      )}
      {/* Safe-area color fill — same style as header for perfect match */}
      <div aria-hidden="true" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 41,
        height: 'env(safe-area-inset-top, 0px)',
        background: navBg,
        backdropFilter: navBlur,
        WebkitBackdropFilter: navBlur,
        transition: 'background 0.15s ease',
      }} />
      <header className={`fixed left-0 right-0 z-40 border-b ${isDark || darkMode ? 'border-neutral-800' : 'border-neutral-150 shadow-[0_1px_0_0_rgba(0,0,0,0.07)]'}`}
        style={{
          top: 'env(safe-area-inset-top, 0px)',
          background: navBg,
          backdropFilter: navBlur,
          WebkitBackdropFilter: navBlur,
          transition: 'background 0.15s ease',
        }}>
      <nav className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between" style={{ height: "clamp(48px, 4vw, 60px)" }} aria-label="Main navigation">

        {/* Logo — left-anchored in flex-1 so center links never push it */}
        <div className="flex-1 flex items-center min-w-0">
          <Link href={logoHref} scroll={false} className="group shrink-0" aria-label="ScheduleMe home">
            <span className={`font-black tracking-tight group-hover:opacity-70 transition-opacity ${isDark ? 'text-white' : 'text-neutral-900'} text-xl md:text-2xl`} style={{ letterSpacing: '-0.03em' }}>
              Schedule<span className="text-accent">Me</span>
            </span>
          </Link>
        </div>

        {/* Center nav */}
        <ul className="hidden md:flex items-center gap-1 shrink-0" role="list">
          {navLinks.map((link) => {
            const isActive = !link.href.includes('#') && (router.pathname === link.href || router.pathname === link.href.split('?')[0]);
            const isTourTarget = tourActive && link.href === tourTargetPath;
            return (
              <li key={link.href}>
                <Link href={link.href} scroll={false} className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                  isActive
                    ? isDark || darkMode ? 'text-white bg-accent' : 'text-accent bg-accent-light'
                    : isDark || darkMode ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`} style={isTourTarget ? { animation: 'sm-tour-pulse 1.5s ease-in-out infinite' } : undefined}>
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Right */}
        <div className="flex-1 flex items-center justify-end gap-2">
          {!user && !isGuestAppShell && (
            <Link href="/provider" scroll={false} className={`hidden sm:block text-sm font-medium transition-colors ${isDark ? 'text-neutral-300 hover:text-white' : 'text-neutral-500 hover:text-neutral-800'}`}>
              For Providers
            </Link>
          )}
          {/* Dark mode toggle — only shown when signed in */}
          {user && (
            <button onClick={toggleDark} aria-label="Toggle dark mode"
              className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-full h-[34px] shrink-0"
              style={{ background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', transition: 'background 0.25s ease' }}>
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                style={{ color: darkMode ? 'white' : '#525252', transition: 'color 0.25s ease' }}>
                {darkMode
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                }
              </svg>
              <div className="relative w-8 h-4 rounded-full shrink-0"
                style={{ background: darkMode ? '#0F766E' : '#d1d5db', transition: 'background 0.25s ease' }}>
                <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm"
                  style={{ left: darkMode ? '17px' : '2px', transition: 'left 0.25s ease' }} />
              </div>
            </button>
          )}
          {/* Account pill */}
          {user ? (
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1.5 pl-1 pr-3 py-1 md:py-1.5 rounded-full border border-neutral-200 hover:border-neutral-300 bg-white hover:bg-neutral-50 transition-colors"
                aria-label="Account menu">
                <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-accent flex items-center justify-center text-white text-[11px] md:text-[12px] font-bold shrink-0">
                  {initials}
                </div>
                <svg className={`h-3 w-3 text-neutral-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 z-[200]">
                  <div className="w-[min(22rem,calc(100vw-2rem))] sm:w-56 rounded-2xl bg-white border border-neutral-100 shadow-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-neutral-50">
                      <p className="text-xs font-semibold text-neutral-700 truncate">{user.name}</p>
                      <p className="text-xs text-neutral-400 truncate">{user.email}</p>
                    </div>
                    <div className="p-1.5">
                      <Link href="/account" scroll={false} onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                        <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        My Account
                      </Link>
                      {isBiz && <Link href="/provider/dashboard" scroll={false} onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                        <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 2.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                        </svg>
                        Provider Hub
                      </Link>}
                      {!isBiz && <Link href="/provider/signup" scroll={false} onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"><svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>Become a Provider</Link>}
                      <Link href="/" scroll={false} onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                        <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                        </svg>
                        Landing Page
                      </Link>
                      <div className="h-px bg-neutral-100 mx-3 my-1" />
                      <button onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : isGuestAppShell ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1.5 pl-1 pr-3 py-1 md:py-1.5 rounded-full border border-neutral-200 hover:border-neutral-300 bg-white hover:bg-neutral-50 transition-colors"
                aria-label="Guest menu"
              >
                <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                  <svg className="h-4 w-4 md:h-4.5 md:w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a8.25 8.25 0 0114.998 0" />
                  </svg>
                </div>
                <svg className={`h-3 w-3 text-neutral-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 z-[200]">
                  <div className="w-[min(22rem,calc(100vw-2rem))] sm:w-56 rounded-2xl bg-white border border-neutral-100 shadow-xl overflow-hidden">
                    <div className="p-1.5">
                      <Link href="/signin?mode=login" scroll={false} onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                        <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                        </svg>
                        Sign in
                      </Link>
                      <Link href="/signin?mode=signup" scroll={false} onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                        <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v9a2.25 2.25 0 01-2.25 2.25h-7.5A2.25 2.25 0 016 16.5v-9m12 0V6A2.25 2.25 0 0015.75 3.75h-7.5A2.25 2.25 0 006 6v1.5m12 0H6m6 3v6m-3-3h6" />
                        </svg>
                        Create account
                      </Link>
                      <Link href="/provider" scroll={false} onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                        <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                        For Providers
                      </Link>
                      <Link href="/" scroll={false} onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                        <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                        </svg>
                        Landing Page
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/signin?mode=login" scroll={false}
                className={`text-sm px-4 py-1 md:py-2 text-center whitespace-nowrap rounded-full font-semibold border transition-colors ${
                  isDark || darkMode
                    ? 'text-white border-white/20 hover:bg-white/10'
                    : 'text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                }`}>
                Log in
              </Link>
              <Link href="/signin?mode=signup" scroll={false} className="btn-primary text-sm px-4 py-1 md:py-2 text-center whitespace-nowrap rounded-full">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
      {user && tourActive && tourStepData && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-[85] pointer-events-none"
            style={{ background: darkMode ? 'rgba(0,0,0,0.48)' : 'rgba(17,24,39,0.12)' }}
          />
          <div
            className="fixed left-0 right-0 z-[90] px-3 md:px-0"
            style={{ top: 'env(safe-area-inset-top, 0px)', pointerEvents: 'none' }}
          >
            <div
              className={`mx-auto w-full max-w-[500px] rounded-2xl border p-2 md:p-2.5 shadow-2xl ${darkMode ? 'border-white/15' : 'border-neutral-200'}`}
              style={{
                pointerEvents: 'auto',
                background: darkMode ? '#171717' : '#ffffff',
              }}
            >
            <div className="mb-1 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: darkMode ? 'rgba(255,255,255,0.62)' : '#6b7280' }}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${darkMode ? 'bg-accent/30 text-[#9ee6dc]' : 'bg-accent-light text-accent'}`}>
                  {getTourIcon(tourStepData.icon)}
                </span>
                Quick tour
              </div>
              <span className="text-xs font-semibold" style={{ color: darkMode ? 'rgba(255,255,255,0.62)' : '#6b7280' }}>
                {tourStep + 1}/{CONSUMER_TOUR_STEPS.length}
              </span>
            </div>
            <h3 className={`text-[0.9rem] font-black ${darkMode ? 'text-white' : 'text-neutral-900'}`} style={{ letterSpacing: '-0.02em', lineHeight: 1.12 }}>
              {tourStepData.title}
            </h3>
            <div className="mt-1 mb-1.5 flex items-center gap-1.5">
              {CONSUMER_TOUR_STEPS.map((_, idx) => (
                <span
                  key={idx}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: idx === tourStep ? 22 : 8,
                    background: idx === tourStep ? '#0F766E' : (darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(17,24,39,0.16)'),
                  }}
                />
              ))}
            </div>
            <p className="mb-1.5 text-[11.5px] leading-snug" style={{ color: darkMode ? 'rgba(255,255,255,0.72)' : '#4b5563' }}>
              {tourStepData.body}
            </p>
            <button
              onClick={nextTourStep}
              className="w-full rounded-xl px-4 py-1.5 text-[13px] font-black text-white transition-transform active:scale-[0.99]"
              style={{ background: 'linear-gradient(135deg,#0F766E 0%, #0B5C56 100%)' }}
            >
              {tourStepData.cta}
            </button>
            <button
              onClick={finishTour}
              className="mt-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
              style={{ color: darkMode ? 'rgba(255,255,255,0.62)' : '#6b7280' }}
            >
              Skip tour
            </button>
            </div>
          </div>
        </>
      )}
      {/* Mobile bottom tab bar — outside header to avoid fixed-in-fixed stacking issues */}
      {(user || isGuestAppShell) && (
        <div className="md:hidden" style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          pointerEvents: 'none',
          padding: '0 12px calc(env(safe-area-inset-bottom, 0px) + 8px)',
        }}>
          <div style={{
            display: 'flex',
            height: 68,
            alignItems: 'center',
            width: '100%',
            maxWidth: 560,
            margin: '0 auto',
            borderRadius: 30,
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.11)'}`,
            background: darkMode ? 'rgba(23,23,23,0.9)' : 'rgba(255,255,255,0.92)',
            boxShadow: darkMode ? '0 10px 24px rgba(0,0,0,0.35)' : '0 10px 28px rgba(15,23,42,0.14)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            pointerEvents: 'auto',
            padding: '0 6px',
          }}>
            {[...(user ? appLinks : guestAppLinks)].map((link) => {
              const isActive = router.pathname === link.href;
              const isTourTarget = tourActive && link.href === tourTargetPath;
              const col = isActive ? '#0F766E' : (darkMode ? 'rgba(255,255,255,0.56)' : '#6b7280');
              return (
                <Link key={link.href} href={link.href} scroll={false} style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 4, color: col, textDecoration: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  borderRadius: 18,
                  height: 56,
                  transition: 'background 0.18s ease',
                  background: isActive ? (darkMode ? 'rgba(15,118,110,0.28)' : 'rgba(15,118,110,0.14)') : 'transparent',
                  animation: isTourTarget ? 'sm-tour-pulse 1.5s ease-in-out infinite' : undefined,
                }}>
                  {renderTabIcon(link.href, col, isActive)}
                  <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 600, color: col }}>{link.label.replace('🎓 ', '')}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
