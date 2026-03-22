// pages/payment-success.tsx — Post-payment confirmation page
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import { useDm } from '../lib/DarkModeContext';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface BookingDetail {
  id: string;
  service: string;
  status: string;
  amount_cents: number;
  paid_at: string;
  scheduled_at?: string;
  business_name?: string;
  business_phone?: string;
  business_email?: string;
}

const PaymentSuccessPage: NextPage = () => {
  const router = useRouter();
  const { dm } = useDm();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confettiDone, setConfettiDone] = useState(false);

  const bookingId = router.query.booking as string | undefined;

  useEffect(() => {
    if (!router.isReady) return;
    const supabase = getSupabase();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/signin'); return; }

      if (!bookingId) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/bookings?user_id=${encodeURIComponent(session.user.id)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const b = (data.bookings || []).find((bk: any) => bk.id === bookingId);
          if (b) setBooking(b);
        }
      } catch { /* non-fatal */ }
      setLoading(false);
    });
  }, [router.isReady, bookingId]);

  // Trigger confetti after mount
  useEffect(() => {
    const timer = setTimeout(() => setConfettiDone(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const pageStyle = {
    minHeight: '100vh',
    paddingTop: 'calc(72px + env(safe-area-inset-top, 0px))',
    paddingBottom: '80px',
    background: dm ? '#0f1117' : '#EDF5FF',
  } as const;

  if (loading) {
    return (
      <>
        <Head><title>Payment Confirmed — ScheduleMe</title></Head>
        <Nav />
        <div style={pageStyle} className="flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-4 border-accent border-t-transparent animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Payment Confirmed — ScheduleMe</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <Nav />

      {/* Confetti burst SVG — animated, fades after 3s */}
      {!confettiDone && (
        <div className="fixed inset-0 z-10 pointer-events-none overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => {
            const colors = ['#0A84FF', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
            const color = colors[i % colors.length];
            const angle = (i / 24) * 360;
            const delay = (i % 6) * 0.08;
            const size = 8 + (i % 3) * 4;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '30%',
                  width: size,
                  height: size,
                  borderRadius: i % 2 === 0 ? '50%' : '2px',
                  background: color,
                  transform: `rotate(${angle}deg)`,
                  animation: `confetti-fly-${i % 4} 1.2s ${delay}s ease-out forwards`,
                }}
              />
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes confetti-fly-0 { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(-120px,-200px) scale(0.3) rotate(720deg);opacity:0} }
        @keyframes confetti-fly-1 { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(120px,-180px) scale(0.3) rotate(-540deg);opacity:0} }
        @keyframes confetti-fly-2 { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(-60px,-240px) scale(0.2) rotate(900deg);opacity:0} }
        @keyframes confetti-fly-3 { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(80px,-220px) scale(0.25) rotate(-720deg);opacity:0} }
      `}</style>

      <div style={pageStyle}>
        <div className="max-w-lg mx-auto px-5 py-10">

          {/* Success checkmark */}
          <div className="text-center mb-8">
            <div
              className="mx-auto mb-5 flex items-center justify-center"
              style={{
                width: 80, height: 80, borderRadius: '50%',
                background: dm ? 'rgba(34,197,94,0.15)' : '#dcfce7',
                border: `3px solid ${dm ? '#16a34a' : '#86efac'}`,
                animation: 'pop-in 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
              }}>
              <svg className="h-9 w-9" style={{ color: dm ? '#4ade80' : '#16a34a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1
              className="text-3xl font-black mb-2"
              style={{ color: dm ? '#f3f4f6' : '#0f172a', letterSpacing: '-0.03em', animation: 'fade-up 0.5s 0.15s ease both' }}>
              Payment confirmed!
            </h1>
            <p
              className="text-base"
              style={{ color: dm ? '#9ca3af' : '#64748b', animation: 'fade-up 0.5s 0.25s ease both' }}>
              Your booking is secured. We sent a receipt to your email.
            </p>
          </div>

          <style>{`
            @keyframes pop-in { 0%{transform:scale(0);opacity:0} 100%{transform:scale(1);opacity:1} }
            @keyframes fade-up { 0%{transform:translateY(12px);opacity:0} 100%{transform:translateY(0);opacity:1} }
          `}</style>

          {/* Booking detail card */}
          {booking && (
            <div
              className="rounded-2xl p-6 mb-5"
              style={{
                background: dm ? '#1a1d27' : 'white',
                border: dm ? '1px solid #2a2d3a' : '1px solid #e2e8f0',
                animation: 'fade-up 0.5s 0.35s ease both',
              }}>
              <h2
                className="text-xs font-black uppercase tracking-widest mb-4"
                style={{ color: dm ? 'rgba(255,255,255,0.35)' : '#a3a3a3' }}>
                Booking Details
              </h2>

              <div className="space-y-3.5">
                {/* Amount */}
                <div className="flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: dm ? 'rgba(34,197,94,0.15)' : '#dcfce7' }}>
                    <svg className="h-4 w-4" style={{ color: dm ? '#4ade80' : '#16a34a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: dm ? 'rgba(255,255,255,0.35)' : '#a3a3a3' }}>Amount Paid</p>
                    <p className="text-xl font-black" style={{ color: dm ? '#4ade80' : '#16a34a', letterSpacing: '-0.02em' }}>
                      ${(booking.amount_cents / 100).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="h-px" style={{ background: dm ? '#2a2d3a' : '#f1f5f9' }} />

                {/* Service */}
                <div className="flex items-start gap-3">
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: dm ? 'rgba(10,132,255,0.12)' : '#eff6ff' }}>
                    <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: dm ? 'rgba(255,255,255,0.35)' : '#a3a3a3' }}>Service</p>
                    <p className="text-sm font-semibold mt-0.5 line-clamp-2" style={{ color: dm ? '#f3f4f6' : '#0f172a' }}>{booking.service}</p>
                  </div>
                </div>

                {/* Business */}
                {booking.business_name && (
                  <div className="flex items-start gap-3">
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: dm ? 'rgba(10,132,255,0.12)' : '#eff6ff' }}>
                      <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: dm ? 'rgba(255,255,255,0.35)' : '#a3a3a3' }}>Business</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: dm ? '#f3f4f6' : '#0f172a' }}>{booking.business_name}</p>
                      {(booking.business_phone || booking.business_email) && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {booking.business_phone && (
                            <a href={`tel:${booking.business_phone}`}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                              style={{ background: dm ? 'rgba(10,132,255,0.12)' : '#eff6ff', color: '#0A84FF', border: `1px solid ${dm ? 'rgba(10,132,255,0.2)' : '#bfdbfe'}` }}>
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                              </svg>
                              {booking.business_phone}
                            </a>
                          )}
                          {booking.business_email && (
                            <a href={`mailto:${booking.business_email}`}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                              style={{ background: dm ? '#1e2130' : '#f8fafc', color: dm ? '#d1d5db' : '#64748b', border: `1px solid ${dm ? '#2a2d3a' : '#e2e8f0'}` }}>
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                              </svg>
                              {booking.business_email}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Scheduled time */}
                {booking.scheduled_at && (
                  <div className="flex items-start gap-3">
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: dm ? 'rgba(10,132,255,0.12)' : '#eff6ff' }}>
                      <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: dm ? 'rgba(255,255,255,0.35)' : '#a3a3a3' }}>Appointment</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: dm ? '#f3f4f6' : '#0f172a' }}>
                        {new Date(booking.scheduled_at).toLocaleDateString('en-US', {
                          weekday: 'long', month: 'long', day: 'numeric',
                          year: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {/* Paid at */}
                {booking.paid_at && (
                  <div
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 mt-1"
                    style={{ background: dm ? 'rgba(34,197,94,0.08)' : '#f0fdf4', border: `1px solid ${dm ? 'rgba(34,197,94,0.15)' : '#bbf7d0'}` }}>
                    <svg className="h-3.5 w-3.5 shrink-0" style={{ color: dm ? '#4ade80' : '#16a34a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <p className="text-xs font-semibold" style={{ color: dm ? '#4ade80' : '#16a34a' }}>
                      Paid {new Date(booking.paid_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* What happens next */}
          <div
            className="rounded-2xl p-5 mb-5"
            style={{
              background: dm ? '#1a1d27' : 'white',
              border: dm ? '1px solid #2a2d3a' : '1px solid #e2e8f0',
              animation: 'fade-up 0.5s 0.45s ease both',
            }}>
            <h3 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: dm ? 'rgba(255,255,255,0.35)' : '#a3a3a3' }}>
              What happens next
            </h3>
            <div className="space-y-3">
              {[
                { icon: '📧', text: 'Receipt sent to your email with full booking details' },
                { icon: '📞', text: 'The business may reach out to confirm your appointment time' },
                { icon: '⭐', text: 'After your service, you\'ll be asked to leave a review' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-start gap-3">
                  <span className="text-base shrink-0 mt-0.5">{icon}</span>
                  <p className="text-sm leading-relaxed" style={{ color: dm ? '#9ca3af' : '#64748b' }}>{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3" style={{ animation: 'fade-up 0.5s 0.55s ease both' }}>
            <Link
              href="/bookings"
              className="w-full py-4 rounded-2xl text-white font-black text-base text-center block transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg,#0A84FF 0%,#0066CC 100%)', boxShadow: '0 8px 24px rgba(10,132,255,0.3)' }}>
              View All Bookings
            </Link>
            <Link
              href="/browse"
              className="w-full py-3.5 rounded-2xl font-semibold text-sm text-center block"
              style={{
                background: dm ? '#1e2130' : 'white',
                color: dm ? '#d1d5db' : '#64748b',
                border: `1px solid ${dm ? '#2a2d3a' : '#e2e8f0'}`,
              }}>
              Browse More Services
            </Link>
          </div>

        </div>
      </div>
    </>
  );
};

export default PaymentSuccessPage;
