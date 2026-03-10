// components/Nav.tsx
import Link from 'next/link';

interface NavProps {
  variant?: 'light' | 'dark';
}

export default function Nav({ variant = 'light' }: NavProps) {
  const isDark = variant === 'dark';
  return (
    <header className={`fixed top-0 left-0 right-0 z-50 border-b transition-colors ${isDark ? 'bg-neutral-900/90 backdrop-blur-md border-neutral-800' : 'bg-white/85 backdrop-blur-md border-neutral-100'}`}>
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
          <Link href="/signin" className="btn-primary text-sm px-5 py-2.5">Get Started Free</Link>
        </div>
      </nav>
    </header>
  );
}
