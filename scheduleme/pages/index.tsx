// @ts-nocheck
// pages/index.tsx
import type { NextPage, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect } from 'react';
import { useDm } from '../lib/DarkModeContext';
import Nav from '../components/Nav';
import Hero from '../components/Hero';
import cms from '../cms_content.json';
import FaqAccordion, { FAQS } from '../components/FaqAccordion';
import SeoHead from '../components/SeoHead';
import { SITE_NAME, SITE_URL } from '../lib/siteMeta';

interface Feature { icon: string; title: string; description: string; }
interface DemoStep { step: number; title: string; description: string; }
interface HomeProps { features: Feature[]; demoSteps: DemoStep[]; }

function useScrollReveal(
  selector: string,
  opts?: { delayStep?: number; reverseOnUp?: boolean; type?: 'reveal' | 'scale' | 'left' }
) {
  const delayStep = opts?.delayStep ?? 90;
  const reverseOnUp = opts?.reverseOnUp ?? false;
  const type = opts?.type ?? 'reveal';
  const attrName = type === 'scale' ? 'data-reveal-scale' : type === 'left' ? 'data-reveal-left' : 'data-reveal';

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
    let lastY = typeof window !== 'undefined' ? window.scrollY : 0;
    const observerOpts = type === 'scale'
      ? { threshold: 0.12, rootMargin: '0px 0px -32px 0px' }
      : type === 'left'
        ? { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
        : { threshold: 0.1, rootMargin: '0px 0px -48px 0px' };

    els.forEach((el, i) => {
      el.setAttribute(attrName, 'hidden');
      el.setAttribute('data-reveal-index', String(i));
      el.style.transitionDelay = '0ms';
    });

    const io = new IntersectionObserver(
      (entries) => {
        const nextY = typeof window !== 'undefined' ? window.scrollY : lastY;
        const scrollingUp = nextY < lastY;
        lastY = nextY;
        const total = els.length;

        entries.forEach((e) => {
          const target = e.target as HTMLElement;
          const idx = Number(target.getAttribute('data-reveal-index') || '0');
          const ord = reverseOnUp && scrollingUp ? (total - 1 - idx) : idx;
          target.style.transitionDelay = e.isIntersecting ? `${ord * delayStep}ms` : '0ms';
          target.setAttribute(attrName, e.isIntersecting ? 'visible' : 'hidden');
        });
      },
      observerOpts
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [selector, delayStep, reverseOnUp, attrName]);
}

const ICONS: Record<string, JSX.Element> = {
  brain: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15m-4.8-.786V20.25" /></svg>,
  zap: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>,
  calendar: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
  shield: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
  clock: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>,
  graduation: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 14.25L3.75 9.75 12 5.25l8.25 4.5L12 14.25z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 11.25V15c0 1.5 2.25 2.75 5.25 2.75S17.25 16.5 17.25 15v-3.75" /></svg>,
  dollar: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75v16.5M15.75 7.5c0-1.5-1.68-2.75-3.75-2.75S8.25 6 8.25 7.5s1.68 2.75 3.75 2.75 3.75 1.25 3.75 2.75S14.07 15.75 12 15.75s-3.75-1.25-3.75-2.75" /></svg>,
};

const STATS = [
  { value: 'Free', label: 'To request help' },
  { value: 'Local', label: 'Campus and nearby pros' },
  { value: 'Direct', label: 'Message providers yourself' },
  { value: 'Simple', label: 'Book in one place' },
];

const Home: NextPage<HomeProps> = ({ features, demoSteps }) => {
  const { dm } = useDm();
  useScrollReveal('.js-feat', { delayStep: 100 });
  useScrollReveal('.js-step', { delayStep: 180, reverseOnUp: true });
  useScrollReveal('.js-stat', { delayStep: 80 });
  useScrollReveal('.js-section', { delayStep: 0 });
  useScrollReveal('.js-testimonial', { delayStep: 100 });
  useScrollReveal('.js-pricing-item', { delayStep: 120 });
  useScrollReveal('.js-biz-item', { delayStep: 120, reverseOnUp: true });
  useScrollReveal('.js-biz-copy', { delayStep: 0, reverseOnUp: true });
  useScrollReveal('.js-hero-shell', { delayStep: 0, type: 'scale' });
  useScrollReveal('.js-hero-pop', { delayStep: 150, type: 'scale' });
  useScrollReveal('.js-step-dot', { delayStep: 190, reverseOnUp: true, type: 'scale' });
  useScrollReveal('.js-step-copy', { delayStep: 180, reverseOnUp: true, type: 'left' });

  return (
    <>
      <SeoHead
        title="ScheduleMe — Local Service Booking for Campus and Nearby Pros"
        description="Find local service providers, browse campus and nearby pros, and book help in one place with ScheduleMe."
        path="/"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
            email: 'usescheduleme@gmail.com',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: SITE_NAME,
            url: SITE_URL,
            potentialAction: {
              '@type': 'SearchAction',
              target: `${SITE_URL}/browse?q={search_term_string}`,
              'query-input': 'required name=search_term_string',
            },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            serviceType: 'Local service booking marketplace',
            name: 'ScheduleMe consumer marketplace',
            provider: {
              '@type': 'Organization',
              name: SITE_NAME,
              url: SITE_URL,
            },
            areaServed: 'United States',
            description: 'ScheduleMe helps people discover, message, and book local service providers, including campus and nearby pros.',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map((faq) => ({
              '@type': 'Question',
              name: faq.q,
              acceptedAnswer: {
                '@type': 'Answer',
                text: faq.a,
              },
            })),
          },
        ]}
      />
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#ffffff" />
      </Head>

      <Nav />

      <main>
        <Hero
          eyebrow={cms.hero.eyebrow}
          headline={cms.hero.headline}
          subheadline={cms.hero.subheadline}
          ctaPrimary={cms.hero.cta_primary}
          ctaSecondary={cms.hero.cta_secondary}
          trustLine={cms.hero.trust_line}
        />

        {/* Stats strip */}
        <section className="py-16" style={{ background: dm ? '#111111' : '#171717' }} aria-label="Key stats">
          <div className="mx-auto max-w-5xl px-6">
            <ul className="grid grid-cols-2 md:grid-cols-4 gap-8" role="list">
              {STATS.map((s) => (
                <li key={s.label} className="js-stat text-center">
                  <p className="text-3xl md:text-4xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>{s.value}</p>
                  <p className="text-sm text-neutral-400 mt-1.5">{s.label}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-28" style={{ background: dm ? '#0a0a0a' : 'white' }} aria-labelledby="features-heading">
          <div className="mx-auto max-w-6xl px-6">
            <div className="js-section text-center mb-20">
              <span className="section-eyebrow">Why ScheduleMe</span>
              <h2 id="features-heading" className="mt-4 text-4xl md:text-5xl font-bold" style={{ color: dm ? 'white' : '#171717' }}>
                Everything you need,<br className="hidden md:block" /> nothing you don&apos;t.
              </h2>
              <p className="mt-5 text-lg max-w-xl mx-auto leading-relaxed" style={{ color: dm ? '#737373' : '#737373' }}>
                Built for the moment you need help fast — and for providers that actually show up.
              </p>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" role="list">
              {features.map((feature) => (
                <li key={feature.title} className="js-feat p-7 group hover:-translate-y-1 hover:shadow-xl transition-all duration-300 rounded-2xl" style={{ background: dm ? '#171717' : 'white', border: dm ? '1px solid #262626' : '1px solid rgba(0,0,0,0.07)', boxShadow: dm ? 'none' : '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div className="h-11 w-11 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-accent group-hover:text-white transition-colors duration-300" style={{ background: dm ? 'rgba(15,118,110,0.15)' : '#DCEEEB', color: '#0F766E' }}>
                    {ICONS[feature.icon] ?? null}
                  </div>
                  <h3 className="text-base font-semibold mb-2" style={{ color: dm ? 'white' : '#171717' }}>{feature.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: dm ? '#737373' : '#737373' }}>{feature.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24" style={{ background: dm ? '#0d0d0d' : '#fafafa' }} aria-labelledby="testimonials-heading">
          <div className="mx-auto max-w-6xl px-6">
            <div className="js-section text-center mb-16">
              <span className="section-eyebrow">Real stories</span>
              <h2 id="testimonials-heading" className="mt-4 text-4xl font-bold" style={{ color: dm ? 'white' : '#171717' }}>People love ScheduleMe</h2>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-6" role="list">
              {[
                { quote: "Wanted a photographer for my girlfriend and I's date. Was Incredibly easy to find a campus photographer. He did Incredible.", name: "Noah F.", location: "Berkeley, CA", service: "Plumbing" },
                { quote: "My fan broke on one of the hottest days. Found a techy dude on my campus page, booked a custom requrest. He saved me so much money.", name: "Andrew C.", location: "Tempe, AZ", service: "HVAC" },
                { quote: "Finally a booking tool that doesn't make me call five places. I just typed what I needed.", name: "Misty V.", location: "Fresno, CA", service: "Home Repair" },
              ].map((t, cardIdx) => (
                <li key={t.name} className="js-testimonial p-7 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-default" style={{ background: dm ? '#171717' : 'white', border: dm ? '1px solid #262626' : '1px solid rgba(0,0,0,0.07)' }}>
                  <div className="flex gap-0.5 mb-4 js-testimonial-stars" aria-label="5 stars">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className="js-testimonial-star text-amber-400 text-sm" style={{ animationDelay: `${160 + (cardIdx * 140) + (i * 70)}ms` }} aria-hidden="true">★</span>
                    ))}
                  </div>
                  <blockquote className="text-sm leading-relaxed mb-5" style={{ color: dm ? '#a3a3a3' : '#404040' }}>&ldquo;{t.quote}&rdquo;</blockquote>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full flex items-center justify-center text-accent font-bold text-sm flex-shrink-0" style={{ background: dm ? 'rgba(15,118,110,0.15)' : '#DCEEEB' }}>{t.name.charAt(0)}</div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: dm ? 'white' : '#171717' }}>{t.name}</p>
                      <p className="text-xs" style={{ color: dm ? '#525252' : '#a3a3a3' }}>{t.location} · {t.service}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-28" style={{ background: dm ? '#0a0a0a' : 'white' }} aria-labelledby="how-heading">
          <div className="mx-auto max-w-4xl px-6">
            <div className="js-section text-center mb-20">
              <span className="section-eyebrow">How It Works</span>
              <h2 id="how-heading" className="mt-4 text-4xl md:text-5xl font-bold" style={{ color: dm ? 'white' : '#171717' }}>
                From problem to pro<br className="hidden md:block" /> in under 60 seconds.
              </h2>
            </div>
            <ol className="relative space-y-0" role="list">
              <div className="absolute left-6 top-6 bottom-6 w-px hidden md:block" style={{ background: dm ? '#262626' : '#f5f5f5' }} aria-hidden="true" />
              {demoSteps.map((step) => (
                <li key={step.step} className="js-step relative flex items-start gap-8 pb-12 last:pb-0">
                  <div className="js-step-dot relative flex-shrink-0 h-12 w-12 rounded-full bg-accent text-white flex items-center justify-center text-lg font-bold shadow-lg shadow-accent/20 z-10" aria-hidden="true">
                    {step.step}
                  </div>
                  <div className="js-step-copy pt-2.5">
                    <h3 className="text-lg font-semibold mb-1" style={{ color: dm ? 'white' : '#171717' }}>{step.title}</h3>
                    <p className="leading-relaxed" style={{ color: dm ? '#737373' : '#737373' }}>{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="js-section mt-14 text-center">
              <Link href="/signin?mode=signup" className="btn-primary text-base px-10 py-4 shadow-lg shadow-accent/20">Try It Now — It&apos;s Free →</Link>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-28" style={{ background: dm ? '#0a0a0a' : 'white' }} aria-labelledby="pricing-heading">
          <div className="mx-auto max-w-5xl px-6">
            <div className="js-section text-center mb-16">
              <span className="section-eyebrow">Pricing</span>
              <h2 id="pricing-heading" className="mt-4 text-4xl md:text-5xl font-bold" style={{ color: dm ? 'white' : '#171717' }}>
                Simple, honest pricing.
              </h2>
              <p className="mt-5 text-lg max-w-xl mx-auto leading-relaxed" style={{ color: dm ? '#8b8b8b' : '#6b7280' }}>
                Free for people who need help. Providers only pay for results.
              </p>
            </div>

            <div className="js-pricing-item rounded-3xl p-8 md:p-12 mx-auto max-w-3xl" style={{ background: dm ? 'linear-gradient(180deg,#141414,#101010)' : 'linear-gradient(180deg,#ffffff,#f9fbfb)', border: dm ? '1px solid #2b2b2b' : '1px solid rgba(15,118,110,0.14)', boxShadow: dm ? '0 20px 46px rgba(0,0,0,0.45)' : '0 12px 34px rgba(15,118,110,0.09)' }}>
              <p className="inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em]" style={{ background: dm ? 'rgba(15,118,110,0.24)' : 'rgba(15,118,110,0.12)', color: '#0F766E' }}>
                Consumer pricing
              </p>
              <h3 className="mt-5 text-3xl md:text-4xl font-black" style={{ color: dm ? 'white' : '#111827', letterSpacing: '-0.02em' }}>
                Always free for users.
              </h3>
              <p className="mt-4 text-base md:text-lg leading-relaxed" style={{ color: dm ? '#a3a3a3' : '#6b7280' }}>
                No account required. No credit card. No hidden fees.
                Describe your issue and get matched with vetted pros for free.
              </p>
              <ul className="mt-6 space-y-2.5">
                {[
                  'Quick matching based on what you need',
                  'Instant matching with local pros',
                  'Real reviews and ratings',
                  'Direct contact with providers',
                  'No booking fees or commissions',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm md:text-base" style={{ color: dm ? '#d1d5db' : '#374151' }}>
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/signin?mode=signup" className="btn-primary text-base px-8 py-3.5 shadow-lg shadow-accent/20">Browse local help — Free →</Link>
              </div>
            </div>

            <div className="js-pricing-item mt-8 rounded-3xl p-6 md:p-7 mx-auto max-w-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4" style={{ background: dm ? 'linear-gradient(180deg,#121212,#101010)' : 'linear-gradient(180deg,#ffffff,#f9fbfb)', border: dm ? '1px solid #2b2b2b' : '1px solid rgba(15,118,110,0.16)', boxShadow: dm ? '0 14px 36px rgba(0,0,0,0.38)' : '0 8px 24px rgba(15,118,110,0.06)' }}>
              <div>
                <p className="text-lg font-bold mb-1" style={{ color: dm ? 'white' : '#111827' }}>Building as a student provider?</p>
                <p className="text-sm md:text-base" style={{ color: dm ? '#9ca3af' : '#4b5563' }}>
                  Grow in your campus marketplace and only pay for real completed bookings.
                </p>
              </div>
              <Link href="/provider#pricing" className="btn-primary px-6 py-3 text-sm shrink-0">See Student Provider Plans →</Link>
            </div>
          </div>
        </section>

        {/* Provider teaser */}
        <section className="py-24 bg-neutral-950" aria-labelledby="biz-teaser-heading">
          <div className="mx-auto max-w-5xl px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-12">
              <div className="max-w-lg js-section js-biz-copy">
                <span className="section-eyebrow mb-4 block">For Service Providers</span>
                <h2 id="biz-teaser-heading" className="text-3xl md:text-4xl font-bold text-white mb-5">
                  Show up where students already look for help.
                </h2>
                <p className="text-neutral-400 leading-relaxed mb-8">
                  Build a clean provider page, set your hours, and respond to real campus demand without cold calls or bloated ad tools.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/provider" className="btn-primary px-7 py-3">See provider setup</Link>
                  <Link href="/provider/signup" className="inline-flex items-center justify-center px-7 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-200 text-sm font-semibold hover:bg-neutral-700 transition-colors">Create provider account</Link>
                  <Link href="/provider/dashboard" className="inline-flex items-center justify-center px-7 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-200 text-sm font-semibold hover:bg-neutral-700 transition-colors">Provider Dashboard →</Link>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-4 w-full md:w-auto md:flex-shrink-0" role="list">
                {[
                  { label: 'Custom provider page' },
                  { label: 'Business hours controls' },
                  { label: 'Messaging and bookings' },
                  { label: 'Stripe or Zelle payouts' },
                ].map((item) => (
                  <li key={item.label} className="js-biz-item bg-neutral-900 border border-neutral-800 rounded-2xl px-5 py-4 flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true"></span>
                    <span className="text-sm font-medium text-neutral-200">{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>


        {/* FAQ */}
        <section className="py-24" id="faq" style={{ background: dm ? '#0d0d0d' : '#fafafa' }} aria-labelledby="faq-heading">
          <div className="mx-auto max-w-3xl px-6">
            <div className="text-center mb-14 js-section">
              <span className="section-eyebrow mb-3 block">FAQ</span>
              <h2 id="faq-heading" className="text-3xl md:text-4xl font-bold" style={{ color: dm ? 'white' : '#171717' }}>Common questions</h2>
            </div>
            <FaqAccordion />
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24" style={{ background: dm ? '#0a0a0a' : 'white' }} aria-labelledby="final-cta-heading">
          <div className="mx-auto max-w-3xl px-6 text-center js-section">
            <h2 id="final-cta-heading" className="text-3xl md:text-4xl font-bold mb-4" style={{ color: dm ? 'white' : '#171717' }}>Ready to book local help?</h2>
            <p className="mb-8 text-lg" style={{ color: dm ? '#737373' : '#737373' }}>Describe what you need, compare real providers, and book without the usual back-and-forth.</p>
            <Link href="/signin?mode=signup" className="btn-primary text-base px-10 py-4 shadow-lg shadow-accent/20">Get Started Free →</Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-neutral-950 py-14 border-t border-neutral-900">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col md:flex-row items-start justify-between gap-10 mb-10">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <span className="text-xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>
                  Schedule<span className="text-accent">Me</span>
                </span>
              </div>
              <p className="text-sm text-neutral-500 max-w-xs">{cms.footer.tagline}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-16 gap-y-2">
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">Explore</p>
                <ul className="space-y-2" role="list">
                  {[{ label: 'Browse services', href: '/browse' }, { label: 'How it works', href: '/#how-it-works' }, { label: 'Campus marketplace', href: '/campus' }].map((l) => (
                    <li key={l.href}><Link href={l.href} className="text-sm text-neutral-500 hover:text-neutral-200 transition-colors">{l.label}</Link></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">Providers</p>
                <ul className="space-y-2" role="list">
                  {[{ label: 'Become a provider', href: '/provider' }, { label: 'Create account', href: '/provider/signup' }, { label: 'Provider dashboard', href: '/provider/dashboard' }].map((l) => (
                    <li key={l.href}><Link href={l.href} className="text-sm text-neutral-500 hover:text-neutral-200 transition-colors">{l.label}</Link></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-neutral-900 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-neutral-600">{cms.footer.copyright}</p>
            <nav aria-label="Footer legal">
              <ul className="flex gap-5" role="list">
                {cms.footer.links.map((link) => (
                  <li key={link.label}><a href={link.href} className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">{link.label}</a></li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </footer>
    </>
  );
};

export const getStaticProps: GetStaticProps<HomeProps> = async () => ({
  props: { features: cms.features, demoSteps: cms.demo_steps },
});

export default Home;
