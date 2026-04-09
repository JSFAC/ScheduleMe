import { useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Nav from '../components/Nav';

const SupportPage: NextPage = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    platform: 'iOS app',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could not send support request.');
      setSuccess(true);
      setForm((prev) => ({ ...prev, subject: '', message: '' }));
    } catch (err: any) {
      setError(err?.message || 'Could not send support request.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Support — ScheduleMe</title>
        <meta name="description" content="ScheduleMe support page for App Store review and user support requests." />
      </Head>
      <Nav />
      <main className="min-h-screen pt-28 pb-16 bg-[#FCFAF6]">
        <div className="mx-auto max-w-3xl px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#007e6d] mb-3">Support</p>
          <h1 className="text-4xl font-black text-neutral-900 mb-3" style={{ letterSpacing: '-0.03em' }}>Need help?</h1>
          <p className="text-sm text-neutral-600 mb-8">
            Use this page for account, booking, payment, or app review support requests. Messages are sent to
            {' '}<span className="font-semibold">usescheduleme@gmail.com</span>.
          </p>

          <form onSubmit={submit} className="rounded-3xl border border-neutral-200 bg-white p-6 md:p-7 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#007e6d]"
                  placeholder="Your name"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Email *</span>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#007e6d]"
                  placeholder="you@example.com"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Subject</span>
                <input
                  value={form.subject}
                  onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#007e6d]"
                  placeholder="What do you need help with?"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Platform</span>
                <select
                  value={form.platform}
                  onChange={(e) => setForm((p) => ({ ...p, platform: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#007e6d] bg-white"
                >
                  <option>iOS app</option>
                  <option>Provider iOS app</option>
                  <option>Website</option>
                  <option>Payments</option>
                  <option>Account / Login</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">Message *</span>
              <textarea
                required
                value={form.message}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                rows={7}
                className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#007e6d] resize-y"
                placeholder="Describe the issue, steps to reproduce, and any booking/account details."
              />
            </label>

            {success && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
                Support request sent. We will reply by email.
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                style={{ background: '#007e6d' }}
              >
                {loading ? 'Sending…' : 'Send support request'}
              </button>
              <a href="mailto:usescheduleme@gmail.com" className="text-sm font-semibold text-[#007e6d] hover:opacity-80">
                Or email usescheduleme@gmail.com directly
              </a>
            </div>
          </form>

          <div className="mt-6 text-xs text-neutral-500">
            App Review Support URL: <Link href="/support" className="text-[#007e6d] font-semibold">https://www.usescheduleme.com/support</Link>
          </div>
        </div>
      </main>
    </>
  );
};

export default SupportPage;
