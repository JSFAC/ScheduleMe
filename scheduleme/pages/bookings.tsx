// pages/bookings.tsx — New booking + booking history
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import IntakeForm from '../components/IntakeForm';
import { createClient } from '@supabase/supabase-js';
import { maybeSendWelcomeEmail } from '../lib/sendWelcome';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface Booking {
  id: string;
  service: string;
  status: string;
  created_at: string;
  business_name?: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; icon: string }> = {
  pending:         { label: 'Pending',          bg: 'bg-amber-50 border-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-400',  icon: '⏳' },
  confirmed:       { label: 'Confirmed',         bg: 'bg-blue-50 border-blue-100',    text: 'text-blue-700',   dot: 'bg-blue-500',   icon: '✅' },
  payment_pending: { label: 'Payment Pending',   bg: 'bg-violet-50 border-violet-100',text: 'text-violet-700', dot: 'bg-violet-500', icon: '💳' },
  paid:            { label: 'Paid',              bg: 'bg-green-50 border-green-100',  text: 'text-green-700',  dot: 'bg-green-500',  icon: '💰' },
  completed:       { label: 'Completed',         bg: 'bg-green-50 border-green-100',  text: 'text-green-700',  dot: 'bg-green-500',  icon: '🎉' },
  cancelled:       { label: 'Cancelled',         bg: 'bg-red-50 border-red-100',      text: 'text-red-600',    dot: 'bg-red-400',    icon: '❌' },
  payment_failed:  { label: 'Payment Failed',    bg: 'bg-red-50 border-red-100',      text: 'text-red-600',    dot: 'bg-red-400',    icon: '⚠️' },
};

