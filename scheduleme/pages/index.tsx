// pages/index.tsx
import type { NextPage, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect } from 'react';
import Nav from '../components/Nav';
import Hero from '../components/Hero';
import cms from '../cms_content.json';

interface Feature { icon: string; title: string; description: string; }
interface DemoStep { step: number; title: string; description: string; }
interface HomeProps { features: Feature[]; demoSteps: DemoStep[]; }

function useScrollReveal(selector: string, delayStep = 90) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
    els.forEach((el, i) => {
      el.setAttribute('data-reveal', 'hidden');
      el.style.transitionDelay = `${i * delayStep}ms`;
    });
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.setAttribute('data-reveal', 'visible'); io.unobserve(e.target); }
      }),
      { threshold: 0.1, rootMargin: '0px 0px -48px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [selector, delayStep]);
}

const ICONS: Record<string, JSX.Element> = {
  brain: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15m-4.8-.786V20.25" /></svg>,
  zap: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>,
  calendar: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
  shield: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
};

const STATS = [
  { value: '2,400+', label: 'Local businesses' },
  { value: '98%', label: 'Match accuracy' },
  { value: '<60s', label: 'Avg. booking time' },
  { value: '4.9★', label: 'Customer rating' },
];

const Home: NextPage<HomeProps> = ({ features, demoSteps }) => {
  useScrollReveal('.js-feat', 100);
  useScrollReveal('.js-step', 130);
  useScrollReveal('.js-stat', 80);
  useScrollReveal('.js-section', 0);
  useScrollReveal('.js-testimonial', 100);
  useScrollReveal('.js-biz-item', 90);

  return (
    <>
      <Head>
        <title>ScheduleMe — AI-Powered Local Service Booking</title>
        <meta name="description" content="Describe your issue, get instantly triaged, and book a vetted local pro — in seconds." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
        <section className="bg-neutral-900 py-16" aria-label="Key stats">
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
        <section id="features" className="py-28 bg-white" aria-labelledby="features-heading">
          <div className="mx-auto max-w-6xl px-6">
            <div className="js-section text-center mb-20">
              <span className="section-eyebrow">Why ScheduleMe</span>
              <h2 id="features-heading" className="mt-4 text-4xl md:text-5xl font-bold text-neutral-900">
                Everything you need,<br className="hidden md:block" /> nothing you don&apos;t.
              </h2>
              <p className="mt-5 text-lg text-neutral-500 max-w-xl mx-auto leading-relaxed">
                Built for the moment you need help fast — and for the businesses that show up.
              </p>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" role="list">
              {features.map((feature) => (
                <li key={feature.title} className="js-feat card p-7 group hover:-translate-y-1 transition-transform duration-300">
                  <div className="h-11 w-11 rounded-2xl bg-accent-light text-accent flex items-center justify-center mb-5 group-hover:bg-accent group-hover:text-white transition-colors duration-300">
                    {ICONS[feature.icon] ?? null}
                  </div>
                  <h3 className="text-base font-semibold text-neutral-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{feature.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 bg-neutral-50" aria-labelledby="testimonials-heading">
          <div className="mx-auto max-w-6xl px-6">
            <div className="js-section text-center mb-16">
              <span className="section-eyebrow">Real stories</span>
              <h2 id="testimonials-heading" className="mt-4 text-4xl font-bold text-neutral-900">People love ScheduleMe</h2>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-6" role="list">
              {[
                { quote: "Described a leaking pipe, got three plumbers within 2 minutes. Booked in 45 seconds. Incredible.", name: "Maria L.", location: "Austin, TX", service: "Plumbing" },
                { quote: "My AC died on the hottest day of summer. ScheduleMe found me an emergency tech in under a minute.", name: "James T.", location: "Phoenix, AZ", service: "HVAC" },
                { quote: "Finally a booking tool that doesn't make me call five places. I just typed what I needed.", name: "Sandra K.", location: "Denver, CO", service: "Home Repair" },
              ].map((t) => (
                <li key={t.name} className="js-testimonial card p-7">
                  <div className="flex gap-0.5 mb-4" aria-label="5 stars">
                    {Array.from({ length: 5 }).map((_, i) => <span key={i} className="text-amber-400 text-sm" aria-hidden="true">★</span>)}
                  </div>
                  <blockquote className="text-sm text-neutral-700 leading-relaxed mb-5">&ldquo;{t.quote}&rdquo;</blockquote>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-accent-light flex items-center justify-center text-accent font-bold text-sm flex-shrink-0">{t.name.charAt(0)}</div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{t.name}</p>
                      <p className="text-xs text-neutral-400">{t.location} · {t.service}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-28 bg-white" aria-labelledby="how-heading">
          <div className="mx-auto max-w-4xl px-6">
            <div className="js-section text-center mb-20">
              <span className="section-eyebrow">How It Works</span>
              <h2 id="how-heading" className="mt-4 text-4xl md:text-5xl font-bold text-neutral-900">
                From problem to pro<br className="hidden md:block" /> in under 60 seconds.
              </h2>
            </div>
            <ol className="relative space-y-0" role="list">
              <div className="absolute left-6 top-6 bottom-6 w-px bg-neutral-100 hidden md:block" aria-hidden="true" />
              {demoSteps.map((step) => (
                <li key={step.step} className="js-step relative flex items-start gap-8 pb-12 last:pb-0">
                  <div className="relative flex-shrink-0 h-12 w-12 rounded-full bg-accent text-white flex items-center justify-center text-lg font-bold shadow-lg shadow-accent/20 z-10" aria-hidden="true">
                    {step.step}
                  </div>
                  <div className="pt-2.5">
                    <h3 className="text-lg font-semibold text-neutral-900 mb-1">{step.title}</h3>
                    <p className="text-neutral-500 leading-relaxed">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="js-section mt-14 text-center">
              <Link href="/demo" className="btn-primary text-base px-10 py-4 shadow-lg shadow-accent/20">Try It Now — It&apos;s Free →</Link>
            </div>
          </div>
        </section>

        {/* Business teaser */}
        <section className="py-24 bg-neutral-950" aria-labelledby="biz-teaser-heading">
          <div className="mx-auto max-w-5xl px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-12">
              <div className="max-w-lg js-section">
                <span className="section-eyebrow mb-4 block">For Service Businesses</span>
                <h2 id="biz-teaser-heading" className="text-3xl md:text-4xl font-bold text-white mb-5">
                  Get pre-qualified leads delivered directly to you.
                </h2>
                <p className="text-neutral-400 leading-relaxed mb-8">
                  Join 2,400+ local pros on ScheduleMe. No cold calls, no ad spend — just customers who need exactly what you offer, right now.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/business" className="btn-primary px-7 py-3">Learn More</Link>
                  <Link href="/business/signup" className="inline-flex items-center justify-center px-7 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-200 text-sm font-semibold hover:bg-neutral-700 transition-colors">Join for Free</Link>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-4 w-full md:w-auto md:flex-shrink-0" role="list">
                {[
                  { icon: '📥', label: 'Instant lead alerts' },
                  { icon: '🎯', label: 'Pre-qualified matches' },
                  { icon: '📊', label: 'Business dashboard' },
                  { icon: '💳', label: 'Pay per lead' },
                ].map((item) => (
                  <li key={item.label} className="js-biz-item bg-neutral-900 border border-neutral-800 rounded-2xl px-5 py-4 flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">{item.icon}</span>
                    <span className="text-sm font-medium text-neutral-200">{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 bg-white" aria-labelledby="final-cta-heading">
          <div className="mx-auto max-w-3xl px-6 text-center js-section">
            <h2 id="final-cta-heading" className="text-3xl md:text-4xl font-bold text-neutral-900 mb-4">Ready to find your pro?</h2>
            <p className="text-neutral-500 mb-8 text-lg">Free for users. Always. Describe your issue and get matched in seconds.</p>
            <Link href="/demo" className="btn-primary text-base px-10 py-4 shadow-lg shadow-accent/20">Get Started — No Account Needed</Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-neutral-950 py-14 border-t border-neutral-900">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col md:flex-row items-start justify-between gap-10 mb-10">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <span className="h-8 w-8 rounded-xl bg-accent flex items-center justify-center text-white font-black">S</span>
                <span className="text-xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>ScheduleMe</span>
              </div>
              <p className="text-sm text-neutral-500 max-w-xs">{cms.footer.tagline}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-16 gap-y-2">
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">Product</p>
                <ul className="space-y-2" role="list">
                  {[{ label: 'Find a Pro', href: '/demo' }, { label: 'Pricing', href: '/pricing' }, { label: 'How It Works', href: '/#how-it-works' }].map((l) => (
                    <li key={l.href}><Link href={l.href} className="text-sm text-neutral-500 hover:text-neutral-200 transition-colors">{l.label}</Link></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">Business</p>
                <ul className="space-y-2" role="list">
                  {[{ label: 'Join as a Pro', href: '/business' }, { label: 'Sign Up', href: '/business/signup' }, { label: 'Dashboard', href: '/dashboard' }].map((l) => (
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
