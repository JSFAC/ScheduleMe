// pages/business/index.tsx
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

const IconTarget = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>;
const IconBell = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>;
const IconChart = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>;
const IconCard = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>;
const IconStar = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>;
const IconLock = () => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>;

const WHY_ITEMS = [
  { icon: <IconTarget />, title: 'Pre-qualified leads only', desc: 'Every request has been triaged by AI. You only see leads that match your exact service category and location.' },
  { icon: <IconBell />, title: 'Real-time notifications', desc: 'Get SMS and email alerts the moment a matching lead comes in. First to respond wins the booking.' },
  { icon: <IconChart />, title: 'Business dashboard', desc: 'Track leads, manage your profile, see your reviews, and monitor your conversion rate — all in one place.' },
  { icon: <IconCard />, title: 'Pay only for leads', desc: 'No monthly subscription to start. Pay a flat fee per lead received. Upgrade to Pro for unlimited access.' },
  { icon: <IconStar />, title: 'Build your reputation', desc: 'Verified reviews from real customers on every booking. Strong ratings mean more prominent placement.' },
  { icon: <IconLock />, title: 'Own your territory', desc: 'Category and location exclusivity on Pro. Once you claim your area, no competitors can bid on the same leads.' },
];

const HOW_STEPS = [
  { step: 1, title: 'Create your profile', desc: 'Tell us about your business — service type, coverage area, availability, and license info. Takes about 5 minutes.' },
  { step: 2, title: 'Get verified', desc: 'We run a quick license and background check. Most businesses are approved within 24 hours.' },
  { step: 3, title: 'Receive matched leads', desc: 'When a customer requests your service in your area, you get an instant alert with their details and AI triage summary.' },
  { step: 4, title: 'Win the booking', desc: 'Call the customer directly. No middleman, no commission. The booking — and the relationship — is yours.' },
];

const TESTIMONIALS = [
  { quote: "My schedule was half-empty. After joining ScheduleMe, I'm booked two weeks out. The leads are genuinely warm.", name: "Mike R.", biz: "Mike R. Plumbing", location: "Austin, TX" },
  { quote: "The quality is night and day compared to other lead services. Customers already know what they need when they call.", name: "Sarah T.", biz: "CoolBreeze HVAC", location: "Austin, TX" },
  { quote: "I was skeptical. One Pro lead paid for a year of the plan. The ROI speaks for itself.", name: "Dani L.", biz: "Volt Masters Electric", location: "Phoenix, AZ" },
];

const FAQ = [
  { q: 'How much does it cost?', a: 'You start free — no setup fees. On the Starter plan, you pay $8 per lead received. Pro plan ($79/mo) gives you unlimited leads, priority placement, and territory exclusivity.' },
  { q: 'What service categories do you support?', a: 'Plumbing, HVAC, electrical, automotive, home repair, cleaning, salon/beauty, landscaping, pest control, and more. We add new categories every quarter.' },
  { q: 'How are leads matched to my business?', a: 'Our AI triages each customer request and scores it against your service category, location radius, and availability. You only see leads that are genuinely relevant.' },
  { q: 'Can I set my own service area?', a: 'Yes. During onboarding you set your coverage radius. You can adjust this anytime from your dashboard.' },
  { q: 'What if a lead is bad quality?', a: 'If a lead does not match your profile or the contact info is invalid, report it within 48 hours for a full credit — no questions asked.' },
  { q: 'How quickly will I be approved?', a: 'Most businesses are reviewed and approved within 24 hours. We verify your license number and run a background check on the primary contact.' },
];

const StarRating = () => (
  <div className="flex gap-1 mb-5" aria-label="5 out of 5 stars">
    {Array.from({ length: 5 }).map((_, i) => (
      <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="#F59E0B" aria-hidden="true">
        <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ))}
  </div>
);

