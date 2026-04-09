// pages/privacy.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Nav from '../components/Nav';

const LAST_UPDATED = 'April 9, 2026';
const COMPANY = 'ScheduleMe';
const EMAIL = 'usescheduleme@gmail.com';

const sections = [
  {
    title: '1. What We Collect',
    content: [
      {
        subtitle: 'Account and profile data',
        body: 'Name, email, auth metadata (including sign-in provider and last sign-in time), campus verification data (.edu email domain and verification status), profile photo, provider profile details, service categories, service pricing, business media, and account settings.',
      },
      {
        subtitle: 'Booking and communication data',
        body: 'Booking records, requested date/time, notes, custom service pricing/dispute history, cancellation reasons, and in-app messages between consumers and providers.',
      },
      {
        subtitle: 'Location and device data',
        body: 'Precise location if you grant browser/device permission, saved last-known location for matching, approximate location from IP fallback, device/browser information, and basic security logs (including IP and request metadata). We use this to show nearby providers and protect against abuse.',
      },
      {
        subtitle: 'Payment data',
        body: 'We store booking payment metadata (amounts, status, Stripe IDs, payout/release metadata, and timestamps). Full card details are handled by Stripe and are not stored on ScheduleMe servers.',
      },
    ],
  },
  {
    title: '2. Why We Use It',
    content: [
      {
        subtitle: 'Core marketplace operations',
        body: 'To create accounts, verify users, show nearby providers, process bookings, power messaging, and manage provider dashboards.',
      },
      {
        subtitle: 'Payments and payouts',
        body: 'To collect payment, hold funds, process refunds, compute platform fees (including Founder50 rules), and support provider payout workflows.',
      },
      {
        subtitle: 'Notifications and support',
        body: 'To send verification emails, booking/payment updates, dispute updates, cancellation updates, and support replies.',
      },
      {
        subtitle: 'Security and fraud prevention',
        body: 'To detect abuse, enforce platform policy, investigate disputes, and protect users and ScheduleMe.',
      },
    ],
  },
  {
    title: '3. Third Parties We Use',
    content: [
      {
        subtitle: 'Infrastructure and auth',
        body: 'Supabase (database, authentication, storage), Vercel (hosting/runtime), Google and Apple auth providers (when you use social sign-in).',
      },
      {
        subtitle: 'Payments and email',
        body: 'Stripe (payment processing, refunds, payouts), Resend (transactional emails).',
      },
      {
        subtitle: 'Push notifications',
        body: 'Apple Push Notification service (APNs) and Firebase Cloud Messaging (FCM), directly or through a push provider, for app notification delivery.',
      },
      {
        subtitle: 'Provider data sharing',
        body: 'When you make or manage a booking, relevant booking and contact details are shared between consumer and provider to perform the service.',
      },
    ],
  },
  {
    title: '4. Retention Periods',
    content: [
      {
        subtitle: 'How long we keep data',
        body: 'Account/profile data is retained while your account is active. Booking/payment/dispute records are retained for up to 7 years for legal, tax, fraud, and reconciliation requirements. Security logs are generally retained up to 12 months unless required longer for investigations. Support requests are generally retained up to 24 months for follow-up and quality/safety review. De-identified analytics may be retained longer.',
      },
    ],
  },
  {
    title: '5. Deletion Rights and Process',
    content: [
      {
        subtitle: 'Account deletion',
        body: 'You can request account deletion in-app (where available) or by contacting support at ' + EMAIL + '. We verify identity before deletion. After verification, we delete or de-identify data that is not required to be retained. Records that must be preserved for legal, tax, fraud, or payment obligations may be retained for the required period. Typical request handling target is within 30 days.',
      },
    ],
  },
  {
    title: '6. Security',
    content: [
      {
        subtitle: '',
        body: 'We use encryption in transit, access controls, and production security best practices. No system is perfectly secure, but we continuously work to reduce risk.',
      },
    ],
  },
  {
    title: '7. Your Rights',
    content: [
      {
        subtitle: '',
        body: 'Depending on your location, you may have rights to access, correct, export, or delete your data. To exercise rights, email ' + EMAIL + '. We may need to verify identity before completing requests.',
      },
    ],
  },
  {
    title: '8. Cookies',
    content: [
      {
        subtitle: '',
        body: 'We use essential cookies for authentication and session continuity. We do not sell personal data.',
      },
    ],
  },
  {
    title: '9. Children\'s Privacy',
    content: [
      {
        subtitle: '',
        body: 'ScheduleMe is not intended for children under 13. If you believe a child provided personal data, contact us so we can investigate and remove it.',
      },
    ],
  },
  {
    title: '10. Changes to This Policy',
    content: [
      {
        subtitle: '',
        body: 'We may update this policy as product features evolve. Material changes will be posted here with a new "Last updated" date.',
      },
    ],
  },
  {
    title: '11. Contact',
    content: [
      {
        subtitle: '',
        body: `Questions, deletion requests, or privacy requests: ${EMAIL}. You can also use our support form at https://www.usescheduleme.com/support.`,
      },
    ],
  },
];

const Privacy: NextPage = () => (
  <>
    <Head>
      <title>Privacy Policy — ScheduleMe</title>
      <meta name="description" content="ScheduleMe Privacy Policy — how we collect, use, and protect your information." />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </Head>

    <Nav />

    <main className="pt-28 pb-24 bg-white">
      <div className="mx-auto max-w-3xl px-6">
        {/* Header */}
        <div className="mb-12 pb-8 border-b border-neutral-100">
          <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl font-bold text-neutral-900 mb-4" style={{ letterSpacing: '-0.025em' }}>Privacy Policy</h1>
          <p className="text-sm text-neutral-400">Last updated: {LAST_UPDATED}</p>
          <p className="text-neutral-600 mt-4 leading-relaxed">
            {COMPANY} ("ScheduleMe," "we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services at usescheduleme.com.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-bold text-neutral-900 mb-4">{section.title}</h2>
              <div className="space-y-4">
                {section.content.map((block, i) => (
                  <div key={i}>
                    {block.subtitle && (
                      <h3 className="text-sm font-semibold text-neutral-700 mb-1.5">{block.subtitle}</h3>
                    )}
                    <p className="text-sm text-neutral-600 leading-relaxed">{block.body}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-neutral-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <p className="text-xs text-neutral-400">© {new Date().getFullYear()} {COMPANY}. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/terms" className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors">Terms of Service</Link>
            <Link href="/support" className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors">Support</Link>
            <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors">Back to Home</Link>
          </div>
        </div>
      </div>
    </main>
  </>
);

export default Privacy;
