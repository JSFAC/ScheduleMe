// pages/terms.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Nav from '../components/Nav';

const LAST_UPDATED = 'April 9, 2026';
const COMPANY = 'ScheduleMe';
const EMAIL = 'usescheduleme@gmail.com';

const sections = [
  {
    title: '1. Acceptance of Terms',
    body: `By accessing or using the ScheduleMe platform (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service. These Terms apply to all visitors, consumers, and registered provider users. ${COMPANY} reserves the right to update these Terms at any time. Continued use of the Service after changes constitutes acceptance.`,
  },
  {
    title: '2. Description of Service',
    body: 'ScheduleMe connects consumers seeking local services with service providers, including campus and nearby providers. Consumers submit requests, browse providers, and book services. ScheduleMe is not itself a service provider and does not perform any services directly.',
  },
  {
    title: '3. Eligibility and Accounts',
    body: 'You must be at least 13 years old to use the Service. If you are under 18, you may use the Service only with the involvement of a parent or legal guardian. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to provide accurate, current, and complete information and to keep it updated.',
  },
  {
    title: '4. Marketplace Role (No Agency)',
    body: 'ScheduleMe is a marketplace and is not a party to any agreement between consumers and providers. We do not control, direct, or guarantee the work performed by providers, and providers are not our employees, partners, or agents. Any contract for services is solely between you and the provider. Providers are responsible for their own taxes, licensing, insurance, and legal compliance.',
  },
  {
    title: '5. Consumer Terms',
    body: 'As a consumer, you may submit service requests without creating an account. By submitting a request, you authorize ScheduleMe to share your contact information and service description with matched providers. You agree to provide accurate information. ScheduleMe does not guarantee the quality, safety, legality, or completion of any services performed by providers found through the platform.',
  },
  {
    title: '6. Provider Account Terms',
    body: 'To list a provider profile on ScheduleMe, you must create an account, complete onboarding, and pass verification. You represent that all information you provide is accurate and that you hold all required licenses, permits, and insurance required by applicable law. You are solely responsible for the services you provide to customers. ScheduleMe may suspend or terminate your account if we determine you have violated these Terms or engaged in fraudulent or misleading conduct.',
  },
  {
    title: '7. Payments and Fees',
    body: 'Consumers pay on-platform when required by the booking flow, including a $0.99 protection fee for standard bookings. Funds are processed by Stripe. ScheduleMe may hold funds in-platform and release provider payouts according to booking state. Standard provider platform fee is 12%; Founder50 providers are 6% unless explicitly revoked per platform policy. Platform fee and protection fee amounts are disclosed in product UI and metadata. Off-platform payment to avoid platform fees may result in account penalties.',
  },
  {
    title: '8. Disputes Between Users',
    body: 'Disputes between consumers and providers are primarily between those parties. ScheduleMe may provide tooling for price disputes, cancellations, and communications, and may facilitate payment-side actions such as refunds where technically possible. We do not guarantee any specific dispute outcome.',
  },
  {
    title: '9. User Content and Reviews',
    body: 'You are responsible for any content you submit, including messages, reviews, photos, and descriptions. You grant ScheduleMe a non-exclusive, royalty-free, worldwide license to display, host, and distribute your content to operate the Service. We may remove content that violates these Terms or applicable law. You represent that you have the rights to the content you submit and that it does not infringe any third-party rights.',
  },
  {
    title: '10. Prohibited Conduct',
    body: 'You agree not to: (a) use the Service for any unlawful purpose; (b) submit false or misleading information; (c) impersonate any person or entity; (d) scrape, crawl, or data-mine any portion of the Service; (e) attempt to gain unauthorized access to any part of the platform; (f) interfere with or disrupt the integrity or performance of the Service; (g) use the Service to send spam or unsolicited communications; (h) circumvent ScheduleMe by contacting leads found through the platform outside of our system to avoid fees; or (i) post content that is defamatory, harassing, or abusive.',
  },
  {
    title: '11. Intellectual Property',
    body: 'All content, trademarks, logos, and software on the ScheduleMe platform are the exclusive property of ScheduleMe or its licensors. You may not copy, modify, distribute, sell, or lease any part of our Service without prior written consent. Provider users retain ownership of their submitted content but grant ScheduleMe a license to display that content on the platform.',
  },
  {
    title: '12. Disclaimers',
    body: 'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. SCHEDULEME DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS. WE DO NOT ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY FOR ANY PROVIDER LISTED ON THE PLATFORM OR ANY SERVICES THEY PROVIDE.',
  },
  {
    title: '13. Limitation of Liability',
    body: 'TO THE FULLEST EXTENT PERMITTED BY LAW, SCHEDULEME AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM SHALL NOT EXCEED THE GREATER OF $100 OR THE AMOUNT YOU PAID TO SCHEDULEME IN THE 12 MONTHS PRECEDING THE CLAIM.',
  },
  {
    title: '14. Indemnification',
    body: 'You agree to indemnify and hold harmless ScheduleMe and its affiliates, officers, agents, and employees from any claim, liability, damage, or expense (including attorneys\' fees) arising from your use of the Service, your violation of these Terms, or your violation of any rights of a third party.',
  },
  {
    title: '15. Dispute Resolution',
    body: 'Any dispute arising from these Terms or your use of the Service shall be resolved by binding arbitration under the rules of the American Arbitration Association, conducted in English in the State of California, unless prohibited by law. You waive the right to participate in a class action lawsuit or class‑wide arbitration. Nothing in this section prevents either party from seeking injunctive or other equitable relief in court.',
  },
  {
    title: '16. Governing Law',
    body: 'These Terms are governed by the laws of the State of California, without regard to conflict of law principles.',
  },
  {
    title: '17. Termination',
    body: 'ScheduleMe may terminate or suspend your access to the Service at any time, with or without cause, with or without notice. Upon termination, your right to use the Service ceases immediately. Provisions of these Terms that by their nature should survive termination will survive, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability.',
  },
  {
    title: '18. Data and Account Deletion',
    body: 'You may request account deletion in-app (where supported) or by contacting support. We verify identity before deletion requests are completed. Data that is not required for legal, tax, anti-fraud, or payment reconciliation obligations is deleted or de-identified. Required records may be retained for up to 7 years; security logs are typically retained up to 12 months; support records are typically retained up to 24 months.',
  },
  {
    title: '19. Third-Party Services',
    body: 'ScheduleMe relies on third-party providers including Supabase (authentication, database, and storage), Stripe (payments, refunds, and payouts), Google/Apple auth (social sign-in), and push notification infrastructure (such as APNs/FCM). Your use of those integrations is also subject to their terms and policies.',
  },
  {
    title: '20. Privacy Notice and Data Purposes',
    body: 'Our Privacy Policy explains categories of personal data collected, why each category is used, retention periods, and your rights. By using the Service, you acknowledge those data practices for account creation, booking workflow, messaging, fraud prevention, payment handling, and support operations.',
  },
  {
    title: '21. Contact',
    body: `For questions about these Terms, contact ${EMAIL} or use https://www.usescheduleme.com/support.`,
  },
];

