// pages/dashboard.tsx — Real dashboard with Supabase auth + live bookings
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import Nav from '../components/Nav';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

interface Booking {
  id: string;
  service: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  created_at: string;
  requires_manual_action: boolean;
  users: { name: string | null; phone: string | null; email: string | null } | null;
}

interface Business {
  id: string;
  name: string;
  service_tags: string[];
  rating: number;
  is_onboarded: boolean;
}

const STATUS_STYLES: Record<Booking['status'], string> = {
  pending: 'bg-yellow-50 text-yellow-700',
  confirmed: 'bg-green-50 text-green-700',
  cancelled: 'bg-neutral-100 text-neutral-500',
  completed: 'bg-blue-50 text-blue-700',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const Dashboard: NextPage = () => {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [authState, setAuthState] = useState<'checking' | 'authed' | 'anon'>('checking');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) { setAuthState('anon'); setLoading(false); return; }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setAuthState('anon'); setLoading(false); return; }
      setAuthState('authed');

      // Find the business linked to this user's email
      const { data: biz } = await supabase
        .from('businesses')
        .select('id, name, service_tags, rating, is_onboarded')
        .limit(1).single();

      if (biz) {
        setBusiness(biz);
        // Fetch real bookings
        const res = await fetch(`/api/bookings?business_id=${biz.id}`);
        const data = await res.json();
        if (data.bookings) setBookings(data.bookings);
      }
      setLoading(false);
    });
  }, []);

  async function updateStatus(bookingId: string, status: Booking['status']) {
    setUpdatingId(bookingId);
    try {
      const supabase = getSupabase();
      if (!supabase) return;
      await supabase.from('bookings').update({ status }).eq('id', bookingId);
      setBookings(bs => bs.map(b => b.id === bookingId ? { ...b, status } : b));
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleLogout() {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    router.push('/auth/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
        </div>
      </div>
    );
  }

  // Not logged in — show login prompt
  if (authState === 'anon' || !getSupabase()) {
    return (
      <>
        <Head><title>Dashboard — ScheduleMe</title></Head>
        <Nav variant="dark" />
        <div className="min-h-screen bg-neutral-50 pt-20 flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-5">
              <svg className="h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">Sign in to your dashboard</h1>
            <p className="text-neutral-500 mb-6">Access your leads, bookings, and business settings.</p>
            <Link href="/auth/login" className="btn-primary w-full justify-center">Log In →</Link>
            <p className="text-sm text-neutral-400 mt-4">
              No account? <Link href="/business/signup" className="text-accent hover:underline">Apply to join</Link>
            </p>
          </div>
        </div>
      </>
    );
  }

  const newCount = bookings.filter(b => b.status === 'pending').length;
  const confirmedCount = bookings.filter(b => b.status === 'confirmed').length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;

  return (
    <>
      <Head>
        <title>{business?.name ?? 'Dashboard'} — ScheduleMe</title>
      </Head>
      <Nav variant="dark" />
      <div className="min-h-screen bg-neutral-50 pt-16">
        <main className="mx-auto max-w-7xl px-6 py-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">
                {business ? business.name : 'Your Dashboard'}
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                {business?.is_onboarded
                  ? 'Live — receiving leads'
                  : 'Pending verification — you\'ll be live within 24hrs'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/demo" className="btn-primary text-sm px-4 py-2">+ Simulate Lead</Link>
              <button onClick={handleLogout} className="btn-secondary text-sm px-4 py-2">Log Out</button>
            </div>
          </div>

          {/* Stats */}
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Bookings', value: bookings.length },
              { label: 'Pending', value: newCount },
              { label: 'Confirmed', value: confirmedCount },
              { label: 'Completed', value: completedCount },
            ].map(({ label, value }) => (
              <li key={label} className="card p-4 text-center">
                <p className="text-2xl font-bold text-neutral-900">{value}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{label}</p>
              </li>
            ))}
          </ul>

          {/* Bookings table */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-neutral-900">Bookings</h2>
              {bookings.length > 0 && (
                <span className="text-xs text-neutral-400">{bookings.length} total</span>
              )}
            </div>
            {bookings.length === 0 ? (
              <div className="py-16 text-center text-neutral-400">
                <p className="text-4xl mb-3" aria-hidden="true">📭</p>
                <p className="font-medium">No bookings yet</p>
                <p className="text-sm mt-1">
                  Bookings from <Link href="/demo" className="text-accent hover:underline">the intake form</Link> will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[700px]">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50">
                      {['Customer', 'Service', 'Status', 'Received', 'Actions'].map(col => (
                        <th key={col} className="px-6 py-3 text-xs font-semibold text-neutral-400 uppercase tracking-wide">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map(b => (
                      <tr key={b.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-neutral-900">{b.users?.name ?? 'Unknown'}</p>
                          {b.users?.phone && <a href={`tel:${b.users.phone}`} className="text-xs text-accent hover:underline">{b.users.phone}</a>}
                        </td>
                        <td className="px-6 py-4 text-sm text-neutral-700">{b.service ?? '—'}</td>
                        <td className="px-6 py-4">
                          <span className={`badge capitalize ${STATUS_STYLES[b.status]}`}>{b.status}</span>
                        </td>
                        <td className="px-6 py-4 text-xs text-neutral-400 whitespace-nowrap">{formatDate(b.created_at)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {b.status === 'pending' && (
                              <button
                                onClick={() => updateStatus(b.id, 'confirmed')}
                                disabled={updatingId === b.id}
                                className="btn-primary text-xs px-3 py-1.5"
                              >
                                {updatingId === b.id ? '…' : 'Confirm'}
                              </button>
                            )}
                            {b.status === 'confirmed' && (
                              <button
                                onClick={() => updateStatus(b.id, 'completed')}
                                disabled={updatingId === b.id}
                                className="btn-secondary text-xs px-3 py-1.5"
                              >
                                {updatingId === b.id ? '…' : 'Mark Done'}
                              </button>
                            )}
                            {b.users?.phone && (
                              <a href={`tel:${b.users.phone}`} className="btn-secondary text-xs px-3 py-1.5">Call</a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default Dashboard;
