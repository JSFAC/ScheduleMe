// pages/business/pricing.tsx — Commission-based pricing page
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect } from 'react';
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

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Join for free',
    desc: 'Create your business profile, set your service area and categories. No credit card required.',
  },
  {
    step: '02',
    title: 'Get matched to jobs',
    desc: 'When a customer submits a request that fits your profile, you get notified instantly via SMS and email.',
  },
  {
    step: '03',
    title: 'Accept and complete',
    desc: 'Review the job details, accept if it works for you, and complete the job. We handle payment collection.',
  },
  {
    step: '04',
    title: 'Get paid — we keep 12%',
    desc: 'The customer pays through ScheduleMe. You receive 88% of the job value, transferred directly to your bank.',
  },
];

const COMPARE = [
  { label: 'Monthly subscription', them: true, us: false },
  { label: 'Per-lead fees', them: true, us: false },
  { label: 'Sign-up fees', them: true, us: false },
  { label: 'Pay only when you earn', them: false, us: true },
  { label: 'Instant payment on job completion', them: false, us: true },
  { label: 'No monthly minimums', them: false, us: true },
  { label: 'Real-time SMS + email alerts', them: false, us: true },
  { label: 'Dispute protection', them: false, us: true },
];

const FAQ = [
  {
    q: 'What does the 12% commission cover?',
    a: 'It covers payment processing, customer matching, fraud protection, dispute handling, and platform maintenance. There are no additional fees on top of the 12%.',
  },
  {
    q: 'When do I get paid?',
    a: 'Once a job is marked complete by both parties, funds are released to your connected bank account within 2 business days via Stripe.',
  },
  {
    q: 'What if a customer disputes a job?',
    a: 'We review disputes fairly. If the job was completed as agreed, you keep your payment. If not, funds may be refunded to the customer. We always hear both sides before making a decision.',
  },
  {
    q: 'Are there any monthly minimums?',
    a: 'None. If you have a slow month, you pay nothing. The 12% only applies when you earn.',
  },
  {
    q: 'Who sets the job price?',
    a: 'You do. When you accept a job, you confirm the price with the customer. ScheduleMe takes 12% of whatever is agreed.',
  },
  {
    q: 'Can I decline jobs I don\'t want?',
    a: 'Yes, always. You are never obligated to accept a job. Declining does not affect your standing on the platform.',
  },
  {
    q: 'Is there a limit to how many jobs I can take?',
    a: 'No limits. The more jobs you complete, the more you earn. High-performing businesses get priority placement in matches.',
  },
  {
    q: 'How do I get started?',
    a: 'Create a free profile, get verified (usually within 24 hours), and start receiving matched job requests immediately.',
  },
];

