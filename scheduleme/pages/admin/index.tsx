// @ts-nocheck
// pages/admin/index.tsx — ScheduleMe admin panel
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState, useCallback } from 'react';

interface Business {
  id: string; name: string; owner_name: string; owner_email: string;
  phone: string | null; address: string | null; service_tags: string[];
  is_onboarded: boolean; stripe_onboarded: boolean; created_at: string;
  campus_provider?: boolean; campus_school_name?: string | null;
  edu_verified?: boolean; school_domain?: string | null;
  campus_key?: string | null;
  founder50?: boolean | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const AdminPage: NextPage = () => {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [schoolDomains, setSchoolDomains] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending');
  const [campusFilter, setCampusFilter] = useState<string>('all');
  const [stripeHealth, setStripeHealth] = useState<any>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [refundBookingId, setRefundBookingId] = useState('');
  const [refunding, setRefunding] = useState(false);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  const loadBusinesses = useCallback(async (s: string, campusKey = campusFilter) => {
    setLoading(true);
    try {
      const qs = campusKey && campusKey !== 'all' ? `?campus=${encodeURIComponent(campusKey)}` : '';
      const res = await fetch(`/api/admin-businesses${qs}`, {
        headers: { 'x-notify-secret': s },
      });
      if (res.status === 401) { setAuthed(false); showToast('Invalid secret', false); setLoading(false); return; }
      const data = await res.json();
      setBusinesses(data.businesses ?? []);
      setAuthed(true);
      setStripeLoading(true);
      const stripeRes = await fetch('/api/admin-stripe-health', { headers: { 'x-notify-secret': s } });
      if (stripeRes.ok) {
        const stripeData = await stripeRes.json();
        setStripeHealth(stripeData);
      }
    } catch {
      showToast('Failed to load businesses', false);
    } finally {
      setLoading(false);
      setStripeLoading(false);
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    await loadBusinesses(secret);
  }

  async function approveBusiness(id: string) {
    setApprovingId(id);
    try {
      const res = await fetch('/api/approve-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
        body: JSON.stringify({ businessId: id, schoolDomain: schoolDomains[id] || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message, true);
      setBusinesses(bs => bs.map(b => b.id === id ? { ...b, is_onboarded: true } : b));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to approve', false);
    } finally {
      setApprovingId(null);
    }
  }

  async function refundBooking() {
    if (!refundBookingId.trim()) return;
    setRefunding(true);
    try {
      const res = await fetch('/api/admin-refund-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
        body: JSON.stringify({ bookingId: refundBookingId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refund failed');
      showToast(data.message || 'Refund issued', true);
      setRefundBookingId('');
    } catch (err: any) {
      showToast(err?.message || 'Refund failed', false);
    } finally {
      setRefunding(false);
    }
  }

  const filtered = businesses.filter(b => {
    if (filter === 'pending') return !b.is_onboarded;
    if (filter === 'approved') return b.is_onboarded;
    return true;
  });
  const pendingCount = businesses.filter(b => !b.is_onboarded).length;
  const campusLabelMap = new Map<string, string>();
  businesses.forEach(b => {
    if (b.campus_key && !campusLabelMap.has(b.campus_key)) {
      campusLabelMap.set(b.campus_key, b.campus_school_name || b.campus_key);
    }
  });
  const campusOptions = Array.from(campusLabelMap.entries()).map(([key, label]) => ({ key, label }));

  if (!authed) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <span className="text-2xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>ScheduleMe</span>
            <p className="text-accent text-xs font-semibold tracking-widest uppercase mt-1">Admin Panel</p>
            <p className="text-neutral-500 text-sm mt-3">Enter your admin secret to continue</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" placeholder="Admin secret" value={secret}
              onChange={e => setSecret(e.target.value)}
              className="form-input bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-600 w-full" />
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Checking…' : 'Enter Admin Panel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>Admin — ScheduleMe</title></Head>
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl ${toast.ok ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}
      <div className="min-h-screen bg-neutral-950">
        <div className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-black text-white" style={{ letterSpacing: '-0.03em' }}>ScheduleMe</span>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-accent bg-accent/10 px-2 py-1 rounded-full">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            {pendingCount > 0 && (
              <span className="text-xs font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 px-2.5 py-1 rounded-full">
                {pendingCount} pending
              </span>
            )}
            <Link href="/admin/requests" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Edit requests</Link>
            <button onClick={() => loadBusinesses(secret)} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Refresh</button>
            <button onClick={() => setAuthed(false)} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Log out</button>
          </div>
        </div>
        <main className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Total', value: businesses.length },
              { label: 'Pending', value: pendingCount },
              { label: 'Live', value: businesses.filter(b => b.is_onboarded).length },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-neutral-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-bold text-white">Stripe Health</p>
                <p className="text-xs text-neutral-500 mt-1">Webhook + event status</p>
              </div>
              <button onClick={() => loadBusinesses(secret)} className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors">
                Refresh
              </button>
            </div>
            {stripeLoading ? (
              <div className="text-xs text-neutral-500">Loading Stripe status…</div>
            ) : stripeHealth ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                  <p className="text-neutral-400">Webhook Secret</p>
                  <p className={`text-sm font-semibold mt-1 ${stripeHealth.webhookSecretConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {stripeHealth.webhookSecretConfigured ? 'Configured' : 'Missing'}
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                  <p className="text-neutral-400">Webhook Endpoint</p>
                  <p className={`text-sm font-semibold mt-1 ${stripeHealth.endpointFound ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {stripeHealth.endpointFound ? `Found (${stripeHealth.endpointStatus || 'unknown'})` : 'Not found'}
                  </p>
                  <p className="text-[10px] text-neutral-600 mt-2">Expected: {stripeHealth.expectedUrl}</p>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                  <p className="text-neutral-400">Last Stripe Event</p>
                  <p className="text-sm font-semibold mt-1 text-white">{stripeHealth.lastEventType || 'None found'}</p>
                  {stripeHealth.lastEventCreated && (
                    <p className="text-[10px] text-neutral-500 mt-1">{new Date(stripeHealth.lastEventCreated).toLocaleString()}</p>
                  )}
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                  <p className="text-neutral-400">Live Mode</p>
                  <p className={`text-sm font-semibold mt-1 ${stripeHealth.lastEventLivemode ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {stripeHealth.lastEventLivemode ? 'Live events' : 'Test or unknown'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-xs text-neutral-500">Stripe status not loaded yet.</div>
            )}
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-bold text-white">Refund Booking</p>
                <p className="text-xs text-neutral-500 mt-1">Issue a full refund (reverses transfer + fee)</p>
              </div>
            </div>
            <div className="flex gap-3 flex-col sm:flex-row">
              <input
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-600"
                placeholder="Booking ID"
                value={refundBookingId}
                onChange={e => setRefundBookingId(e.target.value)}
              />
              <button
                onClick={refundBooking}
                disabled={refunding}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {refunding ? 'Refunding…' : 'Issue refund'}
              </button>
            </div>
            <p className="text-[11px] text-neutral-500 mt-2">Only works for paid bookings with a Stripe payment intent.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1 w-fit">
              {(['pending', 'approved', 'all'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${filter === f ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
                  {f}{f === 'pending' && pendingCount > 0 && <span className="ml-1.5 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span>Campus</span>
              <select
                value={campusFilter}
                onChange={e => { const next = e.target.value; setCampusFilter(next); loadBusinesses(secret, next); }}
                className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200">
                <option value="all">All campuses</option>
                {campusOptions.map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="relative h-10 w-10">
                <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-neutral-500">
              <p className="text-3xl mb-3">🎉</p>
              <p>No {filter === 'pending' ? 'pending' : ''} businesses</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(b => (
                <div key={b.id} className={`rounded-2xl border bg-neutral-900 p-6 ${b.is_onboarded ? 'border-neutral-800' : 'border-yellow-500/20 bg-yellow-500/5'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <h2 className="text-base font-bold text-white">{b.name}</h2>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${b.is_onboarded ? 'bg-green-500/15 text-green-400 border-green-500/20' : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20'}`}>
                          {b.is_onboarded ? 'Approved' : 'Pending'}
                        </span>
                        {b.stripe_onboarded && <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-blue-500/15 text-blue-400 border-blue-500/20">Stripe ✓</span>}
                        {b.campus_provider && <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-purple-500/15 text-purple-400 border-purple-500/20">🎓 Campus</span>}
                        {b.edu_verified && <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-green-500/15 text-green-400 border-green-500/20">Campus Verified</span>}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
                        {[
                          { label: 'Owner', value: b.owner_name },
                          { label: 'Email', value: b.owner_email, link: `mailto:${b.owner_email}` },
                          { label: 'Phone', value: b.phone ?? '—' },
                          { label: 'Location', value: b.address ?? '—' },
                          { label: 'Services', value: b.service_tags?.join(', ') ?? '—' },
                          { label: 'Applied', value: formatDate(b.created_at) },
                          ...(b.campus_provider ? [{ label: 'School', value: b.campus_school_name ?? '—' }] : []),
                        ].map(({ label, value, link }) => (
                          <div key={label}>
                            <p className="text-xs text-neutral-500">{label}</p>
                            {link ? <a href={link} className="text-accent hover:underline truncate block">{value}</a> : <p className="text-neutral-300 truncate">{value}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                    {!b.is_onboarded && (
                      <div className="flex flex-col gap-2 items-end flex-shrink-0">
                        {b.campus_provider && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-neutral-500">School domain (e.g. asu.edu)</label>
                            <input
                              type="text"
                              placeholder="asu.edu"
                              value={schoolDomains[b.id] || ''}
                              onChange={e => setSchoolDomains(prev => ({ ...prev, [b.id]: e.target.value }))}
                              className="px-3 py-1.5 text-xs rounded-lg bg-neutral-800 border border-neutral-700 text-white placeholder:text-neutral-600 focus:outline-none focus:border-accent"
                            />
                          </div>
                        )}
                        <button onClick={() => approveBusiness(b.id)} disabled={approvingId === b.id}
                          className="btn-primary text-sm px-5 py-2.5">
                          {approvingId === b.id ? 'Approving…' : 'Approve & Send Email'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default AdminPage;
