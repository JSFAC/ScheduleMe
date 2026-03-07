// pages/demo.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Nav from '../components/Nav';
import IntakeForm from '../components/IntakeForm';

const Demo: NextPage = () => {
  return (
    <>
      <Head>
        <title>ScheduleMe — Find Your Pro</title>
        <meta name="description" content="Describe your service issue and get instantly matched with vetted local professionals." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Nav />

      <main
        className="bg-neutral-50"
        style={{ minHeight: '100dvh', paddingTop: '72px', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '3rem 1.5rem' }}>
          <div className="mx-auto w-full" style={{ maxWidth: '560px' }}>
            {/* Header */}
            <div className="text-center mb-10">
              <span className="section-eyebrow mb-3 block">AI-Powered Triage</span>
              <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-3">
                Describe your issue
              </h1>
              <p className="text-neutral-500 leading-relaxed">
                Tell us what&apos;s wrong in plain language — our AI will identify the service type,
                urgency, and match you with the best local pros.
              </p>
            </div>

            {/* Form card */}
            <div className="card p-8">
              <IntakeForm />
            </div>

            {/* Trust badges — SVG icons, no emojis */}
            <div className="mt-8 flex items-center justify-center gap-8 flex-wrap">
              {[
                {
                  label: 'Secure & Private',
                  icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
                },
                {
                  label: 'Instant Triage',
                  icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>,
                },
                {
                  label: 'Verified Pros',
                  icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>,
                },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <span className="text-neutral-300">{icon}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default Demo;
