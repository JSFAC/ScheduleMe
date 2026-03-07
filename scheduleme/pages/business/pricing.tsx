// pages/business/pricing.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import BusinessNav from '../../components/BusinessNav';

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

const PLANS = [
  {
    name: 'Starter',
    price: 'Free',
    priceNote: '+ $8 per lead received',
    description: 'Test the platform risk-free. Pay only when you receive a matched lead.',
    highlight: false,
    cta: 'Start for Free',
    href: '/business/signup',
    features: {
      'Lead volume': 'Up to 20 leads / month',
      'Placement': 'Standard — rotation with similar providers',
      'Lead alerts': 'Email only',
      'Dashboard': 'Basic — lead list + status',
      'Territory': 'Shared — compete with other providers',
      'Reviews': 'Public profile with customer reviews',
      'Support': 'Email (48 hr response)',
      'Bad lead credits': 'Manual review, case-by-case',
      'Analytics': '—',
      'API access': '—',
      'Multiple locations': '—',
    },
  },
  {
    name: 'Pro',
    price: '$79',
    priceNote: 'per month, billed monthly',
    description: 'For growing businesses that want consistent lead flow and a competitive edge.',
    highlight: true,
    badge: 'Most Popular',
    cta: 'Go Pro',
    href: '/business/signup?plan=pro',
    features: {
      'Lead volume': 'Unlimited',
      'Placement': 'Priority — shown above Starter providers',
      'Lead alerts': 'Real-time SMS + email',
      'Dashboard': 'Full analytics — conversion, revenue, trends',
      'Territory': 'Exclusivity — own your category + zip code',
      'Reviews': 'Featured profile with verified badge',
      'Support': 'Priority email (4 hr response)',
      'Bad lead credits': 'Automatic credit within 48 hrs',
      'Analytics': 'Full — lead source, close rate, revenue',
      'API access': '—',
      'Multiple locations': '—',
    },
  },
  {
    name: 'Agency',
    price: '$249',
    priceNote: 'per month, billed monthly',
    description: 'Multi-location operations or franchises managing a team of service professionals.',
    highlight: false,
    cta: 'Contact Sales',
    href: 'mailto:sales@scheduleme.com',
    features: {
      'Lead volume': 'Unlimited across all locations',
      'Placement': 'Priority across all locations',
      'Lead alerts': 'Real-time SMS + email per location',
      'Dashboard': 'Multi-location dashboard + team management',
      'Territory': 'Exclusivity for all registered locations',
      'Reviews': 'Branded agency profile',
      'Support': 'Dedicated account manager',
      'Bad lead credits': 'Automatic + priority review',
      'Analytics': 'Custom reporting + CSV export',
      'API access': 'Beta access',
      'Multiple locations': 'Up to 10 locations',
    },
  },
];

const FEATURE_ROWS = [
  'Lead volume',
  'Placement',
  'Lead alerts',
  'Dashboard',
  'Territory',
  'Reviews',
  'Support',
  'Bad lead credits',
  'Analytics',
  'API access',
  'Multiple locations',
];

const ADD_ONS = [
  { name: 'Extra leads (Starter)', price: '$8 / lead', desc: 'Purchase additional leads beyond the 20/month cap on Starter.' },
  { name: 'Annual billing discount', price: '20% off', desc: 'Pay for 12 months upfront on Pro or Agency and save 20% vs. monthly.' },
  { name: 'Onboarding call', price: 'Free', desc: 'Book a 30-minute onboarding call with our team to optimize your profile and get your first leads faster.' },
  { name: 'Profile photography', price: '$149 one-time', desc: 'Professional headshot and business photo shoot to improve your conversion rate. Available in select cities.' },
];

