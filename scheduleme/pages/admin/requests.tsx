// @ts-nocheck
// pages/admin/requests.tsx — ScheduleMe admin change requests
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState, useCallback } from 'react';

interface ChangeRequest {
  id: string; business_id: string; requested_by: string; request_type: string;
  status: string; changes: Record<string, any>; before: Record<string, any> | null;
  flagged?: boolean; flag_reasons?: string[]; created_at: string;
  reviewed_at?: string | null; review_notes?: string | null;
  businesses?: { name?: string; owner_email?: string; owner_name?: string } | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const RequestsPage: NextPage = () => {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  const loadRequests = useCallback(async (s: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin-change-requests', {
        headers: { 'x-notify-secret': s },
      });
      if (res.status === 401) { setAuthed(false); showToast('Invalid secret', false); setLoading(false); return; }
      const data = await res.json();
      setRequests(data.requests ?? []);
      setAuthed(true);
    } catch {
      showToast('Failed to load requests', false);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    await loadRequests(secret);
  }

  async function reviewRequest(id: string, action: 'approve' | 'reject') {
    try {
      const res = await fetch('/api/review-change-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to review');
      showToast(`Request ${action}d`, true);
      setRequests(rs => rs.map(r => r.id === id ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to review', false);
    }
  }

  const filtered = requests.filter(r => {
    if (filter === 'pending') return r.status === 'pending';
    if (filter === 'approved') return r.status === 'approved';
    if (filter === 'rejected') return r.status === 'rejected';
    return true;
  });
  const pendingCount = requests.filter(r => r.status === 'pending').length;

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
      <Head><title>Admin Requests — ScheduleMe</title></Head>
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
            <Link href="/admin" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">New businesses</Link>
            <button onClick={() => loadRequests(secret)} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Refresh</button>
            <button onClick={() => setAuthed(false)} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Log out</button>
          </div>
        </div>
        <main className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1 mb-6 w-fit">
            {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
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
              <p>No change requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(r => (
                <div key={r.id} className={`rounded-2xl border bg-neutral-900 p-6 ${r.status === 'pending' ? 'border-yellow-500/20 bg-yellow-500/5' : 'border-neutral-800'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <h2 className="text-base font-bold text-white">{r.businesses?.name || 'Business'}</h2>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${r.status === 'pending' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' : r.status === 'approved' ? 'bg-green-500/15 text-green-400 border-green-500/20' : 'bg-red-500/15 text-red-400 border-red-500/20'}`}>
                          {r.status}
                        </span>
                        {r.flagged && <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-red-500/15 text-red-400 border-red-500/20">Flagged</span>}
                        <span className="text-xs text-neutral-500">{formatDate(r.created_at)}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {Object.entries(r.changes || {}).map(([k, v]) => (
                          <div key={k} className="rounded-xl border border-neutral-800 p-3">
                            <p className="text-xs text-neutral-500 uppercase tracking-wide">{k.replace(/_/g,' ')}</p>
                            <p className="text-xs text-neutral-400 mt-1">Before: {(r.before && r.before[k] != null) ? String(r.before[k]).slice(0, 120) : '—'}</p>
                            <p className="text-sm text-neutral-200 mt-1">After: {String(v).slice(0, 200)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {r.status === 'pending' && (
                      <div className="flex flex-col gap-2 items-end flex-shrink-0">
                        <button onClick={() => reviewRequest(r.id, 'approve')} className="btn-primary text-sm px-5 py-2.5">Approve</button>
                        <button onClick={() => reviewRequest(r.id, 'reject')} className="text-sm font-semibold px-5 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 hover:bg-neutral-800">Reject</button>
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

export default RequestsPage;
