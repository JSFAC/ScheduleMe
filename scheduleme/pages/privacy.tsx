// pages/privacy.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Nav from '../components/Nav';

const LAST_UPDATED = 'March 1, 2026';
const COMPANY = 'ScheduleMe, Inc.';
const EMAIL = 'privacy@usescheduleme.com';

const sections = [
  {
    title: '1. Information We Collect',
    content: [
      {
        subtitle: 'Information you provide',
        body: 'When you use ScheduleMe as a consumer, we collect the name, phone number, and location you submit in the service request form. When you sign up as a business, we collect your business name, owner name, email address, phone number, service category, and city. You may also optionally provide a license number, years in business, and a Calendly scheduling URL.',
      },
      {
        subtitle: 'Information collected automatically',
        body: 'When you visit our website, we automatically collect certain technical information including your IP address, browser type, pages visited, and referring URLs. This information is used solely for analytics and security purposes. We do not sell or share this data with third-party advertisers.',
      },
      {
        subtitle: 'Location data',
        body: 'If you grant browser permission, we may collect your device\'s precise geolocation to improve local matching accuracy. You may decline this permission at any time — the service will still function using the city or zip code you provide manually.',
      },
    ],
  },
  {
    title: '2. How We Use Your Information',
    content: [
      {
        subtitle: 'To provide the service',
        body: 'Consumer information (name, phone, location, service description) is used to perform AI triage and match you with relevant local service businesses. Your contact information may be shared with matched businesses so they can respond to your request.',
      },
      {
        subtitle: 'To operate the business platform',
        body: 'Business information is used to create and manage your profile on our platform, verify your credentials, and deliver matched leads to your dashboard.',
      },
      {
        subtitle: 'To communicate with you',
        body: 'We may use your email or phone number to send booking confirmations, lead alerts, platform updates, and support messages. You may opt out of marketing communications at any time.',
      },
      {
        subtitle: 'To improve our service',
        body: 'Aggregate, anonymized usage data helps us improve AI matching quality, platform performance, and user experience. This data cannot be used to identify any individual.',
      },
    ],
  },
  {
    title: '3. Information Sharing',
    content: [
      {
        subtitle: 'With matched businesses',
        body: 'When you submit a service request, your name, phone number, location, and service description are shared with the businesses we match you with. By submitting a request, you consent to this sharing.',
      },
      {
        subtitle: 'With service providers',
        body: 'We use trusted third-party services to operate our platform, including Supabase (database and authentication), Vercel (hosting), Anthropic (AI processing), and Stripe (payments). These providers process data only as necessary to deliver services to us and are contractually bound to protect your information.',
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
        body: 'We retain consumer request data for up to 12 months to allow businesses to follow up on leads. Business account data is retained for the duration of your account and for 90 days after account closure. You may request deletion of your data at any time by contacting us at ' + EMAIL + '.',
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
        body: 'Depending on your jurisdiction, you may have the right to access, correct, or delete your personal information; object to or restrict certain processing; request data portability; and withdraw consent at any time. To exercise any of these rights, contact us at ' + EMAIL + '. We will respond within 30 days.',
      },
    ],
  },
  {
    title: '7. Cookies',
    content: [
      {
        subtitle: '',
        body: 'We use essential cookies to maintain session state and authentication. We do not use advertising or tracking cookies. You may disable cookies in your browser settings, though some features of the platform may not function correctly as a result.',
      },
    ],
  },
  {
    title: '8. Children\'s Privacy',
    content: [
      {
        subtitle: '',
        body: 'ScheduleMe is not directed at children under the age of 13. We do not knowingly collect personal information from children. If you believe we have inadvertently collected information from a child, please contact us immediately and we will delete it.',
      },
    ],
  },
  {
    title: '9. Changes to This Policy',
    content: [
      {
        subtitle: '',
        body: 'We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page with an updated "Last updated" date, and where appropriate, by email. Your continued use of the service after changes are posted constitutes your acceptance of the revised policy.',
      },
    ],
  },
  {
    title: '10. Contact Us',
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
