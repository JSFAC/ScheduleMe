// pages/pricing.tsx — consumer only, no business tab
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect } from 'react';
import Nav from '../components/Nav';

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

  return (
    <>
      <Head>
        <title>Pricing — ScheduleMe</title>
        <meta name="description" content="ScheduleMe is always free for users. No account, no credit card, no fees." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Nav />

      <main className="pt-28 pb-24 bg-white">
        {/* Header */}
        <section className="py-16 px-6 text-center">
          <div className="js-psec mx-auto max-w-3xl">
            <span className="section-eyebrow mb-4 block">Pricing</span>
            <h1 className="text-5xl md:text-6xl font-bold text-neutral-900 mb-5" style={{ letterSpacing: '-0.025em' }}>
              Simple, honest pricing.
            </h1>
            <p className="text-xl text-neutral-500 max-w-xl mx-auto leading-relaxed">
              Free for the people who need help. Businesses pay only for results.
            </p>
          </div>
        </section>

        {/* User pricing card */}
        <section className="px-6 mb-16">
          <div className="mx-auto max-w-2xl text-center js-psec">
            <div className="rounded-3xl border-2 border-accent bg-accent-light p-12 mb-10">
              <p className="text-7xl mb-6" aria-hidden="true">🎉</p>
              <h2 className="text-4xl font-bold text-neutral-900 mb-4" style={{ letterSpacing: '-0.025em' }}>
                Always free for users.
              </h2>
              <p className="text-lg text-neutral-600 mb-8 leading-relaxed">
                No account required. No credit card. No hidden fees.<br />
                Describe your issue and get matched with a vetted pro — completely free, every time.
              </p>
              <ul className="space-y-3 mb-10 text-left max-w-sm mx-auto" role="list">
                {[
                  'AI triage of your issue',
                  'Instant matching with local pros',
                  'Real reviews and ratings',
                  'Direct contact with providers',
                  'No booking fees or commissions',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-neutral-700">
                    <span className="text-accent font-bold" aria-hidden="true">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/demo" className="btn-primary text-base px-10 py-4 shadow-lg shadow-accent/20">
                Find a Pro Now — Free →
              </Link>
            </div>
            <p className="text-sm text-neutral-500">
              ScheduleMe is funded by service businesses, not by users. This is our promise.
            </p>
          </div>
        </section>

        {/* Business CTA banner */}
        <section className="px-6 mb-16">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl bg-neutral-950 px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <p className="text-white font-bold text-lg mb-1">Are you a service business?</p>
                <p className="text-neutral-400 text-sm">See plans, pricing, and how leads work on our business page.</p>
              </div>
              <Link href="/business/pricing" className="btn-primary flex-shrink-0 px-6 py-3">
                View Business Pricing →
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6">
          <div className="mx-auto max-w-3xl text-center js-psec">
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">Ready to get started?</h2>
            <p className="text-neutral-500 mb-6">No account needed. Describe your issue and find a pro in seconds.</p>
            <Link href="/bookings" className="btn-primary px-10 py-4 text-base shadow-lg shadow-accent/20">Get Started for Free →</Link>
          </div>
        </section>
      </main>
    </>
  );
};

export default Pricing;
