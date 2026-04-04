// pages/privacy.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Nav from '../components/Nav';

const LAST_UPDATED = 'April 4, 2026';
const COMPANY = 'ScheduleMe';
const EMAIL = 'usescheduleme@gmail.com';

const sections = [
  {
    title: '1. Information We Collect',
    content: [
      {
        subtitle: 'Information you provide',
        body: 'We collect the information you choose to provide, such as name, email, phone number, school email, zip code, service requests, booking notes, messages, and profile content (photos, videos, descriptions). Businesses may also provide business details (service categories, hours, pricing, coverage area) and payout information via Stripe.',
      },
      {
        subtitle: 'Information collected automatically',
        body: 'We collect basic technical data such as IP address, device type, browser, pages viewed, and approximate location from IP to keep the service secure and improve performance. We do not sell or rent personal data.',
      },
      {
        subtitle: 'Location data',
        body: 'If you grant permission, we may collect your device’s precise geolocation to improve nearby matching. You can decline this permission and still use the service by entering a city or zip code.',
      },
      {
        subtitle: 'Payments',
        body: 'Payments are processed by Stripe. We do not store full card numbers on our servers. Stripe may store payment method details and transaction data as required to process payments and comply with law.',
      },
    ],
  },
  {
    title: '2. How We Use Your Information',
    content: [
      {
        subtitle: 'To provide the service',
        body: 'We use your information to match requests to providers, process bookings, enable messaging, and help businesses complete services. Contact information is shared with the provider you choose so they can fulfill your request.',
      },
      {
        subtitle: 'To operate the business platform',
        body: 'Business information is used to create and manage profiles, verify campus status, and deliver matched requests.',
      },
      {
        subtitle: 'To communicate with you',
        body: 'We may use your email or phone number to send booking confirmations, lead alerts, platform updates, and support messages. You may opt out of marketing communications at any time.',
      },
      {
        subtitle: 'To improve our service',
        body: 'Aggregate usage data helps us improve matching quality, platform performance, and user experience. This data cannot be used to identify you.',
      },
    ],
  },
  {
    title: '3. Information Sharing',
    content: [
      {
        subtitle: 'With matched businesses',
        body: 'When you request a service or book a provider, your name, contact details, location, and request details are shared with that provider.',
      },
      {
        subtitle: 'With service providers',
        body: 'We use trusted third‑party services to operate the platform, including Supabase (database/auth), Vercel (hosting), Resend (email), and Stripe (payments). These providers process data only as needed to deliver the service.',
      },
      {
        subtitle: 'Legal requirements',
        body: 'We may disclose information if required by law, court order, or government authority, or if we believe disclosure is necessary to protect the rights, property, or safety of ScheduleMe, our users, or the public.',
      },
      {
        subtitle: 'We do not sell your data',
        body: 'ScheduleMe does not sell, rent, or trade your personal information to third parties for marketing or advertising purposes. Ever.',
      },
    ],
  },
  {
    title: '4. Data Retention',
    content: [
      {
        subtitle: '',
        body: 'We retain account and booking data while your account is active. If you delete your account, we retain essential records for compliance and fraud prevention for up to 90 days, unless a longer retention period is required by law. You can request deletion or export at any time by contacting us at ' + EMAIL + '.',
      },
    ],
  },
  {
    title: '5. Security',
    content: [
      {
        subtitle: '',
        body: 'We implement industry-standard security measures including encrypted data transmission (TLS), encrypted storage, and role-based access controls. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security. We encourage you to use strong passwords and notify us immediately of any suspected unauthorized access.',
      },
    ],
  },
  {
    title: '6. Your Rights',
    content: [
      {
        subtitle: '',
        body: 'Depending on your jurisdiction (including California and the EEA), you may have the right to access, correct, delete, or export your information and to opt out of certain processing. To exercise these rights, contact us at ' + EMAIL + '. We will respond within 30 days.',
      },
    ],
  },
  {
    title: '7. Data We Collect (Summary)',
    content: [
      {
        subtitle: '',
        body: 'Identifiers (name, email, phone), account details (school email, campus status), request details (service name, notes, attachments), communications (messages), location (precise if enabled, otherwise zip/city), payment metadata (via Stripe), device and usage data (IP, browser, pages viewed), and support communications.',
      },
    ],
  },
  {
    title: '8. Cookies',
    content: [
      {
        subtitle: '',
        body: 'We use essential cookies to maintain session state and authentication. We do not use advertising or tracking cookies. You may disable cookies in your browser settings, though some features of the platform may not function correctly as a result.',
      },
    ],
  },
  {
    title: '9. Children\'s Privacy',
    content: [
      {
        subtitle: '',
        body: 'ScheduleMe is not directed at children under the age of 13. We do not knowingly collect personal information from children. If you believe we have inadvertently collected information from a child, please contact us immediately and we will delete it.',
      },
    ],
  },
  {
    title: '10. Changes to This Policy',
    content: [
      {
        subtitle: '',
        body: 'We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page with an updated "Last updated" date, and where appropriate, by email. Your continued use of the service after changes are posted constitutes your acceptance of the revised policy.',
      },
    ],
  },
  {
    title: '11. Contact Us',
    content: [
      {
        subtitle: '',
        body: `If you have questions or concerns about this Privacy Policy or our data practices, please contact us at ${EMAIL} or write to us at ${COMPANY}, Privacy Team.`,
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
            <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors">Back to Home</Link>
          </div>
        </div>
      </div>
    </main>
  </>
);

export default Privacy;
