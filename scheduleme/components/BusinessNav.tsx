// components/BusinessNav.tsx
import Link from 'next/link';

export default function BusinessNav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-neutral-950/95 backdrop-blur-md border-b border-neutral-800">
      <nav className="mx-auto max-w-6xl px-6 flex items-center justify-between" style={{ height: '72px' }} aria-label="Business navigation">
        <Link href="/business" className="group flex flex-col leading-none" aria-label="ScheduleMe for Business">
          <span className="text-xl font-black text-white transition-opacity group-hover:opacity-70" style={{ letterSpacing: '-0.03em' }}>
            ScheduleMe
          </span>
          <span className="text-[10px] font-semibold tracking-widest uppercase text-accent mt-0.5">
            for Business
          </span>
        </Link>

        <ul className="hidden md:flex items-center gap-1" role="list">
          {[
            { label: 'Why Join', href: '/business#why' },
            { label: 'How It Works', href: '/business#how' },
            { label: 'Pricing', href: '/business/pricing' },
            { label: 'FAQ', href: '/business#faq' },
          ].map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="px-4 py-2 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <Link href="/" className="hidden sm:block text-sm text-neutral-400 hover:text-neutral-200 transition-colors">
            Consumer site →
          </Link>
          <Link href="/auth/login" className="hidden sm:block text-sm font-semibold px-4 py-2 rounded-lg bg-neutral-800 text-neutral-200 hover:bg-neutral-700 border border-neutral-700 transition-colors">
            Log In
          </Link>
          <Link href="/business/signup" className="btn-primary text-sm px-5 py-2.5">
            Join for Free
          </Link>
        </div>
      </nav>
    </header>
  );
}
