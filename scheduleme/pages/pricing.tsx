// @ts-nocheck
// pages/pricing.tsx — consumer only, with dark mode support
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect } from 'react';
import Nav from '../components/Nav';
import { useDm } from '../lib/DarkModeContext';

function useReveal(selector: string, delay = 90) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
    els.forEach((el, i) => {
      el.setAttribute('data-reveal', 'hidden');
      el.style.transitionDelay = `${i * delay}ms`;
    });
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.setAttribute('data-reveal', 'visible'); io.unobserve(e.target); }
      }),
      { threshold: 0.1, rootMargin: '0px 0px -48px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [selector, delay]);
}

const Pricing: NextPage = () => {
  useReveal('.js-psec', 0);
  const { dm } = useDm();

  const bg = dm ? '#0a0a0a' : 'white';
  const textPrimary = dm ? '#f2f2f7' : '#111827';
  const textSecondary = dm ? '#8e8e93' : '#6b7280';
  const textMuted = dm ? '#6b7280' : '#9ca3af';
  const cardBg = dm ? '#1c1c1e' : 'white';
  const cardBorder = dm ? '#2c2c2e' : '#e5e7eb';
  const featureCardBg = dm ? 'rgba(10,132,255,0.12)' : '#eff6ff';
  const featureCardBorder = dm ? 'rgba(10,132,255,0.3)' : '#bfdbfe';
  const darkBannerBg = dm ? '#1c1c1e' : '#0f172a';
  const darkBannerBorder = dm ? '#2c2c2e' : 'transparent';

  return (
    <>
      <Head>
        <title>Pricing — ScheduleMe</title>
        <meta name="description" content="ScheduleMe is always free for users. No account, no credit card, no fees." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Nav />

      <main style={{ paddingTop: 72, paddingBottom: 96, background: bg, minHeight: '100vh' }}>

        {/* Header */}
        <section style={{ padding: '64px 24px', textAlign: 'center' }}>
          <div className="js-psec mx-auto" style={{ maxWidth: 720 }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#007e6d', marginBottom: 16 }}>
              Pricing
            </span>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, color: textPrimary, letterSpacing: '-0.025em', marginBottom: 20, lineHeight: 1.1 }}>
              Simple, honest pricing.
            </h1>
            <p style={{ fontSize: 18, color: textSecondary, maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
              Free for the people who need help. Businesses pay only for results.
            </p>
          </div>
        </section>

        {/* User pricing card */}
        <section style={{ padding: '0 24px', marginBottom: 64 }}>
          <div className="js-psec mx-auto" style={{ maxWidth: 640, textAlign: 'center' }}>
            <div style={{ borderRadius: 24, border: `2px solid ${featureCardBorder}`, background: featureCardBg, padding: 48, marginBottom: 40 }}>
              <p style={{ fontSize: 56, marginBottom: 24 }} aria-hidden="true">🎉</p>
              <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, color: textPrimary, letterSpacing: '-0.025em', marginBottom: 16 }}>
                Always free for users.
              </h2>
              <p style={{ fontSize: 17, color: textSecondary, marginBottom: 32, lineHeight: 1.65 }}>
                No account required. No credit card. No hidden fees.<br />
                Describe your issue and get matched with a vetted pro — completely free, every time.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 auto 40px', maxWidth: 320, textAlign: 'left' }}>
                {[
                  'AI triage of your issue',
                  'Instant matching with local pros',
                  'Real reviews and ratings',
                  'Direct contact with providers',
                  'No booking fees or commissions',
                ].map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 14, color: textSecondary }}>
                    <span style={{ color: '#007e6d', fontWeight: 800, fontSize: 16 }} aria-hidden="true">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/demo" style={{ display: 'inline-block', background: '#007e6d', color: 'white', fontWeight: 700, fontSize: 15, padding: '14px 40px', borderRadius: 14, textDecoration: 'none', boxShadow: '0 8px 24px rgba(10,132,255,0.3)' }}>
                Find a Pro Now — Free →
              </Link>
            </div>
            <p style={{ fontSize: 13, color: textMuted }}>
              ScheduleMe is funded by service businesses, not by users. This is our promise.
            </p>
          </div>
        </section>

        {/* Business CTA banner */}
        <section style={{ padding: '0 24px', marginBottom: 64 }}>
          <div className="mx-auto" style={{ maxWidth: 720 }}>
            <div style={{ borderRadius: 20, background: darkBannerBg, border: `1px solid ${darkBannerBorder}`, padding: '32px 40px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
              <div>
                <p style={{ color: 'white', fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Are you a service business?</p>
                <p style={{ color: dm ? '#8e8e93' : '#94a3b8', fontSize: 14 }}>See plans, pricing, and how leads work on our business page.</p>
              </div>
              <Link href="/business/pricing" style={{ display: 'inline-block', background: '#007e6d', color: 'white', fontWeight: 700, fontSize: 14, padding: '12px 24px', borderRadius: 12, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                View Business Pricing →
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: '0 24px' }}>
          <div className="js-psec mx-auto" style={{ maxWidth: 720, textAlign: 'center' }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: textPrimary, marginBottom: 16 }}>Ready to get started?</h2>
            <p style={{ color: textSecondary, marginBottom: 24 }}>No account needed. Describe your issue and find a pro in seconds.</p>
            <Link href="/bookings" style={{ display: 'inline-block', background: '#007e6d', color: 'white', fontWeight: 700, fontSize: 15, padding: '14px 40px', borderRadius: 14, textDecoration: 'none', boxShadow: '0 8px 24px rgba(10,132,255,0.3)' }}>
              Get Started for Free →
            </Link>
          </div>
        </section>

      </main>
    </>
  );
};

export default Pricing;
