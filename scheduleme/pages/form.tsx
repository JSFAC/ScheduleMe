// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import SeoHead from '../components/SeoHead';
import { useDm } from '../lib/DarkModeContext';

const SERVICE_OPTIONS = [
  'Haircut',
  'Hair coloring',
  'Photography',
  '3D prints',
  'Clothing repair',
  'Other campus service',
];

const TIMING_OPTIONS = [
  'Choose',
  'ASAP / today',
  'This week',
  'This weekend',
  'Next week',
  'Flexible',
];

const BUDGET_OPTIONS = [
  'Choose',
  'Under $10',
  '$10-$20',
  '$20-$35',
  '$35+',
  'Flexible / depends on quality',
];

const HONEST_NOTES = [
  'This is all run by me, so there may be delays in response. I’m a UCSC student trying to help other students.',
  'If you need help finding the right person, I’ll do the hard work for you. Make a request and I’ll follow up fast.',
  'Haircuts are the main focus right now, but I’m open to other campus service requests too.',
];

const PRODUCT_INTEREST_OPTIONS = [
  'Choose',
  'Current form',
  'A website',
  'An app',
  'Both website and app',
  'Not sure yet',
];

function CustomSelect({
  value,
  options,
  onChange,
  placeholderValue,
  strong,
  muted,
  border,
  fieldBg,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
  placeholderValue?: string;
  strong: string;
  muted: string;
  border: string;
  fieldBg: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  const isPlaceholder = placeholderValue ? value === placeholderValue : false;

  const visibleOptions = options.filter((option) => option !== placeholderValue);

  return (
    <div ref={rootRef} className="relative mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="form-input flex items-center justify-between text-left"
        style={{
          background: fieldBg,
          borderColor: border,
          color: isPlaceholder ? muted : strong,
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{value}</span>
        <svg className={`ml-3 h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} style={{ color: strong }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-50 overflow-hidden rounded-[24px] border shadow-2xl"
          style={{ background: fieldBg, borderColor: border }}
          role="listbox"
        >
            <div className="py-2">
            {visibleOptions.map((option) => {
              const selected = option === value;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-base transition-colors hover:bg-black/5 md:text-sm"
                  style={{ color: option === placeholderValue ? muted : strong }}
                >
                  <span className="truncate">{option}</span>
                  {selected ? (
                    <svg className="ml-3 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: strong }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const FormPage: NextPage = () => {
  const { dm } = useDm();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [form, setForm] = useState({
    name: '',
    contact: '',
    service: 'Haircut',
    timing: 'Choose',
    budget: 'Choose',
    campus: '',
    details: '',
    reference: '',
    productInterest: 'Choose',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [requestId, setRequestId] = useState('');
  const [error, setError] = useState('');
  const [isLeaving, setIsLeaving] = useState(false);

  const surface = dm ? '#111111' : '#ffffff';
  const border = dm ? '#262626' : '#e5e7eb';
  const muted = dm ? '#a3a3a3' : '#6b7280';
  const strong = dm ? '#f5f5f5' : '#111827';
  const fieldBg = dm ? '#0d0d0d' : '#ffffff';
  const placeholderSelect = dm ? '#737373' : '#9ca3af';

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function softNavigate(href: string) {
    if (isLeaving) return;
    setIsLeaving(true);
    window.setTimeout(() => {
      router.push(href);
    }, 190);
  }

  const canSubmit = useMemo(() => {
    return Boolean(
      form.name.trim() &&
      form.contact.trim() &&
      form.service.trim() &&
      form.timing.trim() &&
      form.timing !== 'Choose' &&
      form.budget.trim() &&
      form.budget !== 'Choose' &&
      form.campus.trim() &&
      form.details.trim() &&
      form.productInterest.trim() &&
      form.productInterest !== 'Choose'
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
        service: 'Haircut',
        timing: 'Choose',
        budget: 'Choose',
        campus: '',
        details: '',
        reference: '',
        productInterest: 'Choose',
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
        path="/form"
      />
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <main
        className="min-h-screen pt-5 pb-12 transition-[opacity,filter] duration-200 md:pt-8 md:pb-16"
        style={{
          background: dm ? '#0a0a0a' : '#f6f1e8',
          opacity: isLeaving ? 0.72 : isReady ? 1 : 0,
          filter: isLeaving ? 'blur(1px)' : 'blur(0px)',
        }}
      >
        <div
          className="pointer-events-none fixed inset-0 z-[60] transition-opacity duration-200"
          style={{
            opacity: isLeaving ? 1 : isReady ? 0 : 1,
            background: dm ? 'rgba(10,10,10,0.18)' : 'rgba(246,241,232,0.32)',
          }}
        />
        <section className="px-6 pb-6">
          <div className="mx-auto max-w-4xl flex min-h-[64px] items-center justify-between gap-3 overflow-hidden">
            <div className="flex min-h-[64px] min-w-0 items-center">
              <button type="button" onClick={() => softNavigate('/')} className="inline-flex items-center gap-3">
                <span className="truncate text-[2rem] md:text-3xl font-black" style={{ letterSpacing: '-0.04em', color: strong }}>
                  Schedule<span style={{ color: '#0f766e' }}>Me</span>
                </span>
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => softNavigate('/flyer/form')}
                className="btn-primary min-w-[6.75rem] px-5 py-2.5 text-sm"
                style={{ boxShadow: dm ? '0 7px 16px rgba(15,118,110,0.12)' : '0 6px 14px rgba(15,118,110,0.10)' }}
              >
                Flyer
              </button>
              <button
                type="button"
                onClick={() => softNavigate('/')}
                className="btn-secondary hidden min-w-[6.75rem] px-5 py-2.5 text-sm md:inline-flex"
              >
                Main site
              </button>
            </div>
          </div>
        </section>

        <section className="px-6">
          <div className="mx-auto max-w-4xl grid grid-cols-1 lg:grid-cols-[0.88fr_1fr] gap-6 md:gap-8 items-start">
            <div className="order-1 lg:order-1 pt-1 md:pt-4">
              <h1 className="max-w-[22rem] text-[2.25rem] sm:text-[2.45rem] md:text-[2.55rem] font-black leading-[0.98]" style={{ letterSpacing: '-0.045em', color: strong }}>
                <span className="block whitespace-nowrap">Need help finding</span>
                <span className="block whitespace-nowrap">the right person?</span>
              </h1>
              <p className="mt-4 max-w-[24rem] text-base md:text-[1.05rem] leading-relaxed" style={{ color: muted }}>
                I&apos;m testing a simpler way for students to find the right person without random group chats, bad referrals, or guessing.
              </p>

              <div
                className="mt-6 hidden lg:block max-w-[24rem] rounded-[28px] border p-5 md:p-6"
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
                <div className="grid grid-cols-2 gap-3 md:grid-cols-[0.95fr_1.05fr] md:gap-4">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>Name</span>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="mt-1.5 form-input px-3 text-[0.9rem] tracking-[-0.01em] md:px-4 md:text-base md:tracking-normal"
                      style={{ background: fieldBg, borderColor: border, color: strong }}
                      placeholder="Your name"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>Contact</span>
                    <input
                      value={form.contact}
                      onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))}
                      className="mt-1.5 form-input px-2.5 text-[0.82rem] tracking-[-0.015em] placeholder:tracking-[-0.015em] md:px-4 md:text-base md:tracking-normal md:placeholder:tracking-normal"
                      style={{ background: fieldBg, borderColor: border, color: strong }}
                      placeholder="number, insta, etc"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>Service</span>
                    <CustomSelect
                      value={form.service}
                      onChange={(next) => setForm((prev) => ({ ...prev, service: next }))}
                      options={SERVICE_OPTIONS}
                      strong={strong}
                      muted={muted}
                      border={border}
                      fieldBg={fieldBg}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>Timing</span>
                    <CustomSelect
                      value={form.timing}
                      onChange={(next) => setForm((prev) => ({ ...prev, timing: next }))}
                      options={TIMING_OPTIONS}
                      placeholderValue="Choose"
                      strong={strong}
                      muted={placeholderSelect}
                      border={border}
                      fieldBg={fieldBg}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>Budget</span>
                    <CustomSelect
                      value={form.budget}
                      onChange={(next) => setForm((prev) => ({ ...prev, budget: next }))}
                      options={BUDGET_OPTIONS}
                      placeholderValue="Choose"
                      strong={strong}
                      muted={placeholderSelect}
                      border={border}
                      fieldBg={fieldBg}
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>Campus / area</span>
                  <input
                    value={form.campus}
                    onChange={(e) => setForm((prev) => ({ ...prev, campus: e.target.value }))}
                    className="mt-1.5 form-input"
                    style={{ background: fieldBg, borderColor: border, color: strong }}
                    placeholder="Dorm, neighborhood, meet provider"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>What do you want?</span>
                  <textarea
                    rows={2}
                    value={form.details}
                    onChange={(e) => setForm((prev) => ({ ...prev, details: e.target.value }))}
                    className="mt-1.5 form-input resize-none min-h-[82px] pt-3.5 pb-[1.05rem] leading-snug md:min-h-[108px] md:pt-4 md:pb-[1.15rem]"
                    style={{ background: fieldBg, borderColor: border, color: strong }}
                    placeholder="Example: need a cut before Friday 5/1, I’m at Crown dorms and don’t wanna spend more than like $20"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>Reference link (optional)</span>
                  <input
                    value={form.reference}
                    onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))}
                    className="mt-1.5 form-input"
                    style={{ background: fieldBg, borderColor: border, color: strong }}
                    placeholder="Instagram post, pinterest, etc."
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>How would you want to use this again?</span>
                  <CustomSelect
                    value={form.productInterest}
                    onChange={(next) => setForm((prev) => ({ ...prev, productInterest: next }))}
                    options={PRODUCT_INTEREST_OPTIONS}
                    placeholderValue="Choose"
                    strong={strong}
                    muted={placeholderSelect}
                    border={border}
                    fieldBg={fieldBg}
                  />
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
              className="order-3 lg:hidden rounded-[28px] border p-5 md:p-6"
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

export default FormPage;
