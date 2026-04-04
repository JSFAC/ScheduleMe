// @ts-nocheck
// pages/admin/index.tsx — ScheduleMe admin panel
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState, useCallback, useEffect } from 'react';

interface Business {
  id: string; name: string; owner_name: string; owner_email: string;
  phone: string | null; address: string | null; service_tags: string[];
  is_onboarded: boolean; stripe_onboarded: boolean; created_at: string;
  campus_provider?: boolean; campus_school_name?: string | null;
  edu_verified?: boolean; school_domain?: string | null;
  campus_key?: string | null;
  founder50?: boolean | null;
  founder50_status?: string | null;
}

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

const AdminPage: NextPage = () => {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [allBusinesses, setAllBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [schoolDomains, setSchoolDomains] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending');
  const [campusFilter, setCampusFilter] = useState<string>('all');
  const [campusOptions, setCampusOptions] = useState<Array<{ key: string; label: string }>>([]);
  const [stripeHealth, setStripeHealth] = useState<any>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [refundBookingId, setRefundBookingId] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [featuredRows, setFeaturedRows] = useState<any[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [featuredBusinessId, setFeaturedBusinessId] = useState('');
  const [featuredSlot, setFeaturedSlot] = useState('1');
  const [featuredCampusKey, setFeaturedCampusKey] = useState<string>('all');
  const [featuredEndsAt, setFeaturedEndsAt] = useState('');
  const [featuredNote, setFeaturedNote] = useState('');
  const [rlsStatus, setRlsStatus] = useState<any[]>([]);
  const [rlsLoading, setRlsLoading] = useState(false);
  const [securityStatus, setSecurityStatus] = useState<any[]>([]);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'businesses' | 'requests'>('businesses');
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestFilter, setRequestFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  function normalizeCampusKey(name?: string | null): string | null {
    if (!name) return null;
    const cleaned = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const key = cleaned ? cleaned.replace(/\s+/g, '_') : null;
    if (!key) return null;
    if (key === 'uc_santa_cruz' || key === 'ucsc') return 'ucsc';
    return key;
  }

  function campusAcronym(name?: string | null): string | null {
    if (!name) return null;
    const parts = name.replace(/[^a-z0-9\s]+/gi, ' ').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    return parts.map(p => p[0]).join('').toUpperCase();
  }

  function getBusinessCampusKey(b: Business): string | null {
    return normalizeCampusKey(b.campus_key || b.campus_school_name || null);
  }

  function campusDisplayLabel(key: string, fallback?: string | null): string {
    if (key === 'ucsc') return 'UCSC';
    if (fallback) return fallback;
    return key.toUpperCase();
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    // Force re-auth whenever the page is left or restored from bfcache
    const resetAuth = () => {
      setAuthed(false);
      setSecret('');
      setRequests([]);
      setBusinesses([]);
      setFeaturedRows([]);
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) resetAuth();
    };
    const onVisibilityChange = () => {
      if (document.hidden) resetAuth();
    };
    const onPageHide = () => resetAuth();
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  useEffect(() => {
    if (!authed) return;
    const IDLE_MS = 3 * 60 * 1000;
    let timer: number | null = null;

    const resetTimer = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setAuthed(false);
        setSecret('');
        setRequests([]);
        setBusinesses([]);
        setFeaturedRows([]);
        showToast('Logged out due to inactivity', false);
      }, IDLE_MS);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timer) window.clearTimeout(timer);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [authed]);

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

  const loadFeatured = useCallback(async (s: string, campusKey = campusFilter) => {
    setFeaturedLoading(true);
    try {
      const qs = campusKey && campusKey !== 'all' ? `?campus=${encodeURIComponent(campusKey)}` : '';
      const res = await fetch(`/api/admin-featured${qs}`, {
        headers: { 'x-notify-secret': s },
      });
      if (!res.ok) throw new Error('Failed to load featured');
      const data = await res.json();
      setFeaturedRows(data.featured || []);
    } catch {
      showToast('Failed to load featured list', false);
    } finally {
      setFeaturedLoading(false);
    }
  }, []);

  const loadRlsStatus = useCallback(async (s: string) => {
    setRlsLoading(true);
    try {
      const res = await fetch('/api/admin-rls-status', {
        headers: { 'x-notify-secret': s },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load RLS status');
      setRlsStatus(data.tables || []);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load RLS status', false);
    } finally {
      setRlsLoading(false);
    }
  }, []);

  const loadSecurityStatus = useCallback(async (s: string) => {
    setSecurityLoading(true);
    try {
      const res = await fetch('/api/admin-security-status', {
        headers: { 'x-notify-secret': s },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load security status');
      setSecurityStatus(data.guards || []);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load security status', false);
    } finally {
      setSecurityLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async (s: string) => {
    setRequestsLoading(true);
    try {
      const res = await fetch('/api/admin-change-requests', {
        headers: { 'x-notify-secret': s },
      });
      if (res.status === 401) { setAuthed(false); showToast('Invalid secret', false); setRequestsLoading(false); return; }
      const data = await res.json();
      setRequests(data.requests ?? []);
      setAuthed(true);
    } catch {
      showToast('Failed to load requests', false);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  const loadCampusOptions = useCallback(async (s: string) => {
    try {
      const res = await fetch('/api/admin-businesses', { headers: { 'x-notify-secret': s } });
      if (!res.ok) return;
      const data = await res.json();
      const all = data.businesses ?? [];
      setAllBusinesses(all);
      const campusLabelMap = new Map<string, { label: string; count: number }>();
      all.forEach((b: any) => {
        const key = normalizeCampusKey(b.campus_key || b.campus_school_name || null);
        if (!key) return;
        const rawLabel = campusAcronym(b.campus_school_name) || b.campus_school_name || b.campus_key || key;
        const label = campusDisplayLabel(key, rawLabel);
        const entry = campusLabelMap.get(key);
        if (!entry) {
          campusLabelMap.set(key, { label, count: 1 });
        } else {
          entry.count += 1;
          if (label.length < entry.label.length) entry.label = label;
        }
      });
      const options = Array.from(campusLabelMap.entries()).map(([key, data]) => ({ key, label: data.label }));
      setCampusOptions(options);
    } catch {}
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    await loadBusinesses(secret);
    await loadFeatured(secret);
    await loadCampusOptions(secret);
    await loadRlsStatus(secret);
    await loadSecurityStatus(secret);
    await loadRequests(secret);
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

  async function addFeatured() {
    if (!featuredBusinessId) return;
    const business = businesses.find(b => b.id === featuredBusinessId);
    const campusKey = normalizeCampusKey(
      (featuredCampusKey !== 'all' ? featuredCampusKey : null)
        || business?.campus_key
        || business?.campus_school_name
        || campusFilter
    );
    if (!campusKey) {
      showToast('Missing campus key for this business', false);
      return;
    }
    const endsAtIso = featuredEndsAt
      ? new Date(`${featuredEndsAt}T23:59:59`).toISOString()
      : null;
    try {
      const res = await fetch('/api/admin-featured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
        body: JSON.stringify({
          business_id: featuredBusinessId,
          campus_key: campusKey,
          slot: Number(featuredSlot) || 1,
          starts_at: new Date().toISOString(),
          ends_at: endsAtIso,
          note: featuredNote || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add featured');
      showToast('Featured slot added', true);
      setFeaturedBusinessId('');
      setFeaturedEndsAt('');
      setFeaturedNote('');
      await loadFeatured(secret);
    } catch (err: any) {
      showToast(err?.message || 'Failed to add featured', false);
    }
  }

  async function removeFeatured(id: string) {
    try {
      const res = await fetch(`/api/admin-featured?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-notify-secret': secret },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove featured');
      showToast('Featured removed', true);
      await loadFeatured(secret);
    } catch (err: any) {
      showToast(err?.message || 'Failed to remove featured', false);
    }
  }

  async function normalizeCampuses() {
    try {
      const res = await fetch('/api/admin-normalize-campus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to normalize campuses');
      showToast(data.message || 'Campuses normalized', true);
      await loadBusinesses(secret, campusFilter);
      await loadCampusOptions(secret);
    } catch (err: any) {
      showToast(err?.message || 'Failed to normalize campuses', false);
    }
  }

  async function normalizeCategories() {
    try {
      const res = await fetch('/api/admin-normalize-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to normalize categories');
      showToast(`Categories normalized (${data.updated || 0})`, true);
      await loadBusinesses(secret, campusFilter);
    } catch (err: any) {
      showToast(err?.message || 'Failed to normalize categories', false);
    }
  }

  const filtered = businesses.filter(b => {
    if (campusFilter !== 'all') {
      const key = getBusinessCampusKey(b);
      if (key !== campusFilter) return false;
    }
    if (filter === 'pending') return !b.is_onboarded;
    if (filter === 'approved') return b.is_onboarded;
    return true;
  });
  const pendingCount = businesses.filter(b => !b.is_onboarded).length;
  const pendingRequests = requests.filter(r => r.status === 'pending').length;

  const filteredRequests = requests.filter(r => {
    if (requestFilter === 'pending') return r.status === 'pending';
    if (requestFilter === 'approved') return r.status === 'approved';
    if (requestFilter === 'rejected') return r.status === 'rejected';
    return true;
  });

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
            <button onClick={() => { loadBusinesses(secret); loadFeatured(secret); loadCampusOptions(secret); }} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Refresh</button>
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
              <button onClick={() => { loadBusinesses(secret); loadFeatured(secret); loadCampusOptions(secret); }} className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors">
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
                <p className="text-sm font-bold text-white">Campus Featured Manager</p>
                <p className="text-xs text-neutral-500 mt-1">Manually feature providers by campus</p>
              </div>
              <button onClick={() => loadFeatured(secret)} className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors">
                Refresh
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
              <select
                value={featuredBusinessId}
                onChange={e => setFeaturedBusinessId(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200"
              >
                <option value="">Select business</option>
                {allBusinesses.filter(b => {
                  if (!b.campus_provider) return false;
                  if (!b.is_onboarded) return false;
                  const key = getBusinessCampusKey(b);
                  if (featuredCampusKey === 'all') return true;
                  return key === featuredCampusKey;
                }).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <select
                value={featuredCampusKey}
                onChange={e => setFeaturedCampusKey(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200"
              >
                <option value="all">All campuses</option>
                {campusOptions.map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
              <select
                value={featuredSlot}
                onChange={e => setFeaturedSlot(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200"
              >
                {[1,2,3].map(n => (<option key={n} value={String(n)}>Slot {n}</option>))}
              </select>
              <input
                type="date"
                value={featuredEndsAt}
                onChange={e => setFeaturedEndsAt(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200"
              />
              <input
                type="text"
                placeholder="Note (optional)"
                value={featuredNote}
                onChange={e => setFeaturedNote(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200"
              />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={addFeatured}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600">
                Add Featured
              </button>
              <p className="text-[11px] text-neutral-500">If no end date is set, it stays featured until removed.</p>
            </div>
            {featuredLoading ? (
              <div className="text-xs text-neutral-500">Loading featured…</div>
            ) : featuredRows.length === 0 ? (
              <div className="text-xs text-neutral-500">No featured providers yet.</div>
            ) : (
              <div className="space-y-2">
                {featuredRows.map(row => (
                  <div key={row.id} className="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm text-white font-semibold">{row.businesses?.name || row.business_id}</p>
                      <p className="text-[11px] text-neutral-500">Campus: {row.campus_key} • Slot {row.slot} • Ends {row.ends_at ? formatDate(row.ends_at) : 'Never'}</p>
                    </div>
                    <button
                      onClick={() => removeFeatured(row.id)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
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
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-bold text-white">RLS Status</p>
                <p className="text-xs text-neutral-500 mt-1">Row Level Security for core tables</p>
              </div>
              <button onClick={() => loadRlsStatus(secret)} className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors">
                Refresh
              </button>
            </div>
            {rlsLoading ? (
              <div className="text-xs text-neutral-500">Loading RLS status…</div>
            ) : rlsStatus.length === 0 ? (
              <div className="text-xs text-neutral-500">No RLS data available.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {rlsStatus.map((row: any) => (
                  <div key={row.tablename} className="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3">
                    <div className="text-sm text-white">{row.tablename}</div>
                    <div className={`text-xs font-semibold ${row.rowsecurity ? 'text-emerald-400' : 'text-red-400'}`}>
                      {row.rowsecurity ? 'RLS ON' : 'RLS OFF'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-bold text-white">Security Status</p>
                <p className="text-xs text-neutral-500 mt-1">Column guard triggers (mutation allowlists)</p>
              </div>
              <button onClick={() => loadSecurityStatus(secret)} className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors">
                Refresh
              </button>
            </div>
            {securityLoading ? (
              <div className="text-xs text-neutral-500">Loading security status…</div>
            ) : securityStatus.length === 0 ? (
              <div className="text-xs text-neutral-500">No security data available.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {securityStatus.map((row: any) => (
                  <div key={row.tablename} className="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3">
                    <div className="text-sm text-white">{row.tablename}</div>
                    <div className={`text-xs font-semibold ${row.has_guard ? 'text-emerald-400' : 'text-red-400'}`}>
                      {row.has_guard ? 'GUARD ON' : 'GUARD OFF'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1 w-fit">
              {(['businesses', 'requests'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    if (tab === 'requests') loadRequests(secret);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${activeTab === tab ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                  {tab === 'businesses' ? 'New businesses' : 'Edit requests'}
                  {tab === 'requests' && pendingRequests > 0 && (
                    <span className="ml-1.5 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingRequests}</span>
                  )}
                </button>
              ))}
            </div>
            {activeTab === 'businesses' && (
            <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1 w-fit">
              {(['pending', 'approved', 'all'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${filter === f ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
                  {f}{f === 'pending' && pendingCount > 0 && <span className="ml-1.5 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
                </button>
              ))}
            </div>
            )}
            {activeTab === 'businesses' && (
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <span>Campus</span>
                <select
                  value={campusFilter}
                  onChange={e => { const next = e.target.value; setCampusFilter(next); loadBusinesses(secret, next); loadFeatured(secret, next); }}
                  className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200">
                  <option value="all">All campuses</option>
                  {campusOptions.map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={normalizeCampuses}
                  className="text-[11px] px-2.5 py-2 rounded-lg border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-600 transition-colors">
                  Normalize names
                </button>
                <button
                  onClick={normalizeCategories}
                  className="text-[11px] px-2.5 py-2 rounded-lg border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-600 transition-colors">
                  Normalize categories
                </button>
              </div>
            )}
            {activeTab === 'requests' && (
              <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1 w-fit">
                {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
                  <button key={f} onClick={() => setRequestFilter(f)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${requestFilter === f ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
                    {f}{f === 'pending' && pendingRequests > 0 && <span className="ml-1.5 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingRequests}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {activeTab === 'businesses' && loading ? (
            <div className="flex justify-center py-20">
              <div className="relative h-10 w-10">
                <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
              </div>
            </div>
          ) : activeTab === 'businesses' && filtered.length === 0 ? (
            <div className="text-center py-20 text-neutral-500">
              <p className="text-3xl mb-3">🎉</p>
              <p>No {filter === 'pending' ? 'pending' : ''} businesses</p>
            </div>
          ) : activeTab === 'businesses' ? (
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
          ) : requestsLoading ? (
            <div className="flex justify-center py-20">
              <div className="relative h-10 w-10">
                <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
              </div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-20 text-neutral-500">
              <p className="text-3xl mb-3">🎉</p>
              <p>No change requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map(r => (
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
                            <p className="text-xs text-neutral-400 mt-1">Before: {(r.before && (r.before as any)[k] != null) ? String((r.before as any)[k]).slice(0, 120) : '—'}</p>
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

export default AdminPage;
