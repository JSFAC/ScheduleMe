// @ts-nocheck
// pages/admin/index.tsx — ScheduleMe admin panel
import type { NextPage } from 'next';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { useState, useCallback, useEffect } from 'react';
import { getSupabaseClient } from '../../lib/supabaseClient';

interface Business {
  id: string; name: string; owner_name: string; owner_email: string;
  phone: string | null; address: string | null; service_tags: string[];
  is_onboarded: boolean; stripe_onboarded: boolean; created_at: string;
  campus_provider?: boolean; campus_school_name?: string | null;
  edu_verified?: boolean; school_domain?: string | null;
  campus_key?: string | null;
  founder50?: boolean | null;
  founder50_status?: string | null;
  status?: string | null;
  review_notes?: string | null;
  approved_at?: string | null;
  city?: string | null;
  zip?: string | null;
  website?: string | null;
  instagram?: string | null;
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
  const [authToken, setAuthToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [codeChecked, setCodeChecked] = useState(false);
  const [codeOk, setCodeOk] = useState(false);
  const [adminVerified, setAdminVerified] = useState<boolean | null>(null);
  const [adminVerifyError, setAdminVerifyError] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [allBusinesses, setAllBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectModalFor, setRejectModalFor] = useState<Business | null>(null);
  const [rejectReason, setRejectReason] = useState('');
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
    const trimmed = name.toLowerCase().trim();
    if (trimmed.includes('.')) {
      return trimmed.replace(/[^a-z0-9.]+/g, '');
    }
    const cleaned = trimmed.replace(/[^a-z0-9]+/g, ' ').trim();
    const key = cleaned ? cleaned.replace(/\s+/g, '_') : null;
    if (!key) return null;
    if (key === 'uc_santa_cruz' || key === 'ucsc' || key === 'ucsc_edu') return 'ucsc.edu';
    if (key === 'arizona_state_university' || key === 'asu' || key === 'asu_edu' || key === 'a') return 'asu.edu';
    return key;
  }

  function campusAcronym(name?: string | null): string | null {
    if (!name) return null;
    const trimmed = name.trim();
    if (/^[A-Z0-9]{2,6}$/.test(trimmed)) return trimmed;
    const parts = trimmed.replace(/[^a-z0-9\s]+/gi, ' ').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    return parts.map(p => p[0]).join('').toUpperCase();
  }

  function getBusinessCampusKey(b: Business): string | null {
    return normalizeCampusKey(b.campus_key || b.campus_school_name || null);
  }

