// pages/pricing.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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

const BUSINESS_PLANS = [
  {
    name: 'Starter',
    price: 'Free',
    priceNote: '+ $8 per lead',
    description: 'Perfect for testing the platform. Pay only when you get a lead.',
    features: [
      'Up to 20 leads per month',
      'Standard placement in results',
      'Basic business dashboard',
      'Lead triage details (service + urgency)',
      'Email support',
      'Customer review profile',
    ],
    notIncluded: [
      'Priority placement',
      'Territory exclusivity',
      'SMS lead alerts',
      'Advanced analytics',
    ],
    cta: 'Start for Free',
    href: '/business/signup',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$79',
    priceNote: 'per month',
    description: 'For serious service businesses ready to scale.',
    features: [
      'Unlimited leads',
      'Priority placement in results',
      'Territory exclusivity (your category + zip)',
      'Real-time SMS + email alerts',
      'Advanced analytics dashboard',
      'Customer review profile',
      'Dedicated account manager',
      'Bad-lead credit guarantee',
    ],
    notIncluded: [],
    cta: 'Go Pro',
    href: '/business/signup?plan=pro',
    highlight: true,
  },
  {
    name: 'Agency',
    price: '$249',
    priceNote: 'per month',
    description: 'Multiple locations or a team of pros under one account.',
    features: [
      'Everything in Pro',
      'Up to 10 team members / locations',
      'Multi-location dashboard',
      'Custom service category labels',
      'Priority onboarding & support',
      'API access (beta)',
      'Custom reporting',
    ],
    notIncluded: [],
    cta: 'Contact Sales',
    href: 'mailto:sales@scheduleme.com',
    highlight: false,
  },
];

const FAQ = [
  { q: 'Are there setup fees?', a: 'None. Starter plan is completely free to join. You only pay $8 per lead received. Pro and Agency have flat monthly fees with no per-lead charge.' },
  { q: 'What counts as a "lead"?', a: 'A lead is a customer request that matches your service category and location and is delivered to your dashboard. Requests that don\'t match your profile are never counted.' },
  { q: 'Can I switch plans later?', a: 'Yes — upgrade, downgrade, or cancel anytime from your dashboard. Changes take effect at the start of your next billing cycle.' },
  { q: 'What is the bad-lead credit guarantee?', a: 'On Pro and Agency, if a lead is invalid (wrong category, fake contact info, or outside your service area), report it within 48 hours and we\'ll credit your account — no questions asked.' },
  { q: 'Is there a contract?', a: 'No contracts. Monthly billing, cancel anytime. Annual billing available at 20% discount (contact us).' },
  { q: 'Why is it free for users?', a: 'ScheduleMe is funded by the businesses on the platform. Consumers should never have to pay to find help — that\'s our core belief.' },
];

const Pricing: NextPage = () => {
  const [tab, setTab] = useState<'business' | 'user'>('user');
  useReveal('.js-plan', 100);
  useReveal('.js-pfaq', 80);
  useReveal('.js-psec', 0);

  return (
    <>
      <Head>
        <title>Pricing — ScheduleMe</title>
        <meta name="description" content="ScheduleMe is free for users. Businesses pay only for the leads they receive. No setup fees." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Nav />

      <main className="pt-28 pb-24 bg-white">
        {/* Header */}
        <section className="py-16 px-6 text-center" aria-labelledby="pricing-heading">
          <div className="js-psec mx-auto max-w-3xl">
            <span className="section-eyebrow mb-4 block">Pricing</span>
            <h1 id="pricing-heading" className="text-5xl md:text-6xl font-bold text-neutral-900 mb-5" style={{ letterSpacing: '-0.025em' }}>
              Simple, honest pricing.
            </h1>
            <p className="text-xl text-neutral-500 max-w-xl mx-auto leading-relaxed">
              Free for the people who need help. Businesses pay only for results.
            </p>
          </div>
        </section>

        {/* Tab switcher */}
        <div className="flex justify-center px-6 mb-16">
          <div className="inline-flex rounded-xl bg-neutral-100 p-1 gap-1" role="tablist" aria-label="Pricing tabs">
            {[
              { key: 'user' as const, label: 'For Users' },
              { key: 'business' as const, label: 'For Businesses' },
            ].map(({ key, label }) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  tab === key
                    ? 'bg-white text-neutral-900 shadow-card'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Business plans */}
        {tab === 'business' && (
          <section className="px-6" aria-label="Business pricing plans">
            <div className="mx-auto max-w-6xl">
              <ul className="grid grid-cols-1 md:grid-cols-3 gap-6" role="list">
                {BUSINESS_PLANS.map((plan) => (
                  <li
                    key={plan.name}
                    className={`js-plan rounded-2xl border p-8 flex flex-col ${
                      plan.highlight
                        ? 'border-accent bg-accent-light ring-2 ring-accent/20'
                        : 'border-neutral-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">{plan.name}</p>
                      {plan.highlight && <span className="badge bg-accent text-white">Most Popular</span>}
                    </div>
                    <p className="text-4xl font-black text-neutral-900 mt-2" style={{ letterSpacing: '-0.03em' }}>{plan.price}</p>
                    <p className="text-sm text-neutral-500 mb-3">{plan.priceNote}</p>
                    <p className="text-sm text-neutral-500 leading-relaxed mb-7 pb-7 border-b border-neutral-200">
                      {plan.description}
                    </p>

                    <ul className="space-y-2.5 flex-1 mb-8" role="list">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-neutral-700">
                          <span className="text-accent mt-0.5 flex-shrink-0" aria-hidden="true">✓</span>
                          {f}
                        </li>
                      ))}
                      {plan.notIncluded.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-neutral-300">
                          <span className="mt-0.5 flex-shrink-0 text-neutral-300" aria-hidden="true">–</span>
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Link href={plan.href} className={plan.highlight ? 'btn-primary w-full justify-center' : 'btn-secondary w-full justify-center'}>
                      {plan.cta}
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="text-center text-sm text-neutral-400 mt-8">
                Need a detailed breakdown? <Link href="/business/pricing" className="text-accent hover:underline">View full business pricing →</Link>
              </p>
            </div>
          </section>
        )}

        {/* User pricing */}
        {tab === 'user' && (
          <section className="px-6" aria-label="User pricing">
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
        )}

        {/* FAQ */}
        <section className="py-24 px-6" aria-labelledby="pricing-faq-heading">
          <div className="mx-auto max-w-3xl">
            <div className="js-psec text-center mb-14">
              <span className="section-eyebrow mb-4 block">FAQ</span>
              <h2 id="pricing-faq-heading" className="text-3xl font-bold text-neutral-900">Pricing questions</h2>
            </div>
            <dl className="space-y-4">
              {FAQ.map((item) => (
                <div key={item.q} className="js-pfaq rounded-2xl border border-neutral-100 bg-neutral-50 px-7 py-6">
                  <dt className="text-base font-semibold text-neutral-900 mb-2">{item.q}</dt>
                  <dd className="text-sm text-neutral-500 leading-relaxed">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 pb-8" aria-labelledby="pricing-cta-heading">
          <div className="mx-auto max-w-3xl text-center js-psec">
            <h2 id="pricing-cta-heading" className="text-2xl font-bold text-neutral-900 mb-4">Still have questions?</h2>
            <p className="text-neutral-500 mb-6">
              Our team is happy to walk you through the right plan for your business.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="mailto:hello@scheduleme.com" className="btn-primary px-8 py-3">Talk to us</a>
              <Link href="/business/signup" className="btn-secondary px-8 py-3">Start for free</Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default Pricing;
