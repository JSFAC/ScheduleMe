// pages/business/dashboard.tsx — full business dashboard
import type { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import BusinessNav from '../../components/BusinessNav';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type TabId = 'overview' | 'bookings' | 'clients' | 'calendar' | 'settings';

interface Booking {
  id: string; service: string; status: string; created_at: string;
  amount_cents: number | null; paid_at: string | null;
  users: { name: string; phone: string; email: string } | null;
}

interface Business {
  id: string; name: string; owner_name: string; owner_email: string;
  stripe_account_id: string | null; stripe_onboarded: boolean;
  service_tags: string[]; address: string; rating: number | null;
  is_onboarded: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  paid: 'bg-green-500/15 text-green-400 border-green-500/30',
  payment_pending: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  payment_failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  cancelled: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
};

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'bookings', label: 'Bookings', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { id: 'clients', label: 'Clients', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'calendar', label: 'Calendar', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

function fmt(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

const BusinessDashboard: NextPage = () => {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('overview');
  const [business, setBusiness] = useState<Business | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [stripeLoading, setStripeLoading] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/business/auth/login'); return; }

    const { data: biz } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_email', session.user.email)
      .single();

    if (!biz) { router.push('/business/auth/login'); return; }
    setBusiness(biz);

    const { data: bkgs } = await supabase
      .from('bookings')
      .select('*, users(name, phone, email)')
      .eq('business_id', biz.id)
      .order('created_at', { ascending: false });

    setBookings(bkgs || []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadData();
    // Check Stripe redirect
    const { stripe } = router.query;
    if (stripe === 'success') loadData();
  }, [loadData, router.query]);

  async function handleStripeConnect() {
    if (!business) return;
    setStripeLoading(true);
    try {
      const res = await fetch('/api/stripe-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert('Failed to connect Stripe. Please try again.');
    } finally {
      setStripeLoading(false);
    }
  }

  async function handleCancelBooking(bookingId: string) {
    if (!confirm('Cancel this booking?')) return;
    const supabase = getSupabase();
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
    setBookings(b => b.map(bk => bk.id === bookingId ? { ...bk, status: 'cancelled' } : bk));
  }

  async function handleCompleteBooking(bookingId: string) {
    const supabase = getSupabase();
    await supabase.from('bookings').update({ status: 'completed' }).eq('id', bookingId);
    setBookings(b => b.map(bk => bk.id === bookingId ? { ...bk, status: 'completed' } : bk));
  }

  async function handleSignOut() {
    await getSupabase().auth.signOut();
    router.push('/business/auth/login');
  }

  if (loading) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
      </div>
    </div>
  );

  // Stats
  const totalEarned = bookings.filter(b => b.status === 'paid' || b.status === 'completed').reduce((s, b) => s + (b.amount_cents || 0), 0);
  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const completedCount = bookings.filter(b => b.status === 'completed' || b.status === 'paid').length;
  const uniqueClients = new Set(bookings.map(b => b.users?.email).filter(Boolean)).size;

  // Calendar: bookings by date
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const bookingDates = new Set(bookings.filter(b => b.status !== 'cancelled').map(b => new Date(b.created_at).getDate()));

  return (
    <>
      <Head><title>Dashboard — ScheduleMe for Business</title></Head>
      <BusinessNav />

      <div className="min-h-screen bg-neutral-950 pt-20">
        {/* Stripe connect banner */}
        {business && !business.stripe_onboarded && (
          <div className="bg-accent/10 border-b border-accent/20 px-6 py-3">
            <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <svg className="h-4 w-4 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-neutral-300"><strong className="text-white">Connect your bank account</strong> to start receiving payments from customers.</span>
              </div>
              <button onClick={handleStripeConnect} disabled={stripeLoading}
                className="btn-primary text-sm px-5 py-2 flex-shrink-0">
                {stripeLoading ? 'Loading…' : 'Connect Stripe →'}
              </button>
            </div>
          </div>
        )}

        <div className="mx-auto max-w-6xl px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
                {business?.name}
              </h1>
              <p className="text-neutral-500 text-sm mt-0.5">{business?.owner_email}</p>
            </div>
            <button onClick={handleSignOut} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
              Sign out
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1 mb-8 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  tab === t.id ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'
                }`}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                </svg>
                {t.label}
              </button>
            ))}
          </div>

          {/* OVERVIEW TAB */}
          {tab === 'overview' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Earned', value: fmt(totalEarned), sub: 'after 12% commission', color: 'text-green-400' },
                  { label: 'Pending Bookings', value: String(pendingCount), sub: 'awaiting action', color: 'text-yellow-400' },
                  { label: 'Completed Jobs', value: String(completedCount), sub: 'all time', color: 'text-accent' },
                  { label: 'Unique Clients', value: String(uniqueClients), sub: 'served', color: 'text-purple-400' },
                ].map(s => (
                  <div key={s.label} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
                    <p className="text-xs font-medium text-neutral-500 mb-1">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`} style={{ letterSpacing: '-0.02em' }}>{s.value}</p>
                    <p className="text-xs text-neutral-600 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Recent bookings */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900">
                <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">Recent Bookings</h2>
                  <button onClick={() => setTab('bookings')} className="text-xs text-accent hover:underline">View all</button>
                </div>
                {bookings.length === 0 ? (
                  <div className="p-10 text-center text-neutral-600 text-sm">No bookings yet. They will appear here once customers request your services.</div>
                ) : (
                  <div className="divide-y divide-neutral-800">
                    {bookings.slice(0, 5).map(b => (
                      <div key={b.id} className="p-5 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{b.users?.name || 'Unknown customer'}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">{b.service} · {fmtDate(b.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {b.amount_cents && <span className="text-sm font-semibold text-white">{fmt(b.amount_cents)}</span>}
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[b.status] || STATUS_COLORS.pending}`}>
                            {b.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Stripe status */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white mb-1">Payment Account</p>
                    <p className="text-xs text-neutral-500">
                      {business?.stripe_onboarded ? 'Your bank account is connected. Payments will be deposited automatically.' : 'Connect your bank account to receive payments from customers.'}
                    </p>
                  </div>
                  {business?.stripe_onboarded ? (
                    <div className="flex items-center gap-2 text-green-400 text-sm font-medium flex-shrink-0">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Connected
                    </div>
                  ) : (
                    <button onClick={handleStripeConnect} disabled={stripeLoading}
                      className="btn-primary text-sm px-4 py-2 flex-shrink-0">
                      {stripeLoading ? 'Loading…' : 'Connect →'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BOOKINGS TAB */}
          {tab === 'bookings' && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
              <div className="p-5 border-b border-neutral-800">
                <h2 className="text-sm font-semibold text-white">All Bookings</h2>
                <p className="text-xs text-neutral-500 mt-0.5">{bookings.length} total</p>
              </div>
              {bookings.length === 0 ? (
                <div className="p-10 text-center text-neutral-600 text-sm">No bookings yet.</div>
              ) : (
                <div className="divide-y divide-neutral-800">
                  {bookings.map(b => (
                    <div key={b.id} className="p-5">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{b.users?.name || 'Unknown'}</p>
                          <p className="text-xs text-neutral-500">{b.service}</p>
                        </div>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 ${STATUS_COLORS[b.status] || STATUS_COLORS.pending}`}>
                          {b.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-neutral-500 mb-3">
                        {b.users?.phone && <span>📞 {b.users.phone}</span>}
                        {b.users?.email && <span>✉ {b.users.email}</span>}
                        <span>📅 {fmtDate(b.created_at)}</span>
                        {b.amount_cents && <span className="text-white font-semibold">{fmt(b.amount_cents)}</span>}
                      </div>
                      {(b.status === 'pending' || b.status === 'confirmed') && (
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => handleCompleteBooking(b.id)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 transition-colors">
                            Mark Complete
                          </button>
                          <button onClick={() => handleCancelBooking(b.id)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700 transition-colors">
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CLIENTS TAB */}
          {tab === 'clients' && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
              <div className="p-5 border-b border-neutral-800">
                <h2 className="text-sm font-semibold text-white">Clients</h2>
                <p className="text-xs text-neutral-500 mt-0.5">{uniqueClients} unique clients</p>
              </div>
              {(() => {
                const clientMap = new Map<string, { name: string; email: string; phone: string; bookingCount: number; totalSpent: number; lastBooking: string }>();
                bookings.forEach(b => {
                  if (!b.users?.email) return;
                  const existing = clientMap.get(b.users.email);
                  if (existing) {
                    existing.bookingCount++;
                    existing.totalSpent += b.amount_cents || 0;
                    if (b.created_at > existing.lastBooking) existing.lastBooking = b.created_at;
                  } else {
                    clientMap.set(b.users.email, {
                      name: b.users.name, email: b.users.email, phone: b.users.phone,
                      bookingCount: 1, totalSpent: b.amount_cents || 0, lastBooking: b.created_at,
                    });
                  }
                });
                const clients = Array.from(clientMap.values());
                if (clients.length === 0) return <div className="p-10 text-center text-neutral-600 text-sm">No clients yet.</div>;
                return (
                  <div className="divide-y divide-neutral-800">
                    {clients.map(c => (
                      <div key={c.email} className="p-5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-accent text-sm font-bold">{c.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white">{c.name}</p>
                            <p className="text-xs text-neutral-500 truncate">{c.email}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-white">{fmt(c.totalSpent)}</p>
                          <p className="text-xs text-neutral-500">{c.bookingCount} booking{c.bookingCount !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* CALENDAR TAB */}
          {tab === 'calendar' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                <h2 className="text-sm font-semibold text-white mb-5">
                  {today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-2">
                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                    <div key={d} className="text-center text-xs font-medium text-neutral-600 py-1">{d}</div>
                  ))}
                </div>
                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isToday = day === today.getDate();
                    const hasBooking = bookingDates.has(day);
                    return (
                      <div key={day} className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm relative ${
                        isToday ? 'bg-accent text-white font-bold' : hasBooking ? 'bg-accent/10 text-white' : 'text-neutral-500 hover:bg-neutral-800'
                      } transition-colors cursor-default`}>
                        {day}
                        {hasBooking && !isToday && <div className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" />}
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Upcoming bookings list */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900">
                <div className="p-5 border-b border-neutral-800">
                  <h2 className="text-sm font-semibold text-white">Upcoming</h2>
                </div>
                {bookings.filter(b => b.status === 'pending' || b.status === 'confirmed').length === 0 ? (
                  <div className="p-8 text-center text-neutral-600 text-sm">No upcoming bookings.</div>
                ) : (
                  <div className="divide-y divide-neutral-800">
                    {bookings.filter(b => b.status === 'pending' || b.status === 'confirmed').map(b => (
                      <div key={b.id} className="p-5 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-white">{b.users?.name || 'Unknown'}</p>
                          <p className="text-xs text-neutral-500">{b.service} · {fmtDate(b.created_at)}</p>
                        </div>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[b.status]}`}>
                          {b.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {tab === 'settings' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                <h2 className="text-sm font-semibold text-white mb-5">Business Profile</h2>
                <div className="space-y-3 text-sm">
                  {[
                    { label: 'Business Name', value: business?.name },
                    { label: 'Owner', value: business?.owner_name },
                    { label: 'Email', value: business?.owner_email },
                    { label: 'Services', value: business?.service_tags?.join(', ') },
                    { label: 'Location', value: business?.address },
                    { label: 'Profile Status', value: business?.is_onboarded ? 'Active' : 'Pending Review' },
                  ].map(row => (
                    <div key={row.label} className="flex items-start justify-between gap-4 py-2 border-b border-neutral-800 last:border-0">
                      <span className="text-neutral-500 flex-shrink-0">{row.label}</span>
                      <span className="text-neutral-200 text-right">{row.value || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                <h2 className="text-sm font-semibold text-white mb-2">Payment Account</h2>
                <p className="text-xs text-neutral-500 mb-4">
                  {business?.stripe_onboarded
                    ? 'Your bank account is connected via Stripe. Payments are deposited automatically after job completion.'
                    : 'Connect your bank account to receive payments.'}
                </p>
                {!business?.stripe_onboarded && (
                  <button onClick={handleStripeConnect} disabled={stripeLoading} className="btn-primary text-sm px-5 py-2">
                    {stripeLoading ? 'Loading…' : 'Connect Bank Account →'}
                  </button>
                )}
                {business?.stripe_onboarded && (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Bank account connected
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
                <h2 className="text-sm font-semibold text-white mb-2">Sign Out</h2>
                <p className="text-xs text-neutral-500 mb-4">Sign out of your business account.</p>
                <button onClick={handleSignOut} className="text-sm px-5 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default BusinessDashboard;