  function campusDisplayLabel(key: string, fallback?: string | null): string {
    if (key === 'a') return 'ASU';
    if (key.includes('.')) return key.replace('.edu', '').toUpperCase();
    if (fallback) return fallback;
    return key.toUpperCase();
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  const loadBusinesses = useCallback(async (token: string, campusKey = campusFilter) => {
    setLoading(true);
    try {
      const qs = campusKey && campusKey !== 'all' ? `?campus=${encodeURIComponent(campusKey)}` : '';
      const res = await fetch(`/api/admin-businesses${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        setAuthed(false);
        setAuthToken('');
        setAdminVerified(false);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setBusinesses(data.businesses ?? []);
      setAuthed(true);
      setStripeLoading(true);
      const stripeRes = await fetch('/api/admin-stripe-health', { headers: { Authorization: `Bearer ${token}` } });
      if (stripeRes.ok) {
        const stripeData = await stripeRes.json();
        setStripeHealth(stripeData);
      }
    } catch {
      showToast('Failed to load providers', false);
    } finally {
      setLoading(false);
      setStripeLoading(false);
    }
  }, []);

  const loadFeatured = useCallback(async (token: string, campusKey: string) => {
    setFeaturedLoading(true);
    try {
      const qs = campusKey && campusKey !== 'all' ? `?campus=${encodeURIComponent(campusKey)}` : '';
      const res = await fetch(`/api/admin-featured${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
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

  const loadRlsStatus = useCallback(async (token: string) => {
    setRlsLoading(true);
    try {
      const res = await fetch('/api/admin-rls-status', {
        headers: { Authorization: `Bearer ${token}` },
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

  const loadSecurityStatus = useCallback(async (token: string) => {
    setSecurityLoading(true);
    try {
      const res = await fetch('/api/admin-security-status', {
        headers: { Authorization: `Bearer ${token}` },
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

  const loadRequests = useCallback(async (token: string) => {
    setRequestsLoading(true);
    try {
      const res = await fetch('/api/admin-change-requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        setAuthed(false);
        setAuthToken('');
        setAdminVerified(false);
        setRequestsLoading(false);
        return;
      }
      const data = await res.json();
      setRequests(data.requests ?? []);
      setAuthed(true);
    } catch {
      showToast('Failed to load requests', false);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  const loadCampusOptions = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/admin-businesses', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      const all = data.businesses ?? [];
      setAllBusinesses(all);
      const campusLabelMap = new Map<string, { label: string; count: number }>();
      all.forEach((b: any) => {
        const key = normalizeCampusKey(b.campus_key || b.school_domain || b.campus_school_name || null);
        if (!key) return;
        const rawLabel = b.school_domain || campusAcronym(b.campus_school_name) || b.campus_school_name || b.campus_key || key;
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

  useEffect(() => {
    // Force re-auth whenever the page is left or restored from bfcache
    const resetAuth = () => {
      setAuthed(false);
      setAuthToken('');
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
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem('sm_admin_code_ok');
    if (!raw) { setCodeChecked(true); return; }
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.exp && Date.now() < parsed.exp) {
        setCodeOk(true);
      } else {
        sessionStorage.removeItem('sm_admin_code_ok');
      }
    } catch {
      sessionStorage.removeItem('sm_admin_code_ok');
    }
    setCodeChecked(true);
  }, []);

  useEffect(() => {
    if (!codeChecked) return;
    if (codeOk) return;
    if (typeof window === 'undefined') return;
    window.location.replace('/admin/login');
  }, [codeChecked, codeOk]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const clearCodeAndSession = () => {
      try { sessionStorage.removeItem('sm_admin_code_ok'); } catch {}
      try { sessionStorage.removeItem('sm_admin_next'); } catch {}
      const sb = getSupabaseClient();
      sb.auth.signOut({ scope: 'local' });
    };
    window.addEventListener('pagehide', clearCodeAndSession);
    window.addEventListener('beforeunload', clearCodeAndSession);
    return () => {
      window.removeEventListener('pagehide', clearCodeAndSession);
      window.removeEventListener('beforeunload', clearCodeAndSession);
    };
  }, []);

  useEffect(() => {
    const sb = getSupabaseClient();
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) {
        setAuthed(false);
        setAuthToken('');
        setAuthChecked(true);
        setAdminVerified(null);
        return;
      }
      setAuthToken(session.access_token);
      setAuthed(true);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authed || !authToken) return;
    let cancelled = false;
    (async () => {
      setAdminVerified(null);
      setAdminVerifyError(null);
      try {
        const res = await fetch('/api/admin-verify', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || 'Admin access required');
        }
        if (!cancelled) setAdminVerified(true);
      } catch (err: any) {
        if (!cancelled) {
          setAdminVerified(false);
          setAdminVerifyError(err?.message || 'Admin access required');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [authed, authToken]);

  useEffect(() => {
    if (!authed || !authToken || adminVerified !== true) return;
    loadFeatured(authToken, featuredCampusKey);
  }, [authed, authToken, adminVerified, featuredCampusKey, loadFeatured]);

  useEffect(() => {
    if (!authed || !authToken || adminVerified !== true) return;
    handleAdminRefresh();
  }, [authed, authToken, adminVerified]);

  useEffect(() => {
    if (!authed) return;
    const IDLE_MS = 3 * 60 * 1000;
    let timer: number | null = null;

    const resetTimer = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setAuthed(false);
        setAuthToken('');
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

  async function handleAdminRefresh() {
    if (!authToken) return;
    await loadBusinesses(authToken);
    await loadFeatured(authToken, featuredCampusKey);
    await loadCampusOptions(authToken);
    await loadRlsStatus(authToken);
    await loadSecurityStatus(authToken);
    await loadRequests(authToken);
  }

  async function approveBusiness(id: string) {
    setApprovingId(id);
    try {
      const res = await fetch('/api/approve-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ businessId: id, schoolDomain: schoolDomains[id] || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message, true);
      setBusinesses(bs => bs.map(b => b.id === id ? { ...b, is_onboarded: true, status: 'approved', review_notes: null } : b));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to approve provider', false);
    } finally {
      setApprovingId(null);
    }
  }

  async function rejectBusiness(id: string, reason: string) {
    setRejectingId(id);
    try {
      const res = await fetch('/api/reject-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ businessId: id, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject provider');
      showToast(data.message || 'Provider rejected', true);
      setBusinesses(bs => bs.map(b => b.id === id ? {
        ...b,
        is_onboarded: false,
        status: 'rejected',
        review_notes: reason,
      } : b));
      setRejectModalFor(null);
      setRejectReason('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reject provider', false);
    } finally {
      setRejectingId(null);
    }
  }

  async function refundBooking() {
    if (!refundBookingId.trim()) return;
    setRefunding(true);
    try {
      const res = await fetch('/api/admin-refund-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
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
      await loadFeatured(authToken, featuredCampusKey);
    } catch (err: any) {
      showToast(err?.message || 'Failed to add featured', false);
    }
  }

  async function removeFeatured(id: string) {
    try {
      const res = await fetch(`/api/admin-featured?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove featured');
      showToast('Featured removed', true);
      await loadFeatured(authToken, featuredCampusKey);
    } catch (err: any) {
      showToast(err?.message || 'Failed to remove featured', false);
    }
  }

  async function normalizeCampuses() {
    try {
      const res = await fetch('/api/admin-normalize-campus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to normalize campuses');
      showToast(data.message || 'Campuses normalized', true);
      await loadBusinesses(authToken, campusFilter);
      await loadCampusOptions(authToken);
      await loadFeatured(authToken, featuredCampusKey);
    } catch (err: any) {
      showToast(err?.message || 'Failed to normalize campuses', false);
    }
  }

  async function normalizeCategories() {
    try {
      const res = await fetch('/api/admin-normalize-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to normalize categories');
      showToast(`Categories normalized (${data.updated || 0})`, true);
      await loadBusinesses(authToken, campusFilter);
    } catch (err: any) {
      showToast(err?.message || 'Failed to normalize categories', false);
    }
  }

  const filtered = businesses.filter(b => {
    if (campusFilter !== 'all') {
      const key = getBusinessCampusKey(b);
      if (key !== campusFilter) return false;
    }
    if (filter === 'pending') return !b.is_onboarded && b.status !== 'rejected';
    if (filter === 'approved') return b.is_onboarded;
    return true;
  });
  const visibleFeaturedRows = featuredCampusKey === 'all'
    ? featuredRows
    : featuredRows.filter(row => normalizeCampusKey(row.campus_key) === featuredCampusKey);
  const pendingCount = businesses.filter(b => !b.is_onboarded && b.status !== 'rejected').length;
  const pendingRequests = requests.filter(r => r.status === 'pending').length;

  const filteredRequests = requests.filter(r => {
    if (requestFilter === 'pending') return r.status === 'pending';
    if (requestFilter === 'approved') return r.status === 'approved';
    if (requestFilter === 'rejected') return r.status === 'rejected';
    return true;
  });

  if (!codeChecked) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-6">
        <p className="text-neutral-400 text-sm">Checking admin access…</p>
      </div>
    );
  }

  if (!codeOk) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <p className="text-neutral-400 text-sm">Redirecting to admin code…</p>
        </div>
      </div>
    );
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-6">
        <p className="text-neutral-400 text-sm">Checking admin access…</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <span className="text-2xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>ScheduleMe</span>
            <p className="text-accent text-xs font-semibold tracking-widest uppercase mt-1">Admin Panel</p>
            <p className="text-neutral-500 text-sm mt-3">Admin access required.</p>
          </div>
          <div className="space-y-3">
            <Link href="/signin?next=/admin&admin=1" className="btn-primary w-full py-3 text-center block">Sign in</Link>
            <p className="text-xs text-neutral-500 text-center">Use an admin account to continue.</p>
          </div>
        </div>
      </div>
    );
  }

  if (adminVerified === null) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-6">
        <p className="text-neutral-400 text-sm">Verifying admin access…</p>
      </div>
    );
  }

  if (adminVerified === false) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <p className="text-white font-semibold">Admin access required.</p>
          {adminVerifyError && <p className="text-xs text-neutral-500 mt-2">{adminVerifyError}</p>}
          <div className="mt-4 space-y-2">
            <Link href="/signin?next=/admin&admin=1" className="btn-primary w-full py-3 text-center block">Try another account</Link>
            <Link href="/admin/login" className="text-xs text-neutral-500 hover:text-neutral-300 block">Enter admin code again</Link>
          </div>
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
      {rejectModalFor && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-700 bg-neutral-900 p-5">
            <h3 className="text-lg font-bold text-white">Reject Provider Application</h3>
            <p className="text-sm text-neutral-400 mt-1">
              Send a clear reason to <span className="text-neutral-200">{rejectModalFor.owner_email}</span>.
            </p>
            <div className="mt-4">
              <label className="text-xs text-neutral-400 uppercase tracking-wide">Reason (required)</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={5}
                placeholder="Explain exactly why this provider was rejected and what needs to be fixed."
                className="mt-2 w-full rounded-xl bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-accent"
              />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => { if (!rejectingId) { setRejectModalFor(null); setRejectReason(''); } }}
                className="px-4 py-2 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                disabled={Boolean(rejectingId)}
              >
                Cancel
              </button>
              <button
                onClick={() => rejectBusiness(rejectModalFor.id, rejectReason.trim())}
                disabled={Boolean(rejectingId) || !rejectReason.trim()}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {rejectingId === rejectModalFor.id ? 'Rejecting…' : 'Reject & Send Email'}
              </button>
            </div>
          </div>
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
            <button onClick={() => { if (authToken) handleAdminRefresh(); }} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Refresh</button>
            <button onClick={async () => { const sb = getSupabaseClient(); await sb.auth.signOut(); setAuthed(false); setAuthToken(''); }} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Log out</button>
          </div>
        </div>
        <main className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Total Providers', value: businesses.length },
              { label: 'Pending', value: pendingCount },
              { label: 'Live Providers', value: businesses.filter(b => b.is_onboarded).length },
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
              <button onClick={() => { if (authToken) handleAdminRefresh(); }} className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors">
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
              <button onClick={() => authToken && loadFeatured(authToken, featuredCampusKey)} className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors">
                Refresh
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
              <select
                value={featuredBusinessId}
                onChange={e => setFeaturedBusinessId(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200"
              >
                <option value="">Select provider</option>
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
            ) : visibleFeaturedRows.length === 0 ? (
              <div className="text-xs text-neutral-500">No featured providers yet.</div>
            ) : (
              <div className="space-y-2">
                {visibleFeaturedRows.map(row => (
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
              <button onClick={() => authToken && loadRlsStatus(authToken)} className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors">
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
              <button onClick={() => authToken && loadSecurityStatus(authToken)} className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors">
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
                    if (tab === 'requests' && authToken) loadRequests(authToken);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${activeTab === tab ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                  {tab === 'businesses' ? 'New providers' : 'Edit requests'}
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
                  onChange={e => { const next = e.target.value; setCampusFilter(next); if (authToken) loadBusinesses(authToken, next); }}
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
              <p>No {filter === 'pending' ? 'pending' : ''} providers</p>
            </div>
          ) : activeTab === 'businesses' ? (
            <div className="space-y-3">
              {filtered.map(b => (
                <div key={b.id} className={`rounded-2xl border bg-neutral-900 p-6 ${b.is_onboarded ? 'border-neutral-800' : 'border-yellow-500/20 bg-yellow-500/5'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <h2 className="text-base font-bold text-white">{b.name}</h2>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                          b.status === 'rejected'
                            ? 'bg-red-500/15 text-red-400 border-red-500/20'
                            : b.is_onboarded
                              ? 'bg-green-500/15 text-green-400 border-green-500/20'
                              : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20'
                        }`}>
                          {b.status === 'rejected' ? 'Rejected' : b.is_onboarded ? 'Approved' : 'Pending'}
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
                          { label: 'City', value: b.city ?? '—' },
                          { label: 'ZIP', value: b.zip ?? '—' },
                          { label: 'Website', value: b.website ?? '—', link: b.website || undefined },
                          { label: 'Instagram', value: b.instagram ?? '—', link: b.instagram ? (String(b.instagram).startsWith('http') ? String(b.instagram) : `https://instagram.com/${String(b.instagram).replace(/^@/, '')}`) : undefined },
                          { label: 'Services', value: b.service_tags?.join(', ') ?? '—' },
                          { label: 'Applied', value: formatDate(b.created_at) },
                          { label: 'Approved', value: b.approved_at ? formatDate(b.approved_at) : '—' },
                          { label: 'Founder50', value: b.founder50_status || (b.founder50 ? 'active' : 'standard') },
                          ...(b.campus_provider ? [{ label: 'School', value: b.campus_school_name ?? '—' }] : []),
                          ...(b.campus_provider ? [{ label: 'School domain', value: b.school_domain ?? '—' }] : []),
                        ].map(({ label, value, link }) => (
                          <div key={label}>
                            <p className="text-xs text-neutral-500">{label}</p>
                            {link ? <a href={link} className="text-accent hover:underline truncate block">{value}</a> : <p className="text-neutral-300 truncate">{value}</p>}
                          </div>
                        ))}
                      </div>
                      {b.review_notes ? (
                        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                          <p className="text-[11px] text-red-300 uppercase tracking-wide">Last rejection reason</p>
                          <p className="text-xs text-red-200 mt-1 whitespace-pre-wrap">{b.review_notes}</p>
                        </div>
                      ) : null}
                    </div>
                    {!b.is_onboarded && b.status !== 'rejected' && (
                      <div className="flex flex-col gap-2 items-end flex-shrink-0 w-full sm:w-[220px]">
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
                          className="btn-primary text-sm px-5 py-2.5 w-full">
                          {approvingId === b.id ? 'Approving…' : 'Approve & Send Email'}
                        </button>
                        <button
                          onClick={() => { setRejectModalFor(b); setRejectReason(''); }}
                          className="text-sm font-semibold px-5 py-2.5 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/15 w-full"
                        >
                          Reject with Reason
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
                        <h2 className="text-base font-bold text-white">{r.businesses?.name || 'Provider'}</h2>
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

const AdminPageNoSSR = dynamic(() => Promise.resolve(AdminPage), { ssr: false });
export default AdminPageNoSSR;