const Terms: NextPage = () => (
  <>
    <Head>
      <title>Terms of Service — ScheduleMe</title>
      <meta name="description" content="ScheduleMe Terms of Service — the rules and agreements governing your use of our platform." />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </Head>

    <Nav />

    <main className="pt-28 pb-24 bg-white">
      <div className="mx-auto max-w-3xl px-6">
        {/* Header */}
        <div className="mb-12 pb-8 border-b border-neutral-100">
          <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl font-bold text-neutral-900 mb-4" style={{ letterSpacing: '-0.025em' }}>Terms of Service</h1>
          <p className="text-sm text-neutral-400">Last updated: {LAST_UPDATED}</p>
          <p className="text-neutral-600 mt-4 leading-relaxed">
            Please read these Terms of Service carefully before using the ScheduleMe platform. These Terms constitute a legally binding agreement between you and {COMPANY}.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-bold text-neutral-900 mb-3">{section.title}</h2>
              <p className="text-sm text-neutral-600 leading-relaxed">{section.body}</p>
            </section>
          ))}
        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-neutral-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <p className="text-xs text-neutral-400">© {new Date().getFullYear()} {COMPANY}. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors">Privacy Policy</Link>
            <Link href="/support" className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors">Support</Link>
            <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors">Back to Home</Link>
          </div>
        </div>
      </div>
    </main>
  </>
);

export default Terms;
