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

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const appLinks = [
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

  return (
    <header className={`fixed top-0 left-0 right-0 z-40 border-b ${isDark ? 'bg-neutral-900/95 backdrop-blur-md border-neutral-800' : 'bg-white/95 backdrop-blur-md border-neutral-150 shadow-[0_1px_0_0_rgba(0,0,0,0.07)]'}`}>
      <nav className="mx-auto max-w-6xl px-6 flex items-center justify-between h-[72px]" aria-label="Main navigation">

        {/* Logo — left-anchored in flex-1 so center links never push it */}
        <div className="flex-1 flex items-center min-w-0">
          <Link href={user ? '/home' : '/'} scroll={false} className="group shrink-0" aria-label="ScheduleMe home">
            <span className={`text-xl font-black tracking-tight group-hover:opacity-70 transition-opacity ${isDark ? 'text-white' : 'text-neutral-900'}`} style={{ letterSpacing: '-0.03em' }}>
              Schedule<span className="text-accent">Me</span>
            </span>
          </Link>
        </div>

        {/* Center nav */}
        <ul className="hidden md:flex items-center gap-1 shrink-0" role="list">
          {navLinks.map((link) => {
            const isActive = router.pathname === link.href || router.pathname === link.href.split('#')[0];
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
        <div className="flex-1 flex items-center justify-end">
          {!user && (
            <Link href="/business" scroll={false} className={`hidden sm:block text-sm font-medium transition-colors ${isDark ? 'text-neutral-300 hover:text-white' : 'text-neutral-500 hover:text-neutral-800'}`}>
              For Businesses
            </Link>
          )}
          {/* Account pill + dark mode toggle side by side */}
          <div className="flex items-center justify-end gap-1.5">
            <button onClick={toggleDark} aria-label="Toggle dark mode"
              className="flex items-center gap-1.5 px-2 py-1 rounded-full h-[34px] shrink-0"
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
          <div className="flex items-center justify-end">
            {user ? (
              <div className="relative" ref={menuRef}>
                <button onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-neutral-200 hover:border-neutral-300 bg-white hover:bg-neutral-50 transition-colors"
                  aria-label="Account menu">
                  <div className="h-7 w-7 rounded-full bg-accent flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                    {initials}
                  </div>
                  <svg className={`h-3 w-3 text-neutral-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {menuOpen && (
                  <div className="fixed z-[200]" style={{ top: 72, right: 'max(calc(50% - 576px + 24px), 24px)' }}>
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
              <Link href="/signin" scroll={false} className="btn-primary text-sm px-4 py-2.5 w-full text-center whitespace-nowrap">
                Sign up
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
