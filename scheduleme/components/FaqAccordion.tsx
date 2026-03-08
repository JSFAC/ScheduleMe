// components/FaqAccordion.tsx
import { useState } from 'react';

const FAQS = [
  {
    q: 'Is ScheduleMe free to use?',
    a: 'Yes — completely free for customers. You describe your issue, get AI-matched with local pros, and book. No account required.',
  },
  {
    q: 'How does the AI matching work?',
    a: 'Our AI reads your description, identifies the service type and urgency, then searches for verified local businesses that match. The whole process takes a few seconds.',
  },
  {
    q: 'Are the service providers verified?',
    a: 'Every business goes through a license and background check before going live on the platform. You\'ll only ever see pros who\'ve been approved by our team.',
  },
  {
    q: 'What types of services are available?',
    a: 'Plumbing, HVAC, electrical, automotive, home repair, cleaning, salon & beauty, landscaping, pest control, and more. If a local pro can do it, we can match you.',
  },
  {
    q: 'What if I have an emergency?',
    a: 'Our AI flags emergency requests and prioritizes businesses with same-day or emergency availability. You\'ll see urgent matches at the top of your results.',
  },
  {
    q: 'Can I book directly through the app?',
    a: 'Yes — many providers offer instant online booking through their Calendly calendar. For others, you can request a booking and they\'ll confirm within a few hours.',
  },
  {
    q: 'How do I list my business?',
    a: 'Head to the For Businesses page and fill out the signup form. After a quick verification, your profile goes live and you start receiving matched leads.',
  },
];

export default function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <dl className="space-y-3">
      {FAQS.map((faq, i) => (
        <div
          key={i}
          className={`rounded-2xl border transition-colors ${open === i ? 'border-accent/30 bg-white' : 'border-neutral-200 bg-white hover:border-neutral-300'}`}
        >
          <dt>
            <button
              className="w-full flex items-center justify-between px-6 py-5 text-left gap-4"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
            >
              <span className="text-sm font-semibold text-neutral-900">{faq.q}</span>
              <span className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center transition-colors ${open === i ? 'bg-accent text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                <svg className={`h-3.5 w-3.5 transition-transform ${open === i ? 'rotate-45' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </span>
            </button>
          </dt>
          {open === i && (
            <dd className="px-6 pb-5 text-sm text-neutral-500 leading-relaxed border-t border-neutral-100 pt-4">
              {faq.a}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}
