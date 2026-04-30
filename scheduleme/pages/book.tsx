// pages/book.tsx — Booking page, auto-fills from logged-in user session
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';
import Nav from '../components/Nav';
import { useDm } from '../lib/DarkModeContext';
import { issuePaymentAccessTicket } from '../lib/paymentAccess';
import { deriveProviderPayoutStage } from '../lib/providerPayoutStage';

function getSupabase() {
  if (typeof window === 'undefined') return null;
  return getSupabaseClient();
}

// Check if a string is a valid UUID (real DB record) vs a mock ID like "r-001"
function isUUID(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

interface Provider {
  id: string;
  name: string;
  service: string;
  location: string;
  rating: number;
  phone: string;
  calendly_url?: string;
  from_db?: boolean;
  stripe_onboarded?: boolean;
  stripe_account_id?: string | null;
}

type BookingStep = 'details' | 'calendly' | 'done';

const BookPage: NextPage = () => {
  const router = useRouter();
  const { dm } = useDm();
  const pageBg = dm ? '#0a0a0a' : '#f8fafc';
  const cardBg = dm ? '#171717' : 'white';
  const cardBorder = dm ? '#262626' : '#e5e7eb';
  const textPrimary = dm ? '#f3f4f6' : '#111827';
  const textSecondary = dm ? '#9ca3af' : '#6b7280';
  const textMuted = dm ? '#6b7280' : '#9ca3af';
  const [provider, setProvider] = useState<Provider | null>(null);
  const [step, setStep] = useState<BookingStep>('details');
  const [form, setForm] = useState({ name: '', phone: '', email: '', service: '' });
  const [loading, setLoading] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerAcceptsPayments, setProviderAcceptsPayments] = useState(true);
  const [providerPaymentBlockReason, setProviderPaymentBlockReason] = useState<string | null>(null);

  useEffect(() => {
    // Load provider from query or sessionStorage
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

    // Auto-fill form from logged-in session
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user;
        setForm(f => ({
          ...f,
          name: f.name || u.user_metadata?.full_name || '',
          phone: f.phone || u.user_metadata?.phone || '',
          email: f.email || u.email || '',
        }));
      }
    });
  }, [router.query]);

  useEffect(() => {
    if (!provider?.id || !isUUID(provider.id)) {
      setProviderAcceptsPayments(true);
      return;
    }

    let cancelled = false;
    (async () => {
      const stripeReadyFromProvider =
        provider.stripe_onboarded === true && !!provider.stripe_account_id;
      if (stripeReadyFromProvider) {
        if (!cancelled) {
          setProviderAcceptsPayments(true);
          setProviderPaymentBlockReason(null);
        }
        return;
      }

      const supabase = getSupabase();
      if (!supabase) {
        if (!cancelled) setProviderAcceptsPayments(true);
        return;
      }

      const { data, error } = await supabase
        .from('businesses')
        .select('stripe_onboarded, stripe_account_id, zelle_payout_details')
        .eq('id', provider.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setProviderAcceptsPayments(true);
        return;
      }
      const { count } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', provider.id)
        .not('paid_at', 'is', null)
        .not('status', 'in', '(cancelled,payment_failed)');
      if (cancelled) return;
      const payoutStage = deriveProviderPayoutStage({
        stripe_onboarded: data?.stripe_onboarded,
        stripe_account_id: data?.stripe_account_id,
        zelle_payout_details: data?.zelle_payout_details,
        paidBookingsCount: Number(count || 0),
      });
      setProviderAcceptsPayments(payoutStage.canAcceptNewBookings);
      setProviderPaymentBlockReason(
        payoutStage.stage === 'payout_setup_required'
          ? 'This provider needs to set up Stripe or Zelle before accepting bookings.'
          : payoutStage.requiresStripeForNewBookings
            ? 'This provider needs to connect Stripe before accepting more bookings.'
            : null
      );
    })();

    return () => { cancelled = true; };
  }, [provider?.id, provider?.stripe_onboarded, provider?.stripe_account_id]);

  async function createBooking() {
    setLoading(true);
    setError(null);
    try {
      if (!providerAcceptsPayments) {
        setError(providerPaymentBlockReason || 'This provider can’t accept payments yet.');
        setLoading(false);
        return;
      }

      // If this is a mock provider (non-UUID id), skip the DB insert and go straight to done
      if (!provider?.id || !isUUID(provider.id)) {
        // Still send confirmation email
        if (form.email) {
          fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'booking_confirmation',
              to: form.email,
              name: form.name,
              service: form.service || provider?.service,
              urgency: 'Standard',
              location: provider?.location || '',
              matches: [{ name: provider?.name }],
            }),
          }).catch(() => {});
        }
        setStep(provider?.calendly_url ? 'calendly' : 'done');
        setLoading(false);
        return;
      }

      const supabase = getSupabase();
      if (!supabase) {
        setError('Booking is not ready yet. Please try again in a moment.');
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.push(`/signin?next=${encodeURIComponent('/book')}`);
        return;
      }
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          business_id: provider.id,
          service: form.service || provider.service,
          user_name: form.name,
          user_phone: form.phone,
          user_email: form.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      setBookingId(data.booking?.id);
      const bookingAmountCents = Number(data?.booking?.amount_cents || 0);

      // Send confirmation email
      if (form.email) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'booking_confirmation',
            to: form.email,
            name: form.name,
            service: form.service || provider.service,
            urgency: 'Standard',
            location: provider.location,
            matches: [{ name: provider.name, rating: provider.rating }],
          }),
        }).catch(() => {});
      }

      if (data?.booking?.id && bookingAmountCents > 0) {
        issuePaymentAccessTicket(data.booking.id);
        router.push(`/pay/${data.booking.id}`);
        return;
      }

      setStep(provider.calendly_url ? 'calendly' : 'done');
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
        <div className="min-h-screen flex items-center justify-center pt-20" style={{ background: pageBg }}>
          <div className="text-center">
            <p className="mb-4" style={{ color: textSecondary }}>No provider selected.</p>
            <a href="/bookings" className="btn-primary">Find a Pro</a>
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
      <main className="min-h-screen pt-20 pb-16 px-6" style={{ background: pageBg }}>
        <div className="mx-auto max-w-lg">

          {/* Provider card */}
          <div className="card p-6 mb-6" style={{ background: cardBg, borderColor: cardBorder }}>
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-xl flex-shrink-0">
                {provider.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: textPrimary }}>{provider.name}</h1>
                <p className="text-sm" style={{ color: textSecondary }}>{provider.service} · {provider.location}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-amber-400 text-sm">{'★'.repeat(Math.floor(provider.rating))}</span>
                  <span className="text-xs" style={{ color: textMuted }}>{provider.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>

          {step === 'details' && (
            <div className="card p-6" style={{ background: cardBg, borderColor: cardBorder }}>
              <h2 className="text-lg font-semibold mb-1" style={{ color: textPrimary }}>Your details</h2>
              <p className="text-sm mb-5" style={{ color: textMuted }}>Pre-filled from your account — update if needed.</p>
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: textSecondary }}>Your name *</label>
                  <input className="form-input" placeholder="Jane Smith" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: textSecondary }}>Phone *</label>
                  <input className="form-input" type="tel" placeholder="(512) 555-0100" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: textSecondary }}>Email</label>
                  <input className="form-input" type="email" placeholder="jane@example.com" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: textSecondary }}>Service needed</label>
                  <input className="form-input" placeholder="e.g. Leaking faucet repair" value={form.service}
                    onChange={e => setForm(f => ({ ...f, service: e.target.value }))} />
                </div>
                <button
                  className={`btn-primary w-full py-3 mt-2 ${!providerAcceptsPayments ? 'opacity-60 cursor-not-allowed' : ''}`}
                  onClick={createBooking}
                  disabled={loading || !form.name || !form.phone || !providerAcceptsPayments}
                >
                  {loading ? 'Booking…' : provider.calendly_url ? 'Continue to Schedule →' : 'Request Booking →'}
                </button>
                {!providerAcceptsPayments && (
                  <p className="text-xs font-semibold mt-2" style={{ color: textMuted }}>
                    Provider can&apos;t accept payments yet.
                  </p>
                )}

              </div>
            </div>
          )}

          {step === 'calendly' && provider.calendly_url && (
            <div className="card p-6" style={{ background: cardBg, borderColor: cardBorder }}>
              <h2 className="text-lg font-semibold mb-2" style={{ color: textPrimary }}>Pick a time</h2>
              <p className="text-sm mb-5" style={{ color: textSecondary }}>Choose a slot that works for you.</p>
              <div
                className="calendly-inline-widget"
                data-url={provider.calendly_url}
                style={{ minWidth: '320px', height: '630px' }}
              />
              <button className="w-full mt-4 rounded-xl font-semibold text-sm border py-3" style={{ borderColor: '#007e6d', color: '#007e6d', background: dm ? 'rgba(0,126,109,0.12)' : 'rgba(0,126,109,0.08)' }} onClick={() => setStep('done')}>
                I&apos;ve scheduled my appointment →
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="card p-8 text-center" style={{ background: cardBg, borderColor: cardBorder }}>
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: textPrimary }}>Booking requested!</h2>
              <p className="mb-2" style={{ color: textSecondary }}>{provider.name} will confirm shortly.</p>
              {form.email && (
                <p className="text-sm mb-2" style={{ color: textMuted }}>A confirmation email was sent to {form.email}</p>
              )}
              {bookingId && <p className="text-xs mb-6" style={{ color: textMuted }}>Booking ID: {bookingId}</p>}
              <div className="flex flex-col gap-3">
                {bookingId ? (
                  <a href={`/messages?booking=${bookingId}`} className="btn-primary">Message {provider.name}</a>
                ) : (
                  <button disabled className="btn-primary opacity-60 cursor-not-allowed">Message in app</button>
                )}
                <a href="/bookings" className="w-full text-center block rounded-xl font-semibold text-sm border py-3" style={{ borderColor: '#007e6d', color: '#007e6d', background: dm ? 'rgba(0,126,109,0.12)' : 'rgba(0,126,109,0.08)' }}>Find another pro</a>
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  );
};

export default BookPage;
