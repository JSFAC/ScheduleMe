// @ts-nocheck
// pages/pay/[bookingId].tsx — Dedicated payment page for a booking
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import Nav from '../../components/Nav';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { useDm } from '../../lib/DarkModeContext';

function getSupabase() {
  return getSupabaseClient();
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

function PayCardForm({ bookingId, onSaved, onError, dm, forceNew }: { bookingId: string; onSaved: () => void; onError: (msg: string) => void; dm: boolean; forceNew?: boolean }) {
  const stripe = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { data: { session } } = await getSupabase().auth.getSession();
        if (!session) return;
        const res = await fetch('/api/create-setup-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
          body: JSON.stringify({ booking_id: bookingId, force_new: !!forceNew }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Unable to start card setup');
        if (data.already_saved) { onSaved(); return; }
        if (mounted) setClientSecret(data.client_secret || null);
      } catch (e: any) {
        onError(e?.message || 'Unable to start card setup');
      }
    }
    load();
    return () => { mounted = false; };
  }, [bookingId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret) return;
    setLoading(true);
    try {
      const card = elements.getElement(CardElement);
      if (!card) {
        onError('Card input is not ready. Please try again.');
        return;
      }
      const result = await stripe.confirmCardSetup(clientSecret, { payment_method: { card } });
      if (result.error) {
        onError(result.error.message || 'Card setup failed');
        return;
      }
      if (!(result as any)?.setupIntent) {
        onError('Card setup did not complete. Please try again.');
        return;
      }
      onSaved();
    } catch (e: any) {
      onError(e?.message || 'Card setup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="rounded-xl border px-3 py-3" style={{ borderColor: dm ? '#1e554c' : '#c7f0e3', background: dm ? '#0f1f1c' : '#ffffff' }}>
        <CardElement options={{ hidePostalCode: false, style: { base: { fontSize: '14px' } } }} />
      </div>
      <button
        type="submit"
        disabled={!stripe || !elements || !clientSecret || loading}
        className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-bold text-sm"
        style={{ background: 'linear-gradient(135deg,#007e6d 0%,#1e554c 100%)', opacity: (!stripe || !elements || !clientSecret || loading) ? 0.6 : 1 }}
      >
        {loading ? 'Saving…' : 'Save card'}
      </button>
    </form>
  );
}

const PayPage: NextPage = () => {
  const router = useRouter();
  const { dm } = useDm();
  const { bookingId } = router.query as { bookingId?: string };
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [paymentDefaultId, setPaymentDefaultId] = useState<string | null>(null);
  const [paymentReady, setPaymentReady] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCardMenu, setShowCardMenu] = useState(false);

  async function fetchPaymentMethods() {
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      if (!session) return;
      const res = await fetch('/api/payment-methods', { headers: { Authorization: 'Bearer ' + session.access_token } });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPaymentMethods(data.methods || []);
        setPaymentDefaultId(data.defaultId || null);
      }
    } catch {}
  }

  async function setDefaultPaymentMethod(id: string) {
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      if (!session) return;
      await fetch('/api/set-default-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ payment_method_id: id }),
      });
      setPaymentDefaultId(id);
      // Attach to booking by calling setup intent (already_saved path)
      const res = await fetch('/api/create-setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.already_saved) setPaymentReady(true);
    } catch {}
  }

  async function sendPaymentSavedEmail() {
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      if (!session) return;
      await fetch('/api/payment-method-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ booking_id: bookingId }),
      });
    } catch {}
  }

  useEffect(() => {
    if (!bookingId) return;
    let mounted = true;
    async function load() {
      setLoading(true);
      setErr('');
      try {
        const { data: { session } } = await getSupabase().auth.getSession();
        if (!session) { setErr('Please sign in to continue.'); return; }
        const res = await fetch('/api/bookings', { headers: { Authorization: 'Bearer ' + session.access_token } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to load booking');
        const found = (data.bookings || []).find((b: any) => b.id === bookingId);
        if (!found) throw new Error('Booking not found');
        if (mounted) {
          setBooking(found);
          setPaymentReady(!!found.stripe_payment_method_id);
        }
        fetchPaymentMethods();
      } catch (e: any) {
        setErr(e?.message || 'Failed to load booking');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [bookingId]);

  const bg = dm ? '#0a0a0a' : '#f7faf9';
  const cardBg = dm ? '#141414' : '#ffffff';
  const cardBorder = dm ? '#262626' : '#e5e7eb';
  const textPrimary = dm ? '#f3f4f6' : '#0f172a';
  const textMuted = dm ? '#9ca3af' : '#6b7280';

  return (
    <>
      <Head><title>Payment — ScheduleMe</title></Head>
      <div className="min-h-screen" style={{ background: bg }}>
        <Nav />
        <div className="max-w-3xl mx-auto px-4 pb-32 pt-20" style={{ minHeight: 'calc(100vh - 64px)' }}>
          <div className="mb-6">
            <h1 className="text-2xl font-black" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>Payment</h1>
            <p className="text-sm mt-1" style={{ color: textMuted }}>Secure your booking by saving a payment method.</p>
          </div>

          {loading ? (
            <div className="rounded-2xl border p-6" style={{ background: cardBg, borderColor: cardBorder, color: textMuted }}>Loading booking…</div>
          ) : err ? (
            <div className="rounded-2xl border p-6" style={{ background: dm ? '#2a1212' : '#fef2f2', borderColor: dm ? '#7f1d1d' : '#fecaca', color: dm ? '#fecaca' : '#b91c1c' }}>{err}</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border p-6" style={{ background: cardBg, borderColor: cardBorder }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold" style={{ color: textPrimary }}>{booking?.service || 'Booking'}</p>
                    <p className="text-xs mt-1" style={{ color: textMuted }}>{booking?.business_name || 'ScheduleMe'}</p>
                  </div>
                  {booking?.amount_cents && (
                    <div className="text-sm font-bold" style={{ color: '#007e6d' }}>${(booking.amount_cents / 100).toFixed(2)}</div>
                  )}
                </div>
                <div className="mt-3 text-xs" style={{ color: textMuted }}>
                  {paymentReady ? 'Payment accepted for this booking (authorized).' : 'Payment not yet saved.'}
                </div>
              </div>

              <div className="rounded-2xl border p-6" style={{ background: cardBg, borderColor: cardBorder }}>
                <h2 className="text-sm font-bold mb-3" style={{ color: textPrimary }}>Select payment method</h2>
                {paymentMethods.length > 0 && (
                  <div className="space-y-3">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCardMenu(v => !v)}
                        className="w-full rounded-xl border px-3 py-2 text-sm flex items-center justify-between"
                        style={{ borderColor: cardBorder, color: textPrimary, background: dm ? '#0f1f1c' : '#ffffff' }}
                      >
                        <span>
                          {(() => {
                            const current = paymentMethods.find(m => m.id === (paymentDefaultId || paymentMethods[0]?.id)) || paymentMethods[0];
                            return `${current?.brand?.toUpperCase() || 'CARD'} •••• ${current?.last4} (exp ${current?.exp_month}/${String(current?.exp_year).slice(-2)})`;
                          })()}
                        </span>
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {showCardMenu && (
                        <div className="absolute z-10 mt-2 w-full rounded-xl border shadow-lg overflow-hidden"
                          style={{ borderColor: cardBorder, background: dm ? '#111827' : '#ffffff' }}>
                          {paymentMethods.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => { setDefaultPaymentMethod(m.id); setShowCardMenu(false); }}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-black/5"
                              style={{ color: textPrimary, background: 'transparent' }}
                            >
                              {`${m.brand?.toUpperCase() || 'CARD'} •••• ${m.last4} (exp ${m.exp_month}/${String(m.exp_year).slice(-2)})`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => setShowAddCard((v) => !v)} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#007e6d' }}>
                      {showAddCard ? 'Hide card form' : 'Add new card'}
                    </button>
                  </div>
                )}

                {(showAddCard || paymentMethods.length === 0) && (
                  <div className="rounded-xl border p-4 mt-3" style={{ borderColor: cardBorder, background: dm ? '#0f1f1c' : '#ecfdf3' }}>
                    {process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? (
                      <Elements stripe={stripePromise} options={{ appearance: { theme: dm ? 'night' : 'stripe', variables: { colorPrimary: '#007e6d', colorText: dm ? '#e5f9f4' : '#0f3d35', colorBackground: dm ? '#0b1513' : '#ffffff', colorTextSecondary: dm ? '#8dd9c9' : '#0f766e' } } }}>
                        <PayCardForm
                          bookingId={bookingId}
                          dm={dm}
                          forceNew={showAddCard}
                          onSaved={() => { setShowAddCard(false); setPaymentReady(true); fetchPaymentMethods(); }}
                          onError={(msg) => setErr(msg)}
                        />
                      </Elements>
                    ) : (
                      <div className="text-xs" style={{ color: textMuted }}>Stripe key missing. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => router.push('/bookings')} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: dm ? '#1f2937' : '#f3f4f6', color: dm ? '#d1d5db' : '#374151', border: `1px solid ${dm ? '#2c2c2e' : '#e5e7eb'}` }}>
                  Back to bookings
                </button>
                <button
                  onClick={async () => {
                    if (!paymentReady) {
                      setErr('Please save a payment method first.');
                      return;
                    }
                    await sendPaymentSavedEmail();
                    setShowConfirm(true);
                  }}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white" style={{ background: '#007e6d' }}>
                  Continue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {showConfirm && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => router.replace('/bookings')}
        >
          <div className="w-full max-w-md rounded-2xl border p-6" style={{ background: cardBg, borderColor: cardBorder }}>
            <h3 className="text-lg font-bold" style={{ color: textPrimary }}>Payment accepted</h3>
            <p className="text-sm mt-2" style={{ color: textMuted }}>Your payment method has been accepted for this booking. We’ll email you updates as it moves forward.</p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => router.replace('/bookings')} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: dm ? '#1f2937' : '#f3f4f6', color: dm ? '#d1d5db' : '#374151' }}>Go to bookings</button>
              <button onClick={() => router.replace('/bookings')} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#007e6d' }}>Go to bookings</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PayPage;