const MOCK_BOOKINGS: Booking[] = [
  { id: '1', service: 'Leaking kitchen faucet repair', status: 'confirmed', created_at: new Date(Date.now() - 3600000).toISOString(), business_name: 'Pacific Plumbing Co.' },
  { id: '2', service: 'Deep clean 2BR apartment', status: 'completed', created_at: new Date(Date.now() - 86400000 * 3).toISOString(), business_name: 'Sparkle Clean SF' },
  { id: '3', service: 'Electrical panel inspection', status: 'pending', created_at: new Date(Date.now() - 86400000 * 7).toISOString(), business_name: undefined },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = diffMs / 3600000;
  const diffDays = diffMs / 86400000;
  if (diffHrs < 1) return 'Just now';
  if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
  if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type Phase = 'loading' | 'welcome' | 'transitioning' | 'done';
type Tab = 'new' | 'history';

const BookingsPage: NextPage = () => {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [userName, setUserName] = useState('');
  const [userInitials, setUserInitials] = useState('');
  const [fadeIn, setFadeIn] = useState(false);
  const [tab, setTab] = useState<Tab>('new');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const fullName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'there';
        const firstName = fullName.split(' ')[0];
        const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

        // Check welcome flag
        const { data: profile } = await supabase
          .from('profiles').select('has_seen_welcome').eq('id', session.user.id).maybeSingle();

        const isFirstVisit = profile !== null && profile.has_seen_welcome === false;

        if (isFirstVisit) {
          // Mark as seen
          await supabase.from('profiles').update({ has_seen_welcome: true }).eq('id', session.user.id);
          setUserName(firstName);
          setUserInitials(initials);
          setPhase('welcome');
          if (session.user.email) maybeSendWelcomeEmail(session.user.email, fullName);
          setTimeout(() => {
            setPhase('transitioning');
            setTimeout(() => { setPhase('done'); setFadeIn(true); }, 700);
          }, 2400);
        } else {
          setPhase('done');
          setTimeout(() => setFadeIn(true), 60);
        }

        // Load bookings (use mock for now)
        setBookings(MOCK_BOOKINGS);
      } else {
        setPhase('done');
        setTimeout(() => setFadeIn(true), 60);
      }
    });
  }, []);

  // Set initial tab based on query
  useEffect(() => {
    if (router.query.tab === 'history') setTab('history');
  }, [router.query]);

  const showOverlay = phase === 'welcome' || phase === 'transitioning';
  const overlayFadingOut = phase === 'transitioning';

  const activeBookings = bookings.filter(b => !['completed', 'cancelled'].includes(b.status));
  const pastBookings = bookings.filter(b => ['completed', 'cancelled'].includes(b.status));

  return (
    <>
      <Head><title>Bookings — ScheduleMe</title></Head>

      {/* Welcome overlay */}
      {showOverlay && (
        <style>{`
          .welcome-overlay { opacity: 1; transition: opacity 0.7s ease; }
          .welcome-overlay.out { opacity: 0; }
        `}</style>
      )}
      {showOverlay && (
        <div className={`welcome-overlay fixed inset-0 z-[200] flex items-center justify-center ${overlayFadingOut ? 'out' : ''}`}
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
          <div className="text-center px-6">
            <div className="relative mx-auto mb-6" style={{ width: 80, height: 80 }}>
              <div className="absolute inset-0 rounded-2xl bg-accent/20 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="relative h-full w-full rounded-2xl bg-accent flex items-center justify-center text-white text-2xl font-black" style={{ letterSpacing: '-0.03em' }}>
                {userInitials}
              </div>
            </div>
            <h1 className="text-3xl font-black text-white mb-2" style={{ letterSpacing: '-0.02em' }}>
              Welcome, {userName}!
            </h1>
            <p className="text-neutral-400 text-base">You&apos;re all set. Let&apos;s find you a pro.</p>
            <div className="flex justify-center gap-1.5 mt-8">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-1.5 w-1.5 rounded-full bg-accent/40 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      <Nav />
      <div className={`min-h-screen bg-neutral-50 pt-[72px] transition-opacity duration-500 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>

        {/* Header with tabs */}
        <div className="bg-white border-b border-neutral-100">
          <div className="mx-auto max-w-3xl px-6 pt-8 pb-0">
            <h1 className="text-2xl font-bold text-neutral-900 mb-1">Bookings</h1>
            <p className="text-neutral-500 text-sm mb-5">Book a service or track your existing jobs</p>
            <div className="flex gap-1">
              {([['new', 'Book a Service'], ['history', 'My Bookings']] as const).map(([t, label]) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all ${
                    tab === t ? 'border-accent text-accent' : 'border-transparent text-neutral-500 hover:text-neutral-700'
                  }`}>
                  {label}
                  {t === 'history' && activeBookings.length > 0 && (
                    <span className="ml-2 bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeBookings.length}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-6 py-8">
          {tab === 'new' ? (
            <div className="bg-white rounded-2xl border border-neutral-100 p-6">
              <IntakeForm />
            </div>
          ) : (
            <div className="space-y-6">
              {bookings.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-4xl mb-4">📋</p>
                  <p className="font-semibold text-neutral-700">No bookings yet</p>
                  <p className="text-neutral-400 text-sm mt-1 mb-5">Book your first service to get started</p>
                  <button onClick={() => setTab('new')} className="btn-primary px-6 py-2.5 text-sm">
                    Book a Service
                  </button>
                </div>
              ) : (
                <>
                  {activeBookings.length > 0 && (
                    <div>
                      <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Active</h2>
                      <div className="space-y-3">
                        {activeBookings.map(booking => {
                          const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
                          return (
                            <div key={booking.id} className="bg-white rounded-2xl border border-neutral-100 p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-neutral-900 truncate">{booking.service}</h3>
                                  {booking.business_name && (
                                    <p className="text-sm text-neutral-400 mt-0.5">{booking.business_name}</p>
                                  )}
                                  <p className="text-xs text-neutral-400 mt-1">{formatDate(booking.created_at)}</p>
                                </div>
                                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                  {cfg.label}
                                </span>
                              </div>
                              {/* Status timeline */}
                              <div className="mt-4 flex items-center gap-0">
                                {['pending', 'confirmed', 'paid', 'completed'].map((s, i, arr) => {
                                  const statuses = ['pending', 'confirmed', 'paid', 'completed'];
                                  const currentIdx = statuses.indexOf(booking.status);
                                  const isDone = i <= currentIdx;
                                  const isLast = i === arr.length - 1;
                                  return (
                                    <div key={s} className="flex items-center flex-1 last:flex-none">
                                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${isDone ? 'bg-accent' : 'bg-neutral-200'}`} />
                                      {!isLast && <div className={`h-0.5 flex-1 ${i < currentIdx ? 'bg-accent' : 'bg-neutral-200'}`} />}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex justify-between mt-1">
                                {['Submitted', 'Confirmed', 'Paid', 'Done'].map(l => (
                                  <span key={l} className="text-[10px] text-neutral-400">{l}</span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {pastBookings.length > 0 && (
                    <div>
                      <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Past</h2>
                      <div className="space-y-3">
                        {pastBookings.map(booking => {
                          const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.completed;
                          return (
                            <div key={booking.id} className="bg-white rounded-2xl border border-neutral-100 p-5 opacity-70">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-neutral-900 truncate">{booking.service}</h3>
                                  {booking.business_name && (
                                    <p className="text-sm text-neutral-400 mt-0.5">{booking.business_name}</p>
                                  )}
                                  <p className="text-xs text-neutral-400 mt-1">{formatDate(booking.created_at)}</p>
                                </div>
                                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                  {cfg.label}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default BookingsPage;
