// components/Nav.tsx
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

interface NavProps {
  variant?: 'light' | 'dark';
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function Nav({ variant = 'light' }: NavProps) {
  const isDark = variant === 'dark';
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
        });
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
        });
      } else {
        setUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleSignOut() {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    setUser(null);
    setMenuOpen(false);
    router.push('/');
  }

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-40 border-b transition-colors ${isDark ? 'bg-neutral-900/90 backdrop-blur-md border-neutral-800' : 'bg-white/85 backdrop-blur-md border-neutral-100'}`}>
        <nav className="mx-auto max-w-6xl px-6 flex items-center justify-between" style={{ height: '72px' }} aria-label="Main navigation">
          <Link href="/" className="group" aria-label="ScheduleMe home">
            <span className={`text-2xl font-black tracking-tight transition-opacity group-hover:opacity-70 ${isDark ? 'text-white' : 'text-neutral-900'}`} style={{ letterSpacing: '-0.03em' }}>
              ScheduleMe
            </span>
          </Link>

          <ul className="hidden md:flex items-center gap-1" role="list">
            {[
              { label: 'Features', href: '/#features' },
              { label: 'How It Works', href: '/#how-it-works' },
              { label: 'Pricing', href: '/pricing' },
              { label: 'FAQ', href: '/#faq' },
            ].map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-neutral-300 hover:text-white hover:bg-neutral-800' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'}`}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            <Link href="/business" className={`hidden sm:block text-sm font-medium transition-colors ${isDark ? 'text-neutral-300 hover:text-white' : 'text-neutral-500 hover:text-neutral-800'}`}>
              For Businesses
            </Link>

            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-neutral-200 hover:border-neutral-300 bg-white hover:bg-neutral-50 transition-all"
                  aria-label="Account menu"
                >
                  <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {initials}
                  </div>
                  <span className="text-sm font-medium text-neutral-700 hidden sm:block max-w-[120px] truncate">
                    {user.name}
                  </span>
                  <svg className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white border border-neutral-100 shadow-xl overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-neutral-50">
                      <p className="text-xs text-neutral-400 truncate">{user.email}</p>
                    </div>
                    <div className="p-1.5">
                      <Link href="/account" onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                        <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        My Account
                      </Link>
                      <Link href="/bookings" onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                        <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                        My Bookings
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
                )}
              </div>
            ) : (
              <Link href="/signin" className="btn-primary text-sm px-5 py-2.5" style={{ transition: 'opacity 0.2s ease, transform 0.2s ease' }}>
                Sign Up / Log In
              </Link>
            )}
          </div>
        </nav>
      </header>
    </>
  );
}
