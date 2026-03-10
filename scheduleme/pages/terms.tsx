// pages/terms.tsx
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Nav from '../components/Nav';

const LAST_UPDATED = 'March 1, 2026';
const COMPANY = 'ScheduleMe, Inc.';
const EMAIL = 'legal@usescheduleme.com';

const sections = [
  {
    title: '1. Acceptance of Terms',
    body: `By accessing or using the ScheduleMe platform (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service. These Terms apply to all visitors, consumers, and registered business users. ${COMPANY} reserves the right to update these Terms at any time. Continued use of the Service after changes constitutes acceptance.`,
  },
  {
    title: '2. Description of Service',
    body: 'ScheduleMe is an AI-powered platform that connects consumers seeking local services with vetted service businesses. Consumers describe their service needs and are matched with relevant local providers. Businesses create profiles and receive matched leads. ScheduleMe is not itself a service provider and does not perform any services directly.',
  },
  {
    title: '3. Consumer Terms',
    body: 'As a consumer, you may submit service requests without creating an account. By submitting a request, you authorize ScheduleMe to share your contact information and service description with matched businesses. You agree to provide accurate information. ScheduleMe does not guarantee the quality, safety, legality, or completion of any services performed by businesses found through the platform. Any contract for services is solely between you and the service provider.',
  },
  {
    title: '4. Business Account Terms',
    body: 'To list a business on ScheduleMe, you must create an account, complete the onboarding process, and pass our verification review. You represent that all information you provide is accurate and that you hold all required licenses, permits, and insurance required by applicable law. You are solely responsible for the services you provide to customers. ScheduleMe may suspend or terminate your account at any time if we determine you have violated these Terms or engaged in fraudulent or misleading conduct.',
  },
  {
    title: '5. Payments and Billing',
    body: 'Consumer use of ScheduleMe is free. Business accounts are subject to the pricing plan selected at signup. Subscription fees are billed monthly in advance. Per-lead fees (on the Starter plan) are billed at the end of each billing cycle. All fees are non-refundable except as expressly stated in our Bad-Lead Credit Guarantee for Pro and Agency plans. ScheduleMe uses Stripe for payment processing. You authorize us to charge your payment method on file for all fees incurred.',
  },
  {
    title: '6. Prohibited Conduct',
    body: 'You agree not to: (a) use the Service for any unlawful purpose; (b) submit false or misleading information; (c) impersonate any person or entity; (d) scrape, crawl, or data-mine any portion of the Service; (e) attempt to gain unauthorized access to any part of the platform; (f) interfere with or disrupt the integrity or performance of the Service; (g) use the Service to send spam or unsolicited communications; or (h) circumvent ScheduleMe by contacting leads found through the platform outside of our system to avoid fees.',
  },
  {
    title: '7. Intellectual Property',
    body: 'All content, trademarks, logos, and software on the ScheduleMe platform are the exclusive property of ScheduleMe, Inc. or its licensors. You may not copy, modify, distribute, sell, or lease any part of our Service without prior written consent. Business users retain ownership of their submitted content (photos, descriptions) but grant ScheduleMe a non-exclusive, royalty-free license to display that content on the platform.',
  },
  {
    title: '8. Disclaimers',
    body: 'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. SCHEDULEME DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS. WE DO NOT ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY FOR ANY BUSINESS LISTED ON THE PLATFORM OR ANY SERVICES THEY PROVIDE.',
  },
  {
    title: '9. Limitation of Liability',
    body: 'TO THE FULLEST EXTENT PERMITTED BY LAW, SCHEDULEME, INC. AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM SHALL NOT EXCEED THE GREATER OF $100 OR THE AMOUNT YOU PAID TO SCHEDULEME IN THE 12 MONTHS PRECEDING THE CLAIM.',
  },
  {
    title: '10. Indemnification',
    body: 'You agree to indemnify and hold harmless ScheduleMe, Inc. and its affiliates, officers, agents, and employees from any claim, liability, damage, or expense (including attorneys\' fees) arising from your use of the Service, your violation of these Terms, or your violation of any rights of a third party.',
  },
  {
    title: '11. Dispute Resolution',
    body: 'Any dispute arising from these Terms or your use of the Service shall be resolved by binding arbitration under the rules of the American Arbitration Association, conducted in English in the state of Texas. You waive the right to participate in a class action lawsuit or class-wide arbitration. Nothing in this section prevents either party from seeking injunctive or other equitable relief in court.',
  },
  {
    title: '12. Governing Law',
    body: 'These Terms are governed by the laws of the State of Texas, without regard to conflict of law principles.',
  },
  {
    title: '13. Termination',
    body: 'ScheduleMe may terminate or suspend your access to the Service at any time, with or without cause, with or without notice. Upon termination, your right to use the Service ceases immediately. Provisions of these Terms that by their nature should survive termination will survive, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability.',
  },
  {
    title: '14. Contact',
    body: `For questions about these Terms, contact us at ${EMAIL} or write to ${COMPANY}, Legal Team.`,
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
            <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors">Back to Home</Link>
          </div>
        </div>
      </div>
    </main>
  </>
);

export default Terms;
