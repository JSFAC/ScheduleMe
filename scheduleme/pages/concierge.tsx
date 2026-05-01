// @ts-nocheck
import { useMemo, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import SeoHead from '../components/SeoHead';
import { useDm } from '../lib/DarkModeContext';

const SERVICE_OPTIONS = [
  'Haircut / fade',
  'Lineup / cleanup',
  'Taper / burst fade',
  'Braids / twists',
  'Photography',
  'Tutoring',
  'Other campus service',
];

const TIMING_OPTIONS = [
  'Choose an option',
  'ASAP / today',
  'This week',
  'This weekend',
  'Next week',
  'Flexible',
];

const BUDGET_OPTIONS = [
  'Choose an option',
  'Under $10',
  '$10-$20',
  '$20-$35',
  '$35+',
  'Flexible / depends on quality',
];

const HONEST_NOTES = [
  'This goes straight to me, not some big support inbox.',
  'If you need help finding the right person, I’ll do the hard work for you. Make a request and I’ll follow up fast.',
  'Haircuts are the main focus right now, but I’m open to other campus service requests too.',
];

const PRODUCT_INTEREST_OPTIONS = [
  'Choose an option',
  'Text me manually for now',
  'A website',
  'An app',
  'Both website and app',
  'Not sure yet',
];

const ConciergePage: NextPage = () => {
  const { dm } = useDm();
  const [form, setForm] = useState({
    name: '',
    contact: '',
    service: 'Haircut / fade',
    timing: 'Choose an option',
    budget: 'Choose an option',
    campus: '',
    details: '',
    reference: '',
    productInterest: 'Choose an option',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [requestId, setRequestId] = useState('');
  const [error, setError] = useState('');

  const surface = dm ? '#111111' : '#ffffff';
  const border = dm ? '#262626' : '#e5e7eb';
  const muted = dm ? '#a3a3a3' : '#6b7280';
  const strong = dm ? '#f5f5f5' : '#111827';
  const fieldBg = dm ? '#0d0d0d' : '#ffffff';

  const canSubmit = useMemo(() => {
    return Boolean(
      form.name.trim() &&
      form.contact.trim() &&
      form.service.trim() &&
      form.timing.trim() &&
      form.timing !== 'Choose an option' &&
      form.budget.trim() &&
      form.budget !== 'Choose an option' &&
      form.campus.trim() &&
      form.details.trim() &&
      form.productInterest.trim() &&
      form.productInterest !== 'Choose an option'
    );
  }, [form]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch('/api/concierge-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          source: 'ScheduleMe Concierge Page',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could not submit request.');

      setSuccess(true);
      setRequestId(data?.requestId || '');
      setForm({
        name: '',
        contact: '',
        service: 'Haircut / fade',
        timing: 'Choose an option',
        budget: 'Choose an option',
        campus: '',
        details: '',
        reference: '',
        productInterest: 'Choose an option',
      });
    } catch (err: any) {
      setError(err?.message || 'Could not submit request.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SeoHead
        title="ScheduleMe Concierge — Need Help Finding the Right Person?"
        description="Tell me what kind of haircut or campus service you need, and I’ll try to help match you."
        path="/concierge"
      />
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <main className="min-h-screen pt-5 pb-12 md:pt-8 md:pb-16" style={{ background: dm ? '#0a0a0a' : '#fcfaf6' }}>
        <section className="px-6 pb-6">
          <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="text-[2rem] md:text-3xl font-black" style={{ letterSpacing: '-0.04em', color: strong }}>
                Schedule<span style={{ color: '#0f766e' }}>Me</span>
              </span>
            </Link>
            <div className="flex items-center gap-2.5">
              <Link
                href="/flyer/concierge"
                className="text-sm font-semibold px-4 py-2 rounded-full border"
                style={{ color: muted, borderColor: border, background: surface }}
              >
                Flyer
              </Link>
              <Link
                href="/"
                className="text-sm font-semibold px-4 py-2 rounded-full border"
                style={{ color: muted, borderColor: border, background: surface }}
              >
                Main site
              </Link>
            </div>
          </div>
        </section>

        <section className="px-6">
          <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-6 md:gap-8 items-start">
            <div className="order-1 lg:order-1 pt-1 md:pt-4">
              <h1 className="text-[2.7rem] sm:text-[3.35rem] md:text-6xl font-black leading-[0.93]" style={{ letterSpacing: '-0.04em', color: strong }}>
                <span className="block whitespace-nowrap">Need help finding</span>
                <span className="block">the right person?</span>
              </h1>
              <p className="mt-4 max-w-xl text-base md:text-lg leading-relaxed" style={{ color: muted }}>
                Tell me what you need, your budget, and your timing. If I think I can help, I&apos;ll follow up fast.
              </p>
            </div>

            <div
              className="order-2 lg:order-2 rounded-[28px] md:rounded-[32px] border p-5 md:p-7 lg:sticky lg:top-28"
              style={{
                background: surface,
                borderColor: border,
                boxShadow: dm ? '0 22px 60px rgba(0,0,0,0.42)' : '0 20px 64px rgba(15,23,42,0.10)',
              }}
            >
              <div className="mb-4 md:mb-5">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-accent">Request a match</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>Name</span>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="mt-1.5 form-input"
                      style={{ background: fieldBg, borderColor: border, color: strong }}
                      placeholder="Your first name"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>Best contact</span>
                    <input
                      value={form.contact}
                      onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))}
                      className="mt-1.5 form-input"
                      style={{ background: fieldBg, borderColor: border, color: strong }}
                      placeholder="Phone, IG handle, or email"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>Service</span>
                    <select
                      value={form.service}
                      onChange={(e) => setForm((prev) => ({ ...prev, service: e.target.value }))}
                      className="mt-1.5 form-input"
                      style={{ background: fieldBg, borderColor: border, color: strong }}
                    >
                      {SERVICE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>Timing</span>
                    <select
                      value={form.timing}
                      onChange={(e) => setForm((prev) => ({ ...prev, timing: e.target.value }))}
                      className="mt-1.5 form-input"
                      style={{ background: fieldBg, borderColor: border, color: strong }}
                    >
                      {TIMING_OPTIONS.map((option, index) => (
                        <option key={option} value={option} disabled={index === 0}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>Budget</span>
                    <select
                      value={form.budget}
                      onChange={(e) => setForm((prev) => ({ ...prev, budget: e.target.value }))}
                      className="mt-1.5 form-input"
                      style={{ background: fieldBg, borderColor: border, color: strong }}
                    >
                      {BUDGET_OPTIONS.map((option, index) => (
                        <option key={option} value={option} disabled={index === 0}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>Campus / area</span>
                  <input
                    value={form.campus}
                    onChange={(e) => setForm((prev) => ({ ...prev, campus: e.target.value }))}
                    className="mt-1.5 form-input"
                    style={{ background: fieldBg, borderColor: border, color: strong }}
                    placeholder="Dorm, neighborhood, or where to meet"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>What do you want?</span>
                  <textarea
                    rows={4}
                    value={form.details}
                    onChange={(e) => setForm((prev) => ({ ...prev, details: e.target.value }))}
                    className="mt-1.5 form-input resize-y"
                    style={{ background: fieldBg, borderColor: border, color: strong }}
                    placeholder="Example: Need a clean fade before Friday. Near campus, under $20 if possible."
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>Reference link (optional)</span>
                  <input
                    value={form.reference}
                    onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))}
                    className="mt-1.5 form-input"
                    style={{ background: fieldBg, borderColor: border, color: strong }}
                    placeholder="Instagram post, style photo link, or Pinterest board"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>If this worked well, how would you want to use ScheduleMe again?</span>
                  <select
                    value={form.productInterest}
                    onChange={(e) => setForm((prev) => ({ ...prev, productInterest: e.target.value }))}
                    className="mt-1.5 form-input"
                    style={{ background: fieldBg, borderColor: border, color: strong }}
                  >
                    {PRODUCT_INTEREST_OPTIONS.map((option, index) => (
                      <option key={option} value={option} disabled={index === 0}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                {success && (
                  <div className="rounded-2xl border px-4 py-3 text-sm" style={{ background: dm ? 'rgba(15,118,110,0.12)' : '#ecfdf5', borderColor: dm ? 'rgba(15,118,110,0.25)' : '#a7f3d0', color: dm ? '#d1fae5' : '#065f46' }}>
                    Request sent. I&apos;ll take a look and follow up if I think I can help. {requestId ? `Reference: ${requestId}` : ''}
                  </div>
                )}

                {error && (
                  <div className="rounded-2xl border px-4 py-3 text-sm" style={{ background: dm ? 'rgba(239,68,68,0.12)' : '#fef2f2', borderColor: dm ? 'rgba(239,68,68,0.28)' : '#fecaca', color: dm ? '#fecaca' : '#991b1b' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit || loading}
                  className="btn-primary w-full py-3.5 text-sm font-black"
                >
                  {loading ? 'Sending request…' : 'Send my request'}
                </button>

                <p className="text-xs text-center leading-relaxed" style={{ color: muted }}>
                  I&apos;ll follow up through the contact method you enter.
                </p>
              </form>
            </div>

            <div
              className="order-3 lg:order-3 rounded-[28px] border p-5 md:p-6 lg:max-w-[calc(52.5%-1rem)]"
              style={{
                background: dm ? 'linear-gradient(180deg,#111111,#0d0d0d)' : 'linear-gradient(180deg,#ffffff,#f9fbfb)',
                borderColor: border,
              }}
            >
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-accent mb-3">Quick note</p>
              <ul className="space-y-2.5 text-sm leading-relaxed" style={{ color: muted }}>
                {HONEST_NOTES.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default ConciergePage;
