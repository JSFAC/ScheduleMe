// pages/support.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Nav from '../components/Nav';

const EMAIL_PRIMARY = 'usescheduleme@gmail.com';
const EMAIL_FALLBACK = 'support@usescheduleme.com';
const LAST_UPDATED = 'April 11, 2026';

const faqs = [
  {
    q: 'How do I contact ScheduleMe support?',
    a: `Email ${EMAIL_PRIMARY}. You can also copy ${EMAIL_FALLBACK} if needed.`,
  },
  {
    q: 'How long does support take to reply?',
    a: 'Most requests are answered within 1 business day.',
  },
  {
    q: 'What should I include in my support request?',
    a: 'Include your account email, device type, app version, and a short description of the issue so we can resolve it faster.',
  },
  {
    q: 'Can I report safety or account access issues?',
    a: 'Yes. Include "Urgent Security" in the subject line and we will prioritize the request.',
  },
];

const Support: NextPage = () => (
  <>
    <Head>
      <title>Support — ScheduleMe</title>
      <meta
        name="description"
        content="ScheduleMe support contact details, help resources, and response expectations for mobile app and website users."
      />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </Head>

    <Nav />

    <main className="pt-28 pb-24 bg-white">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-12 pb-8 border-b border-neutral-100">
          <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-3">Help</p>
          <h1 className="text-4xl font-bold text-neutral-900 mb-4" style={{ letterSpacing: '-0.025em' }}>
            ScheduleMe Support
          </h1>
          <p className="text-sm text-neutral-400">Last updated: {LAST_UPDATED}</p>
          <p className="text-neutral-600 mt-4 leading-relaxed">
            Need help with your consumer or provider account? Contact our support team and include as much detail as possible so we can assist quickly.
          </p>
        </div>

        <section className="mb-10">
          <h2 className="text-lg font-bold text-neutral-900 mb-3">Contact Support</h2>
          <div className="rounded-2xl border border-neutral-200 p-5 bg-neutral-50">
            <p className="text-sm text-neutral-700 mb-2">
              Primary email:{' '}
              <a className="text-accent hover:underline" href={`mailto:${EMAIL_PRIMARY}`}>
                {EMAIL_PRIMARY}
              </a>
            </p>
            <p className="text-sm text-neutral-700 mb-2">
              Backup email:{' '}
              <a className="text-accent hover:underline" href={`mailto:${EMAIL_FALLBACK}`}>
                {EMAIL_FALLBACK}
              </a>
            </p>
            <p className="text-sm text-neutral-600">
              Response time: usually within 1 business day.
            </p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-bold text-neutral-900 mb-3">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((item) => (
              <div key={item.q} className="rounded-xl border border-neutral-200 p-4">
                <h3 className="text-sm font-semibold text-neutral-900 mb-1.5">{item.q}</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-neutral-900 mb-3">Helpful Links</h2>
          <div className="flex flex-wrap gap-5 text-sm">
            <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>
            <Link href="/terms" className="text-accent hover:underline">Terms of Service</Link>
            <Link href="/" className="text-accent hover:underline">Back to Home</Link>
          </div>
        </section>
      </div>
    </main>
  </>
);

export default Support;
