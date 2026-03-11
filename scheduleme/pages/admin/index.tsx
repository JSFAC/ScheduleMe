// pages/admin/index.tsx — ScheduleMe admin panel
import type { NextPage } from 'next';
import Head from 'next/head';
import { useState, useCallback } from 'react';

interface Business {
  id: string; name: string; owner_name: string; owner_email: string;
  phone: string | null; address: string | null; service_tags: string[];
  is_onboarded: boolean; stripe_onboarded: boolean; created_at: string;
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
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending');

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  const loadBusinesses = useCallback(async (s: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin-businesses', {
        headers: { 'x-notify-secret': s },
      });
      if (res.status === 401) { setAuthed(false); showToast('Invalid secret', false); setLoading(false); return; }
      const data = await res.json();
      setBusinesses(data.businesses ?? []);
      setAuthed(true);
    } catch {
      showToast('Failed to load businesses', false);
    } finally {
      setLoading(false);
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
        body: JSON.stringify({ businessId: id }),
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

  const filtered = businesses.filter(b => {
    if (filter === 'pending') return !b.is_onboarded;
    if (filter === 'approved') return b.is_onboarded;
    return true;
  });
  const pendingCount = businesses.filter(b => !b.is_onboarded).length;

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
          <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1 mb-6 w-fit">
            {(['pending', 'approved', 'all'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${filter === f ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
                {f}{f === 'pending' && pendingCount > 0 && <span className="ml-1.5 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
              </button>
            ))}
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
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
                        {[
                          { label: 'Owner', value: b.owner_name },
                          { label: 'Email', value: b.owner_email, link: `mailto:${b.owner_email}` },
                          { label: 'Phone', value: b.phone ?? '—' },
                          { label: 'Location', value: b.address ?? '—' },
                          { label: 'Services', value: b.service_tags?.join(', ') ?? '—' },
                          { label: 'Applied', value: formatDate(b.created_at) },
                        ].map(({ label, value, link }) => (
                          <div key={label}>
                            <p className="text-xs text-neutral-500">{label}</p>
                            {link ? <a href={link} className="text-accent hover:underline truncate block">{value}</a> : <p className="text-neutral-300 truncate">{value}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                    {!b.is_onboarded && (
                      <button onClick={() => approveBusiness(b.id)} disabled={approvingId === b.id}
                        className="flex-shrink-0 btn-primary text-sm px-5 py-2.5">
                        {approvingId === b.id ? 'Approving…' : 'Approve & Send Email'}
                      </button>
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