const FAQ = [
  { q: 'What counts as a lead?', a: 'A lead is a customer request that matches your service category and location radius and is delivered to your dashboard. You are only charged for leads that are genuinely relevant — if it does not match your profile, it is not counted.' },
  { q: 'What is territory exclusivity?', a: 'On Pro and Agency, you can claim a service category + zip code combination. Once claimed, no other provider in your category can receive leads from that zip code. Territories are first-come, first-served and can be expanded.' },
  { q: 'Can I pause or cancel anytime?', a: 'Yes. Monthly plans can be paused or cancelled from your dashboard at any time with no penalty. Leads already received and charged are non-refundable, but future billing stops immediately.' },
  { q: 'How does the bad lead credit work?', a: 'On Pro and Agency, if a lead is invalid — wrong service type, incorrect location, or fake contact info — report it within 48 hours. Credits are applied automatically on Pro. On Agency, an account manager reviews same-day.' },
  { q: 'Is there a setup fee?', a: 'None. You can create a profile, get verified, and start receiving leads with $0 upfront. On Starter you only pay when a lead arrives. On Pro/Agency you are billed monthly starting on the day you upgrade.' },
  { q: 'Do you offer refunds?', a: 'We do not offer cash refunds, but we do credit your account for invalid leads (Pro/Agency) and offer a 7-day Pro trial if you are upgrading from Starter for the first time.' },
  { q: 'Can I have multiple service categories?', a: 'On Starter and Pro, one primary category is included. Additional categories can be added for $20/month each. Agency includes up to 3 categories per location.' },
  { q: 'How are leads priced on Starter after 20?', a: 'After your 20 included leads, additional leads are billed at $8 each, charged at the end of the month. You can set a monthly cap in your dashboard to avoid surprises.' },
];

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-accent flex-shrink-0" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const BusinessPricing: NextPage = () => {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  useReveal('.js-bp', 100);
  useReveal('.js-bsec', 0);
  useReveal('.js-addon', 80);
  useReveal('.js-bfaq', 70);

  const annualMultiplier = billing === 'annual' ? 0.8 : 1;
  function formatPrice(base: string): string {
    if (base === 'Free' || base.startsWith('$0')) return base;
    const num = parseInt(base.replace('$', ''));
    if (isNaN(num)) return base;
    return `$${Math.round(num * annualMultiplier)}`;
  }

  return (
    <>
      <Head>
        <title>Business Pricing — ScheduleMe for Business</title>
        <meta name="description" content="Transparent pricing for service businesses. Start free, scale with Pro. No setup fees, no contracts." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <BusinessNav />

      <main className="bg-neutral-950 pt-28 pb-24">
        {/* Header */}
        <section className="py-16 px-6 text-center relative overflow-hidden" aria-labelledby="bp-heading">
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[600px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(10,132,255,0.08) 0%, transparent 70%)' }} />
          <div className="relative mx-auto max-w-3xl js-bsec">
            <span className="section-eyebrow mb-4 block">Business Pricing</span>
            <h1 id="bp-heading" className="text-5xl md:text-6xl font-black text-white mb-5" style={{ letterSpacing: '-0.03em' }}>
              Transparent pricing.<br />No surprises.
            </h1>
            <p className="text-xl text-neutral-400 max-w-xl mx-auto leading-relaxed mb-10">
              Start free. Scale when you&apos;re ready. Users are always free — businesses pay only for results.
            </p>

            {/* Billing toggle */}
            <div className="inline-flex items-center rounded-xl bg-neutral-900 border border-neutral-800 p-1 gap-1" role="group" aria-label="Billing period">
              {(['monthly', 'annual'] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBilling(b)}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    billing === b ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                  aria-pressed={billing === b}
                >
                  {b === 'monthly' ? 'Monthly' : 'Annual'}
                  {b === 'annual' && <span className="ml-2 text-xs text-accent font-bold">Save 20%</span>}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Plan cards */}
        <section className="px-6 mb-20" aria-label="Pricing plans">
          <div className="mx-auto max-w-6xl">
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-6" role="list">
              {PLANS.map((plan) => (
                <li key={plan.name} className={`js-bp rounded-2xl border p-8 flex flex-col ${
                  plan.highlight ? 'border-accent bg-accent/5 ring-1 ring-accent/20' : 'border-neutral-800 bg-neutral-900/60'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">{plan.name}</p>
                    {'badge' in plan && plan.badge && (
                      <span className="badge bg-accent text-white text-[10px]">{plan.badge}</span>
                    )}
                  </div>
                  <p className="text-4xl font-black text-white mt-1 mb-1" style={{ letterSpacing: '-0.03em' }}>
                    {formatPrice(plan.price)}
                  </p>
                  <p className="text-sm text-neutral-500 mb-4">
                    {billing === 'annual' && plan.price !== 'Free'
                      ? plan.priceNote.replace('monthly', 'annual')
                      : plan.priceNote}
                  </p>
                  <p className="text-sm text-neutral-400 leading-relaxed mb-8 pb-8 border-b border-neutral-800">
                    {plan.description}
                  </p>

                  <ul className="space-y-3 flex-1 mb-8" role="list">
                    {FEATURE_ROWS.map((row) => {
                      const val = plan.features[row as keyof typeof plan.features];
                      const isEmpty = val === '—';
                      return (
                        <li key={row} className={`flex items-start gap-2.5 text-sm ${isEmpty ? 'opacity-30' : ''}`}>
                          {isEmpty
                            ? <span className="w-4 flex-shrink-0 text-neutral-600 text-center" aria-hidden="true">—</span>
                            : <CheckIcon />
                          }
                          <span className={isEmpty ? 'text-neutral-500' : 'text-neutral-300'}>
                            <span className="text-neutral-500 text-xs">{row}: </span>
                            {val}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <Link href={plan.href} className={plan.highlight
                    ? 'btn-primary w-full justify-center'
                    : 'inline-flex items-center justify-center w-full px-6 py-3 rounded-xl border border-neutral-700 text-neutral-200 text-sm font-semibold hover:bg-neutral-800 transition-colors'
                  }>
                    {plan.cta}
                  </Link>
                </li>
              ))}
            </ul>

            {billing === 'annual' && (
              <p className="text-center text-sm text-neutral-500 mt-6">
                Annual prices shown. Billed as one payment.{' '}
                <a href="mailto:sales@scheduleme.com" className="text-accent hover:underline">Contact sales</a> for invoicing.
              </p>
            )}
          </div>
        </section>

        {/* Feature comparison table */}
        <section className="px-6 mb-20 border-y border-neutral-900 py-16" aria-labelledby="compare-heading">
          <div className="mx-auto max-w-5xl">
            <div className="js-bsec text-center mb-12">
              <span className="section-eyebrow mb-4 block">Compare Plans</span>
              <h2 id="compare-heading" className="text-3xl font-bold text-white">Everything side by side</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]" aria-label="Plan comparison">
                <thead>
                  <tr className="border-b border-neutral-800">
                    <th className="text-left py-4 pr-6 text-sm font-semibold text-neutral-400 w-48">Feature</th>
                    {PLANS.map((p) => (
                      <th key={p.name} className={`py-4 px-4 text-sm font-semibold text-center ${p.highlight ? 'text-accent' : 'text-neutral-300'}`}>
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_ROWS.map((row, i) => (
                    <tr key={row} className={`border-b border-neutral-900 ${i % 2 === 0 ? '' : 'bg-neutral-900/20'}`}>
                      <td className="py-4 pr-6 text-sm text-neutral-400">{row}</td>
                      {PLANS.map((p) => {
                        const val = p.features[row as keyof typeof p.features];
                        return (
                          <td key={p.name} className="py-4 px-4 text-sm text-center text-neutral-300">
                            {val === '—' ? <span className="text-neutral-700" aria-label="Not included">—</span> : val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Add-ons */}
        <section className="px-6 mb-20" aria-labelledby="addons-heading">
          <div className="mx-auto max-w-5xl">
            <div className="js-bsec text-center mb-12">
              <span className="section-eyebrow mb-4 block">Add-ons</span>
              <h2 id="addons-heading" className="text-3xl font-bold text-white">Extras, when you need them</h2>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-5" role="list">
              {ADD_ONS.map((a) => (
                <li key={a.name} className="js-addon rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 flex items-start gap-5">
                  <div className="flex-shrink-0">
                    <p className="text-lg font-bold text-white" style={{ letterSpacing: '-0.02em' }}>{a.price}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-1">{a.name}</p>
                    <p className="text-sm text-neutral-400 leading-relaxed">{a.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 mb-20" aria-labelledby="bp-faq-heading">
          <div className="mx-auto max-w-3xl">
            <div className="js-bsec text-center mb-14">
              <span className="section-eyebrow mb-4 block">Pricing FAQ</span>
              <h2 id="bp-faq-heading" className="text-3xl font-bold text-white">Every question answered</h2>
            </div>
            <dl className="space-y-3">
              {FAQ.map((item) => (
                <div key={item.q} className="js-bfaq rounded-2xl border border-neutral-800 bg-neutral-900/60 px-7 py-6 hover:border-neutral-700 transition-colors">
                  <dt className="text-base font-semibold text-white mb-2">{item.q}</dt>
                  <dd className="text-sm text-neutral-400 leading-relaxed">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 border-t border-neutral-900 pt-24" aria-labelledby="bp-cta">
          <div className="mx-auto max-w-3xl text-center js-bsec">
            <h2 id="bp-cta" className="text-3xl md:text-4xl font-bold text-white mb-5">
              Start receiving leads today.
            </h2>
            <p className="text-neutral-400 mb-10 text-lg leading-relaxed">
              Free to join. Approval within 24 hours. No credit card required to start.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/business/signup" className="btn-primary text-base px-10 py-4 shadow-xl shadow-accent/20">
                Create Your Profile →
              </Link>
              <a href="mailto:sales@scheduleme.com" className="inline-flex items-center justify-center px-10 py-4 rounded-xl border border-neutral-700 text-neutral-300 text-base font-semibold hover:bg-neutral-800 transition-colors">
                Talk to Sales
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-neutral-950 border-t border-neutral-900 py-10">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col leading-none">
            <span className="text-base font-black text-white" style={{ letterSpacing: '-0.03em' }}>ScheduleMe</span>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-accent mt-0.5">for Business</span>
          </div>
          <p className="text-xs text-neutral-600">© 2025 ScheduleMe, Inc.</p>
          <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Back to consumer site →</Link>
        </div>
      </footer>
    </>
  );
};

export default BusinessPricing;
