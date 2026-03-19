// components/Nav.tsx
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useDm } from '../lib/DarkModeContext';

interface NavProps { variant?: 'light' | 'dark'; }

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
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

  useEffect(() => {
    const supabase = getSupabase();
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

  async function handleSignOut() {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    writeCache(null);
    setUser(null);
    setMenuOpen(false);
    router.push('/');
  }

  // Cache edu_verified in localStorage so Campus tab never flashes on/off between pages
  const EDU_CACHE_KEY = 'sm_edu_verified';
  const [eduVerified, setEduVerified] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(EDU_CACHE_KEY) === 'true';
  });

  useEffect(() => {
    if (!user?.email) return;
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
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
    ...(eduVerified ? [{ label: '🎓 Campus', href: '/campus' }] : []),
    { label: 'Home', href: '/home' },
    { label: 'Browse', href: '/browse' },
    { label: 'Bookings', href: '/bookings' },
    { label: 'Messages', href: '/messages' },
  ];
  const marketingLinks = [
    { label: 'Features', href: '/#features' },
    { label: 'How It Works', href: '/#how-it-works' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'FAQ', href: '/#faq' },
  ];
  const navLinks = user ? appLinks : marketingLinks;

  const navBg = (isDark || darkMode) ? 'rgba(15,17,23,0.97)' : 'rgba(255,255,255,0.97)';
  const navFill = (isDark || darkMode) ? '#0F1117' : '#ffffff';
  const navBorder = (isDark || darkMode) ? '#262626' : 'rgba(0,0,0,0.07)';

  return (
    <>
      {/* Safe-area color fill — same style as header for perfect match */}
      <div aria-hidden="true" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 41,
        height: 'env(safe-area-inset-top, 0px)',
        background: navBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        transition: 'background 0.15s ease',
      }} />
      <header className={`fixed left-0 right-0 z-40 border-b ${isDark || darkMode ? 'border-neutral-800' : 'border-neutral-150 shadow-[0_1px_0_0_rgba(0,0,0,0.07)]'}`}
        style={{
          top: 'env(safe-area-inset-top, 0px)',
          background: navBg,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          transition: 'background 0.15s ease',
        }}>
      <nav className="mx-auto max-w-6xl px-6 flex items-center justify-between" style={{ height: "clamp(48px, 4vw, 60px)" }} aria-label="Main navigation">

        {/* Logo — left-anchored in flex-1 so center links never push it */}
        <div className="flex-1 flex items-center min-w-0">
          <Link href={user ? '/home' : '/'} scroll={false} className="group shrink-0" aria-label="ScheduleMe home">
            <span className={`font-black tracking-tight group-hover:opacity-70 transition-opacity ${isDark ? 'text-white' : 'text-neutral-900'} text-2xl md:text-3xl`} style={{ letterSpacing: '-0.04em' }}>
              Schedule<span className="text-accent">Me</span>
            </span>
          </Link>
        </div>

        {/* Center nav */}
        <ul className="hidden md:flex items-center gap-1 shrink-0" role="list">
          {navLinks.map((link) => {
            const isActive = !link.href.includes('#') && (router.pathname === link.href || router.pathname === link.href.split('?')[0]);
            return (
              <li key={link.href}>
                <Link href={link.href} scroll={false} className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                  isActive
                    ? isDark || darkMode ? 'text-white bg-accent' : 'text-accent bg-blue-50'
                    : isDark || darkMode ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`}>
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Right */}
        <div className="flex-1 flex items-center justify-end gap-2">
          {!user && (
            <Link href="/business" scroll={false} className={`hidden sm:block text-sm font-medium transition-colors ${isDark ? 'text-neutral-300 hover:text-white' : 'text-neutral-500 hover:text-neutral-800'}`}>
              For Businesses
            </Link>
          )}
          {/* Dark mode toggle — mobile only (hidden on desktop) */}
          <button onClick={toggleDark} aria-label="Toggle dark mode"
            className="md:hidden flex items-center gap-1.5 px-2 py-1 rounded-full h-[34px] shrink-0"
            style={{ background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', transition: 'background 0.25s ease' }}>
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              style={{ color: darkMode ? 'white' : '#525252', transition: 'color 0.25s ease' }}>
              {darkMode
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              }
            </svg>
            <div className="relative w-8 h-4 rounded-full shrink-0"
              style={{ background: darkMode ? '#0A84FF' : '#d1d5db', transition: 'background 0.25s ease' }}>
              <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm"
                style={{ left: darkMode ? '17px' : '2px', transition: 'left 0.25s ease' }} />
            </div>
          </button>
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
                  <div className="w-56 rounded-2xl bg-white border border-neutral-100 shadow-xl overflow-hidden">
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
                      <Link href="/business/dashboard" scroll={false} onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                        <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 2.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                        </svg>
                        Business Dashboard
                      </Link>
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
          ) : (
            <Link href="/signin?mode=signup" scroll={false} className="btn-primary text-sm px-4 py-2.5 text-center whitespace-nowrap">
              Sign up
            </Link>
          )}
        </div>
      </nav>
    </header>
      {/* Mobile bottom tab bar — outside header to avoid fixed-in-fixed stacking issues */}
      {user && (
        <div className="md:hidden" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          background: darkMode ? 'rgba(10,10,10,0.97)' : 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: `1px solid ${darkMode ? '#262626' : '#f0f0f0'}`,
        }}>
          <div style={{ display: 'flex', height: 52, alignItems: 'center' }}>
            {[...appLinks].map((link) => {
              const isActive = router.pathname === link.href;
              const paths: Record<string, string> = {
                '/campus': 'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342',
                '/home': 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
                '/browse': 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
                '/bookings': 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5',
                '/messages': 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z',
                '/account': 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
              };
              const col = isActive ? '#0A84FF' : (darkMode ? 'rgba(255,255,255,0.45)' : '#9ca3af');
              return (
                <Link key={link.href} href={link.href} scroll={false} style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 3, color: col, textDecoration: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={col} strokeWidth={isActive ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d={paths[link.href] || ''} />
                  </svg>
                  <span style={{ fontSize: 9, fontWeight: 700, color: col }}>{link.label.replace('🎓 ', '')}</span>
                </Link>
              );
            })}
          </div>
          <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 2px)' }} />
        </div>
      )}
    </>
  );
}
