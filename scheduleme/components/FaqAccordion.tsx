// components/FaqAccordion.tsx
import { useState } from 'react';

const FAQS = [
  {
    q: 'Is ScheduleMe free to use?',
    a: 'Yes — completely free for customers. Describe what you need, see matching campus pros, and book. No phone calls required.',
  },
  {
    q: 'How does matching work?',
    a: 'We match your request to providers based on keywords, category, and availability. You can filter by service type or browse directly.',
  },
  {
    q: 'Are the service providers verified?',
    a: 'Every provider goes through a review process and has a profile with photos, tags, and reviews. You can see the details before booking.',
  },
  {
    q: 'What types of services are available?',
    a: 'Plumbing, HVAC, electrical, automotive, home repair, cleaning, salon & beauty, landscaping, pest control, and more. If a local pro can do it, we can match you.',
  },
  {
    q: 'What if I have an emergency?',
    a: 'Use keywords like “urgent” or “today” in your request and you’ll see fast-response providers first.',
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
