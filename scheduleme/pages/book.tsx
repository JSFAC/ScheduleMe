// pages/book.tsx — Booking page with Calendly embed + DB booking creation
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Nav from '../components/Nav';

interface Provider {
  id: string;
  name: string;
  service: string;
  location: string;
  rating: number;
  phone: string;
  calendly_url?: string;
  slug?: string;
  from_db?: boolean;
}

type BookingStep = 'details' | 'calendly' | 'confirm' | 'done';

const BookPage: NextPage = () => {
  const router = useRouter();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [step, setStep] = useState<BookingStep>('details');
  const [form, setForm] = useState({ name: '', phone: '', email: '', service: '' });
  const [loading, setLoading] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Provider data passed via query string or sessionStorage
    const stored = sessionStorage.getItem('scheduleme_booking_provider');
    if (stored) {
      try { setProvider(JSON.parse(stored)); } catch (_) {}
    }
    if (router.query.name) {
      const p: Provider = {
        id: router.query.id as string ?? '',
        name: router.query.name as string ?? '',
        service: router.query.service as string ?? '',
        location: router.query.location as string ?? '',
        rating: parseFloat(router.query.rating as string ?? '4.5'),
        phone: router.query.phone as string ?? '',
        calendly_url: router.query.calendly_url as string ?? undefined,
        from_db: router.query.from_db === 'true',
      };
      setProvider(p);
      setForm(f => ({ ...f, service: p.service }));
    }
  }, [router.query]);

  async function createBooking() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: provider?.id,
          service: form.service || provider?.service,
          user_name: form.name,
          user_phone: form.phone,
          user_email: form.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      setBookingId(data.booking?.id);
      setStep(provider?.calendly_url ? 'calendly' : 'done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (!provider) {
    return (
      <>
        <Nav />
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center pt-20">
          <div className="text-center">
            <p className="text-neutral-500 mb-4">No provider selected.</p>
            <a href="/demo" className="btn-primary">Find a Pro</a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Book {provider.name} — ScheduleMe</title>
        {provider.calendly_url && (
          <script src="https://assets.calendly.com/assets/external/widget.js" async />
        )}
      </Head>
      <Nav />
      <main className="min-h-screen bg-neutral-50 pt-20 pb-16 px-6">
        <div className="mx-auto max-w-lg">
          {/* Provider card */}
          <div className="card p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-xl flex-shrink-0">
                {provider.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-bold text-neutral-900">{provider.name}</h1>
                <p className="text-sm text-neutral-500">{provider.service} · {provider.location}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-amber-400 text-sm">{'★'.repeat(Math.floor(provider.rating))}</span>
                  <span className="text-xs text-neutral-400">{provider.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>

          {step === 'details' && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-5">Your details</h2>
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Your name *</label>
                  <input className="form-input" placeholder="Jane Smith" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Phone *</label>
                  <input className="form-input" type="tel" placeholder="(512) 555-0100" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email</label>
                  <input className="form-input" type="email" placeholder="jane@example.com" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Service needed</label>
                  <input className="form-input" placeholder="e.g. Leaking faucet repair" value={form.service}
                    onChange={e => setForm(f => ({ ...f, service: e.target.value }))} />
                </div>
                <button
                  className="btn-primary w-full py-3 mt-2"
                  onClick={createBooking}
                  disabled={loading || !form.name || !form.phone}
                >
                  {loading ? 'Booking…' : provider.calendly_url ? 'Continue to Schedule →' : 'Request Booking →'}
                </button>
                <a href={`tel:${provider.phone}`} className="btn-secondary w-full py-3 text-center block">
                  Or call directly
                </a>
              </div>
            </div>
          )}

          {step === 'calendly' && provider.calendly_url && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-2">Pick a time</h2>
              <p className="text-sm text-neutral-500 mb-5">Choose a slot that works for you.</p>
              <div
                className="calendly-inline-widget"
                data-url={provider.calendly_url}
                style={{ minWidth: '320px', height: '630px' }}
              />
              <button className="btn-secondary w-full mt-4" onClick={() => setStep('done')}>
                I&apos;ve scheduled my appointment →
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="card p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-neutral-900 mb-2">Booking requested!</h2>
              <p className="text-neutral-500 mb-2">
                {provider.name} will confirm shortly.
              </p>
              {bookingId && (
                <p className="text-xs text-neutral-400 mb-6">Booking ID: {bookingId}</p>
              )}
              <div className="flex flex-col gap-3">
                <a href={`tel:${provider.phone}`} className="btn-primary">Call {provider.name}</a>
                <a href="/demo" className="btn-secondary">Find another pro</a>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
};

export default BookPage;