const Business: NextPage = () => {
  useReveal('.js-why', 100);
  useReveal('.js-step-b', 130);
  useReveal('.js-test-b', 100);
  useReveal('.js-faq', 70);
  useReveal('.js-sec', 0);

  return (
    <>
      <Head>
        <title>ScheduleMe for Business — Get More Customers, Zero Ad Spend</title>
        <meta name="description" content="Join 2,400+ local service businesses on ScheduleMe. Get pre-qualified, AI-triaged leads matched to your exact service and location." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <BusinessNav />

      <main className="bg-neutral-950">
        {/* Hero */}
        <section className="relative pt-44 pb-32 px-6 overflow-hidden" aria-labelledby="biz-hero-heading">
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[800px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(10,132,255,0.09) 0%, transparent 70%)' }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, black 40%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, black 40%, transparent 100%)',
            }} />
          <div className="relative mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border border-accent/25 bg-accent/5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" aria-hidden="true" />
              <span className="text-xs font-semibold tracking-widest uppercase text-accent">For Service Businesses</span>
            </div>
            <h1 id="biz-hero-heading" className="text-5xl md:text-7xl font-black text-white mb-7" style={{ letterSpacing: '-0.03em', lineHeight: 1.0 }}>
              More customers.<br />Zero ad spend.
            </h1>
            <p className="text-xl text-neutral-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              ScheduleMe delivers pre-qualified, AI-triaged leads that match your exact service and location. You pay only for leads you receive — no setup fees, no lock-in.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/business/signup" className="btn-primary text-base px-10 py-4 shadow-xl shadow-accent/20">
                Join for Free →
              </Link>
              <a href="#how" className="inline-flex items-center justify-center px-10 py-4 rounded-xl border border-neutral-700 text-neutral-300 text-base font-semibold hover:bg-neutral-800 transition-colors">
                See how it works
              </a>
            </div>
            <p className="mt-6 text-sm text-neutral-600">No credit card required · Approval within 24 hours</p>
          </div>
        </section>

        {/* Stats strip */}
        <section className="border-y border-neutral-900 py-8 bg-neutral-900/40" aria-label="Social proof">
          <div className="mx-auto max-w-5xl px-6">
            <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4" role="list">
              {[
                { value: '2,400+', label: 'businesses joined' },
                { value: '14', label: 'service categories' },
                { value: '$0', label: 'to get started' },
                { value: '24 hr', label: 'approval time' },
                { value: '4.8', label: 'provider rating' },
              ].map((s) => (
                <li key={s.label} className="flex items-baseline gap-2 text-sm">
                  <span className="text-white font-bold">{s.value}</span>
                  <span className="text-neutral-500">{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Why ScheduleMe */}
        <section id="why" className="py-28 px-6" aria-labelledby="why-heading">
          <div className="mx-auto max-w-6xl">
            <div className="js-sec text-center mb-20">
              <span className="section-eyebrow mb-4 block">Why Join</span>
              <h2 id="why-heading" className="text-4xl md:text-5xl font-bold text-white">
                Built for businesses<br className="hidden md:block" /> that want to grow.
              </h2>
              <p className="mt-5 text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed">
                We handle the marketing. You handle the work.
              </p>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" role="list">
              {WHY_ITEMS.map((item) => (
                <li key={item.title} className="js-why rounded-2xl border border-neutral-800 bg-neutral-900/60 p-7 hover:border-neutral-700 hover:bg-neutral-900 transition-all duration-200">
                  <div className="h-10 w-10 rounded-xl bg-neutral-800 text-neutral-300 flex items-center justify-center mb-5">
                    {item.icon}
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">{item.desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-24 px-6 bg-neutral-900/30 border-y border-neutral-900" aria-labelledby="how-biz-heading">
          <div className="mx-auto max-w-4xl">
            <div className="js-sec text-center mb-20">
              <span className="section-eyebrow mb-4 block">How It Works</span>
              <h2 id="how-biz-heading" className="text-4xl md:text-5xl font-bold text-white">
                Up and running<br className="hidden md:block" /> in 24 hours.
              </h2>
            </div>
            <ol className="relative space-y-0" role="list">
              <div className="absolute left-6 top-6 bottom-6 w-px bg-neutral-800 hidden md:block" aria-hidden="true" />
              {HOW_STEPS.map((step) => (
                <li key={step.step} className="js-step-b relative flex items-start gap-8 pb-12 last:pb-0">
                  <div className="relative flex-shrink-0 h-12 w-12 rounded-full bg-accent text-white flex items-center justify-center text-lg font-bold shadow-lg shadow-accent/20 z-10">
                    {step.step}
                  </div>
                  <div className="pt-2.5">
                    <h3 className="text-lg font-semibold text-white mb-1">{step.title}</h3>
                    <p className="text-neutral-400 leading-relaxed">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="js-sec mt-14 text-center">
              <Link href="/business/signup" className="btn-primary text-base px-10 py-4 shadow-xl shadow-accent/20">
                Get Started Free →
              </Link>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-28 px-6" aria-labelledby="biz-testimonials-heading">
          <div className="mx-auto max-w-6xl">
            <div className="js-sec text-center mb-16">
              <span className="section-eyebrow mb-4 block">From our pros</span>
              <h2 id="biz-testimonials-heading" className="text-4xl font-bold text-white">Businesses that made the switch</h2>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-6" role="list">
              {TESTIMONIALS.map((t) => (
                <li key={t.name} className="js-test-b rounded-2xl border border-neutral-800 bg-neutral-900/60 p-7">
                  <StarRating />
                  <blockquote className="text-sm text-neutral-300 leading-relaxed mb-6">&ldquo;{t.quote}&rdquo;</blockquote>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-300 font-semibold text-sm flex-shrink-0">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{t.name}</p>
                      <p className="text-xs text-neutral-500">{t.biz} · {t.location}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="py-20 px-6 bg-neutral-900/30 border-y border-neutral-900" aria-labelledby="biz-pricing-teaser">
          <div className="mx-auto max-w-3xl text-center js-sec">
            <span className="section-eyebrow mb-4 block">Pricing</span>
            <h2 id="biz-pricing-teaser" className="text-3xl md:text-4xl font-bold text-white mb-5">
              Pay only for what you get
            </h2>
            <p className="text-neutral-400 mb-10 text-lg leading-relaxed">
              Start free with $8 per lead, or go unlimited with Pro at $79/month.<br className="hidden md:block" /> No contracts, no hidden fees.
            </p>
            <Link href="/business/pricing" className="btn-primary text-base px-10 py-4 shadow-xl shadow-accent/20">
              View Full Pricing →
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-28 px-6" aria-labelledby="faq-heading">
          <div className="mx-auto max-w-3xl">
            <div className="js-sec text-center mb-16">
              <span className="section-eyebrow mb-4 block">FAQ</span>
              <h2 id="faq-heading" className="text-4xl font-bold text-white">Common questions</h2>
            </div>
            <dl className="space-y-3">
              {FAQ.map((item) => (
                <div key={item.q} className="js-faq rounded-2xl border border-neutral-800 bg-neutral-900/60 px-7 py-6 hover:border-neutral-700 transition-colors">
                  <dt className="text-base font-semibold text-white mb-2">{item.q}</dt>
                  <dd className="text-sm text-neutral-400 leading-relaxed">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 px-6 border-t border-neutral-900" aria-labelledby="biz-final-cta">
          <div className="mx-auto max-w-3xl text-center js-sec">
            <h2 id="biz-final-cta" className="text-3xl md:text-4xl font-bold text-white mb-5">
              Ready to grow your business?
            </h2>
            <p className="text-neutral-400 mb-10 text-lg leading-relaxed">
              Join free in 5 minutes. No credit card, no commitment.<br className="hidden md:block" /> Start receiving leads within 24 hours of approval.
            </p>
            <Link href="/business/signup" className="btn-primary text-base px-12 py-4 shadow-xl shadow-accent/20">
              Create Your Business Profile →
            </Link>
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

export default Business;
