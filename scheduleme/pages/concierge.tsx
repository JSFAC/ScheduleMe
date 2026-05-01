// @ts-nocheck
import { useMemo, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Nav from '../components/Nav';
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
  'ASAP / today',
  'This week',
  'This weekend',
  'Next week',
  'Flexible',
];

const BUDGET_OPTIONS = [
  'Under $25',
  '$25-$35',
  '$35-$45',
  '$45+',
  'Flexible / depends on quality',
];

const PRODUCT_INTEREST_OPTIONS = [
  'Text me manually for now',
  'A simple website like this',
  'A real mobile app',
  'Both website and app',
  'Not sure yet',
];

const ConciergePage: NextPage = () => {
  const { dm } = useDm();
  const [form, setForm] = useState({
    name: '',
    contact: '',
    service: 'Haircut / fade',
    timing: 'This week',
    budget: '$25-$35',
    campus: '',
    details: '',
    reference: '',
    productInterest: 'A real mobile app',
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
      form.details.trim()
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
        timing: 'This week',
        budget: '$25-$35',
        campus: '',
        details: '',
        reference: '',
        productInterest: 'A real mobile app',
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
        title="ScheduleMe Concierge — Need a Better Campus Barber?"
        description="Tell ScheduleMe what kind of haircut or campus service you need, and we’ll manually help match you for free."
        path="/concierge"
      />
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <Nav />
      <main className="min-h-screen pt-24 pb-16" style={{ background: dm ? '#0a0a0a' : '#fcfaf6' }}>
        <section className="px-6">
          <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-8 items-start">
            <div className="pt-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-accent mb-4">Campus Concierge Beta</p>
              <h1 className="text-5xl md:text-6xl font-black leading-[0.95]" style={{ letterSpacing: '-0.04em', color: strong }}>
                Need a better
                <br />
                campus barber?
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed" style={{ color: muted }}>
                Tell us what kind of cut you want, your budget, and your timing. ScheduleMe will manually help match you with a better fit for free while we build the campus network.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    title: 'Tell us what you want',
                    body: 'Fade, lineup, taper, braids, photos, tutoring, or another campus service.',
                  },
                  {
                    title: 'We do the matching',
                    body: 'No empty marketplace. We route your request manually behind the scenes.',
                  },
                  {
                    title: 'Free while we test',
                    body: 'No extra charge to students. We just want to get the right match done fast.',
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-3xl border p-5"
                    style={{ background: surface, borderColor: border, boxShadow: dm ? 'none' : '0 8px 28px rgba(15,23,42,0.05)' }}
                  >
                    <p className="text-sm font-black mb-2" style={{ color: strong }}>{item.title}</p>
                    <p className="text-sm leading-relaxed" style={{ color: muted }}>{item.body}</p>
                  </div>
                ))}
              </div>

              <div
                className="mt-8 rounded-[28px] border p-6"
                style={{
                  background: dm ? 'linear-gradient(180deg,#111111,#0d0d0d)' : 'linear-gradient(180deg,#ffffff,#f9fbfb)',
                  borderColor: border,
                }}
              >
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-accent mb-3">What to expect</p>
                <ol className="space-y-3 text-sm leading-relaxed" style={{ color: muted }}>
                  <li><span className="font-bold" style={{ color: strong }}>1.</span> Submit your request with enough detail that we can make a strong match.</li>
                  <li><span className="font-bold" style={{ color: strong }}>2.</span> We follow up manually with a recommendation or next step.</li>
                  <li><span className="font-bold" style={{ color: strong }}>3.</span> If we find a fit, we help you get the booking done quickly.</li>
                </ol>
                <p className="mt-4 text-xs" style={{ color: muted }}>
                  Have a provider in mind already? We can still help route or compare options.
                </p>
              </div>
            </div>

            <div
              className="rounded-[32px] border p-6 md:p-7 sticky top-28"
              style={{
                background: surface,
                borderColor: border,
                boxShadow: dm ? '0 22px 60px rgba(0,0,0,0.42)' : '0 20px 64px rgba(15,23,42,0.10)',
              }}
            >
              <div className="mb-5">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-accent mb-2">Request a match</p>
                <h2 className="text-2xl font-black" style={{ letterSpacing: '-0.03em', color: strong }}>
                  Start with the request.
                </h2>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: muted }}>
                  This is the quickest way to get help right now. We’re manually handling requests instead of sending you into a thin marketplace.
                </p>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>Timing</span>
                    <select
                      value={form.timing}
                      onChange={(e) => setForm((prev) => ({ ...prev, timing: e.target.value }))}
                      className="mt-1.5 form-input"
                      style={{ background: fieldBg, borderColor: border, color: strong }}
                    >
                      {TIMING_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>Budget</span>
                    <select
                      value={form.budget}
                      onChange={(e) => setForm((prev) => ({ ...prev, budget: e.target.value }))}
                      className="mt-1.5 form-input"
                      style={{ background: fieldBg, borderColor: border, color: strong }}
                    >
                      {BUDGET_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>Campus / area</span>
                    <input
                      value={form.campus}
                      onChange={(e) => setForm((prev) => ({ ...prev, campus: e.target.value }))}
                      className="mt-1.5 form-input"
                      style={{ background: fieldBg, borderColor: border, color: strong }}
                      placeholder="Dorm, campus, or neighborhood"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>What do you want?</span>
                  <textarea
                    rows={5}
                    value={form.details}
                    onChange={(e) => setForm((prev) => ({ ...prev, details: e.target.value }))}
                    className="mt-1.5 form-input resize-y"
                    style={{ background: fieldBg, borderColor: border, color: strong }}
                    placeholder="Example: Need a clean mid fade before Friday night. Looking for someone near campus who can do textured top well. Prefer under $35."
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
                    {PRODUCT_INTEREST_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>

                {success && (
                  <div className="rounded-2xl border px-4 py-3 text-sm" style={{ background: dm ? 'rgba(15,118,110,0.12)' : '#ecfdf5', borderColor: dm ? 'rgba(15,118,110,0.25)' : '#a7f3d0', color: dm ? '#d1fae5' : '#065f46' }}>
                    Request sent. We&apos;ll review it manually and follow up. {requestId ? `Reference: ${requestId}` : ''}
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
                  Prefer to DM first? Start here, then we can follow up through your best contact method.
                </p>
              </form>
            </div>
          </div>
        </section>

        <section className="px-6 mt-14">
          <div
            className="mx-auto max-w-6xl rounded-[30px] border p-6 md:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            style={{ background: surface, borderColor: border }}
          >
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-accent mb-2">Need something to post?</p>
              <h3 className="text-xl font-black" style={{ letterSpacing: '-0.03em', color: strong }}>
                Use the flyer page for posters, stories, and screenshots.
              </h3>
              <p className="mt-2 text-sm" style={{ color: muted }}>
                We built a simple print-friendly flyer route specifically for this concierge test.
              </p>
            </div>
            <Link href="/flyer/concierge" className="btn-secondary whitespace-nowrap">
              Open concierge flyer
            </Link>
          </div>
        </section>
      </main>
    </>
  );
};

export default ConciergePage;