const CheckIcon = ({ green }: { green?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
    className={green ? 'text-green-400' : 'text-accent'} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
    className="text-neutral-600" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const BusinessPricing: NextPage = () => {
  useReveal('.js-reveal', 80);

  return (
    <>
      <Head>
        <title>Pricing — ScheduleMe for Business</title>
        <meta name="description" content="No subscriptions. No lead fees. Join free and only pay 12% when you get paid." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <BusinessNav />

      <main className="bg-neutral-950 pt-28 pb-24">

        {/* Hero */}
        <section className="py-20 px-6 text-center relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-[700px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(10,132,255,0.08) 0%, transparent 70%)' }} />
          <div className="relative mx-auto max-w-3xl js-reveal">
            <span className="section-eyebrow mb-4 block">Simple Pricing</span>
            <h1 className="text-5xl md:text-6xl font-black text-white mb-6" style={{ letterSpacing: '-0.03em' }}>
              Free to join.<br />
              <span className="text-accent">12% when you earn.</span>
            </h1>
            <p className="text-xl text-neutral-400 max-w-xl mx-auto leading-relaxed mb-10">
              No subscriptions. No monthly fees. No per-lead charges.
              You only pay when a customer pays you.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/business/signup" className="btn-primary text-base px-10 py-4 shadow-xl shadow-accent/20">
                Join for Free →
              </Link>
              <a href="mailto:hello@usescheduleme.com"
                className="inline-flex items-center justify-center px-10 py-4 rounded-xl border border-neutral-700 text-neutral-300 text-base font-semibold hover:bg-neutral-800 transition-colors">
                Talk to Us
              </a>
            </div>
          </div>
        </section>

        {/* Big commission callout */}
        <section className="px-6 mb-24">
          <div className="mx-auto max-w-3xl">
            <div className="js-reveal rounded-3xl border border-neutral-800 bg-neutral-900/60 p-10 md:p-14 text-center relative overflow-hidden">
              <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(10,132,255,0.06) 0%, transparent 70%)' }} />
              <div className="relative">
                <p className="text-neutral-400 text-sm font-semibold uppercase tracking-widest mb-4">The only number that matters</p>
                <p className="text-8xl md:text-9xl font-black text-white mb-2" style={{ letterSpacing: '-0.04em' }}>12<span className="text-accent">%</span></p>
                <p className="text-neutral-400 text-lg mb-8">commission on completed jobs. That's it.</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-sm">
                  <div className="flex items-center gap-2 text-neutral-300">
                    <CheckIcon />
                    <span>No setup fees</span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-300">
                    <CheckIcon />
                    <span>No monthly subscription</span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-300">
                    <CheckIcon />
                    <span>No per-lead charges</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Example calculation */}
        <section className="px-6 mb-24">
          <div className="mx-auto max-w-4xl">
            <div className="js-reveal text-center mb-12">
              <span className="section-eyebrow mb-4 block">See It In Action</span>
              <h2 className="text-3xl font-bold text-white">What does 12% look like?</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { job: 'Leaky faucet repair', total: 150 },
                { job: 'Deep house cleaning', total: 280 },
                { job: 'Electrical panel work', total: 600 },
              ].map((ex) => (
                <div key={ex.job} className="js-reveal rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
                  <p className="text-sm text-neutral-400 mb-4">{ex.job}</p>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Customer pays</span>
                      <span className="text-white font-semibold">${ex.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">ScheduleMe (12%)</span>
                      <span className="text-neutral-400">−${Math.round(ex.total * 0.12)}</span>
                    </div>
                    <div className="h-px bg-neutral-800 my-2" />
                    <div className="flex justify-between">
                      <span className="text-neutral-300 font-semibold">You receive</span>
                      <span className="text-green-400 font-bold text-base">${Math.round(ex.total * 0.88)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 mb-24 border-y border-neutral-900 py-20">
          <div className="mx-auto max-w-5xl">
            <div className="js-reveal text-center mb-14">
              <span className="section-eyebrow mb-4 block">How It Works</span>
              <h2 className="text-3xl font-bold text-white">Simple from day one</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {HOW_IT_WORKS.map((step) => (
                <div key={step.step} className="js-reveal">
                  <p className="text-4xl font-black text-neutral-800 mb-3" style={{ letterSpacing: '-0.03em' }}>{step.step}</p>
                  <p className="text-base font-bold text-white mb-2">{step.title}</p>
                  <p className="text-sm text-neutral-400 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="px-6 mb-24">
          <div className="mx-auto max-w-3xl">
            <div className="js-reveal text-center mb-12">
              <span className="section-eyebrow mb-4 block">vs. The Competition</span>
              <h2 className="text-3xl font-bold text-white">Why businesses choose ScheduleMe</h2>
            </div>
            <div className="js-reveal rounded-2xl border border-neutral-800 overflow-hidden">
              <div className="grid grid-cols-3 bg-neutral-900 border-b border-neutral-800">
                <div className="p-4 text-sm text-neutral-500 font-medium">Feature</div>
                <div className="p-4 text-sm text-neutral-500 font-medium text-center">Others</div>
                <div className="p-4 text-sm text-accent font-semibold text-center">ScheduleMe</div>
              </div>
              {COMPARE.map((row, i) => (
                <div key={row.label} className={`grid grid-cols-3 border-b border-neutral-900 ${i % 2 === 0 ? '' : 'bg-neutral-900/30'}`}>
                  <div className="p-4 text-sm text-neutral-300">{row.label}</div>
                  <div className="p-4 flex justify-center items-center">
                    {row.them ? <CheckIcon green /> : <XIcon />}
                  </div>
                  <div className="p-4 flex justify-center items-center">
                    {row.us ? <CheckIcon /> : <XIcon />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 mb-24">
          <div className="mx-auto max-w-3xl">
            <div className="js-reveal text-center mb-14">
              <span className="section-eyebrow mb-4 block">FAQ</span>
              <h2 className="text-3xl font-bold text-white">Questions answered</h2>
            </div>
            <dl className="space-y-3">
              {FAQ.map((item) => (
                <div key={item.q} className="js-reveal rounded-2xl border border-neutral-800 bg-neutral-900/60 px-7 py-6 hover:border-neutral-700 transition-colors">
                  <dt className="text-base font-semibold text-white mb-2">{item.q}</dt>
                  <dd className="text-sm text-neutral-400 leading-relaxed">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 border-t border-neutral-900 pt-24">
          <div className="mx-auto max-w-3xl text-center js-reveal">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-5">
              Ready to start getting paid?
            </h2>
            <p className="text-neutral-400 mb-10 text-lg leading-relaxed">
              Free to join. Approval within 24 hours. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/business/signup" className="btn-primary text-base px-10 py-4 shadow-xl shadow-accent/20">
                Create Your Profile →
              </Link>
              <a href="mailto:hello@usescheduleme.com"
                className="inline-flex items-center justify-center px-10 py-4 rounded-xl border border-neutral-700 text-neutral-300 text-base font-semibold hover:bg-neutral-800 transition-colors">
                Talk to Us
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
          <p className="text-xs text-neutral-600">© 2026 ScheduleMe, Inc.</p>
          <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Back to consumer site →</Link>
        </div>
      </footer>
    </>
  );
};

export default BusinessPricing;
