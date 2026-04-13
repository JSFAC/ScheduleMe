// @ts-nocheck
// pages/admin/index.tsx — ScheduleMe admin panel
import type { NextPage } from 'next';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { useState, useCallback, useEffect, useMemo } from 'react';
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

interface SecurityEvent {
  id: string;
  created_at: string;
  event_type: string;
  severity: 'info' | 'warning' | 'critical';
  route: string | null;
  method: string | null;
  status_code: number | null;
  ip?: string | null;
  actor_email: string | null;
  message: string | null;
}

interface ErrorIssue {
  id: string;
  created_at: string;
  updated_at: string;
  first_seen: string;
  last_seen: string;
  source: 'client' | 'server' | string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'muted';
  fingerprint: string;
  message: string;
  route: string | null;
  component: string | null;
  occurrences: number;
  notes?: string | null;
  resolution_notes?: string | null;
  resolved_at?: string | null;
}

interface ErrorSeriesPoint {
  ts: string;
  label: string;
  total: number;
  critical: number;
  error: number;
  warning: number;
  info: number;
}

interface ErrorCalendarDay {
  date: string;
  total: number;
  critical: number;
  error: number;
  warning: number;
  info: number;
}

interface ErrorSummary {
  range: {
    preset: string;
    day: string | null;
    start: string;
    end: string;
  };
  total: number;
  severityCounts: { info: number; warning: number; error: number; critical: number };
  statusCounts: { open: number; investigating: number; resolved: number; muted: number };
  sourceCounts: { client: number; server: number };
  topRoutes: Array<{ route: string; count: number }>;
  series: ErrorSeriesPoint[];
  calendar: ErrorCalendarDay[];
}

interface SecuritySeriesPoint {
  ts: string;
  label: string;
  total: number;
  info: number;
  warning: number;
  critical: number;
}

interface SecurityCalendarDay {
  date: string;
  total: number;
  info: number;
  warning: number;
  critical: number;
}

interface SecuritySummary24h {
  total: number;
  severityCounts: { info: number; warning: number; critical: number };
  topEventTypes: Array<{ event_type: string; count: number }>;
  series?: SecuritySeriesPoint[];
  range?: {
    preset: string;
    day: string | null;
    start: string;
    end: string;
  };
  attackSignals?: {
    authFailures: number;
    rateLimitHits: number;
    riskyEvents: number;
    uniqueSuspiciousIps: number;
  };
  calendar?: SecurityCalendarDay[];
  availableEventTypes?: string[];
  topSuspiciousIps?: Array<{
    ip: string;
    count: number;
    critical: number;
    warning: number;
    lastSeen: string;
    topEventTypes: Array<{ eventType: string; count: number }>;
  }>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function dateKey(input: Date) {
  const y = input.getUTCFullYear();
  const m = String(input.getUTCMonth() + 1).padStart(2, '0');
  const d = String(input.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthKey(input: Date) {
  const y = input.getUTCFullYear();
  const m = String(input.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function shiftMonth(key: string, delta: number) {
  const [year, month] = key.split('-').map((n) => Number(n));
  const base = new Date(Date.UTC(year, (month || 1) - 1, 1));
  base.setUTCMonth(base.getUTCMonth() + delta);
  return monthKey(base);
}

function readableMonth(key: string) {
  const [year, month] = key.split('-').map((n) => Number(n));
  return new Date(Date.UTC(year, (month || 1) - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function SecurityVolumeChart({ points }: { points: SecuritySeriesPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.total || 0));
  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3">
      <p className="text-[11px] text-neutral-500 mb-2">Volume trend</p>
      <div className="h-20 flex items-end gap-1">
        {points.map((p) => (
          <div key={p.ts} className="flex-1 h-full flex flex-col justify-end">
            <div
              title={`${p.label}: ${p.total} events`}
              className="w-full rounded-sm bg-emerald-400/80 hover:bg-emerald-300 transition-colors"
              style={{ height: `${Math.max(6, Math.round((p.total / max) * 100))}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-600">
        <span>{points[0]?.label || ''}</span>
        <span>{points[points.length - 1]?.label || ''}</span>
      </div>
    </div>
  );
}

function ErrorVolumeChart({ points }: { points: ErrorSeriesPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.total || 0));
  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3">
      <p className="text-[11px] text-neutral-500 mb-2">Error trend</p>
      <div className="h-20 flex items-end gap-1">
        {points.map((p) => (
          <div key={p.ts} className="flex-1 h-full flex flex-col justify-end">
            <div
              title={`${p.label}: ${p.total} issues`}
              className="w-full rounded-sm bg-orange-400/80 hover:bg-orange-300 transition-colors"
              style={{ height: `${Math.max(6, Math.round((p.total / max) * 100))}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-600">
        <span>{points[0]?.label || ''}</span>
        <span>{points[points.length - 1]?.label || ''}</span>
      </div>
    </div>
  );
}

function isSecurityAuthFailure(eventType: string) {
  const t = (eventType || '').toLowerCase();
  return t.includes('auth_') || t.includes('admin_access_denied') || t.includes('forbidden') || t.includes('unauthorized');
}

function isSecurityRateLimit(eventType: string) {
  return (eventType || '').toLowerCase().includes('rate_limit');
}

function isSecurityRisky(row: SecurityEvent) {
  if (row.severity === 'critical' || row.severity === 'warning') return true;
  if ((row.status_code || 0) >= 400) return true;
  return isSecurityAuthFailure(row.event_type) || isSecurityRateLimit(row.event_type);
}

function isSecurityAdminAction(eventType: string) {
  return (eventType || '').toLowerCase().startsWith('admin_');
}

function isSecurityAdminDenied(eventType: string) {
  const t = (eventType || '').toLowerCase();
  return t.includes('admin_access_denied') || t.includes('admin_gate_missing');
}

function isSecurityPrivilegeChange(eventType: string) {
  const t = (eventType || '').toLowerCase();
  return t.includes('role') || t.includes('privilege') || t.includes('permission');
}

function isSecurityWebhookFailure(row: SecurityEvent) {
  const t = (row.event_type || '').toLowerCase();
  if (!t.includes('webhook')) return false;
  if (row.severity === 'warning' || row.severity === 'critical') return true;
  return (row.status_code || 0) >= 400;
}

function isSecuritySuspiciousIp(
  row: SecurityEvent,
  suspiciousIpSet: Set<string>
) {
  if (!row.ip || !isSecurityRisky(row)) return false;
  if (!suspiciousIpSet.size) return true;
  return suspiciousIpSet.has(row.ip);
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
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [securityEventsLoading, setSecurityEventsLoading] = useState(false);
  const [securityEventSummary, setSecurityEventSummary] = useState<SecuritySummary24h | null>(null);
  const [securityRangePreset, setSecurityRangePreset] = useState<'24h' | '7d' | '30d' | 'custom'>('24h');
  const [securityStartDate, setSecurityStartDate] = useState('');
  const [securityEndDate, setSecurityEndDate] = useState('');
  const [securitySeverity, setSecuritySeverity] = useState<'all' | 'info' | 'warning' | 'critical'>('all');
  const [securityEventType, setSecurityEventType] = useState('');
  const [securitySearch, setSecuritySearch] = useState('');
  const [securityRouteFilter, setSecurityRouteFilter] = useState('');
  const [securityIpFilter, setSecurityIpFilter] = useState('');
  const [selectedSecurityDay, setSelectedSecurityDay] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => monthKey(new Date()));
  const [securitySignalFilter, setSecuritySignalFilter] = useState<
    'all'
    | 'auth_failures'
    | 'rate_limit_hits'
    | 'risky_events'
    | 'suspicious_ips'
    | 'admin_actions'
    | 'admin_denied'
    | 'api_401_403'
    | 'api_429'
    | 'api_5xx'
    | 'webhook_failures'
    | 'privilege_changes'
  >('all');
  const [errorIssues, setErrorIssues] = useState<ErrorIssue[]>([]);
  const [errorSummary, setErrorSummary] = useState<ErrorSummary | null>(null);
  const [errorIssuesLoading, setErrorIssuesLoading] = useState(false);
  const [errorFilter, setErrorFilter] = useState<'open' | 'investigating' | 'resolved' | 'muted' | 'all'>('open');
  const [errorRangePreset, setErrorRangePreset] = useState<'24h' | '7d' | '30d' | 'custom'>('7d');
  const [errorStartDate, setErrorStartDate] = useState('');
  const [errorEndDate, setErrorEndDate] = useState('');
  const [errorSeverityFilter, setErrorSeverityFilter] = useState<'all' | 'info' | 'warning' | 'error' | 'critical'>('all');
  const [errorSourceFilter, setErrorSourceFilter] = useState<'all' | 'client' | 'server'>('all');
  const [errorSearch, setErrorSearch] = useState('');
  const [errorRouteFilter, setErrorRouteFilter] = useState('');
  const [errorComponentFilter, setErrorComponentFilter] = useState('');
  const [selectedErrorDay, setSelectedErrorDay] = useState('');
  const [errorCalendarMonth, setErrorCalendarMonth] = useState(() => monthKey(new Date()));
  const [errorSignalFilter, setErrorSignalFilter] = useState<'all' | 'open' | 'investigating' | 'resolved' | 'muted' | 'critical' | 'error' | 'warning' | 'info' | 'client' | 'server'>('all');
  const [issueStatusDrafts, setIssueStatusDrafts] = useState<Record<string, string>>({});
  const [updatingIssueId, setUpdatingIssueId] = useState<string | null>(null);
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

  const loadSecurityEvents = useCallback(async (token: string) => {
    setSecurityEventsLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('limit', '120');
      if (selectedSecurityDay) {
        qs.set('day', selectedSecurityDay);
      } else {
        qs.set('preset', securityRangePreset);
        if (securityRangePreset === 'custom') {
          if (securityStartDate) qs.set('start', securityStartDate);
          if (securityEndDate) qs.set('end', securityEndDate);
        }
      }
      if (securitySeverity !== 'all') qs.set('severity', securitySeverity);
      if (securityEventType) qs.set('event_type', securityEventType);
      if (securitySearch.trim()) qs.set('q', securitySearch.trim());
      if (securityRouteFilter.trim()) qs.set('route', securityRouteFilter.trim());
      if (securityIpFilter.trim()) qs.set('ip', securityIpFilter.trim());

      const res = await fetch(`/api/admin-security-events?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load security events');
      setSecurityEvents(data.events || []);
      setSecurityEventSummary(data.summary?.last24h || null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load security events', false);
    } finally {
      setSecurityEventsLoading(false);
    }
  }, [selectedSecurityDay, securityRangePreset, securityStartDate, securityEndDate, securitySeverity, securityEventType, securitySearch, securityRouteFilter, securityIpFilter]);

  const loadErrorIssues = useCallback(async (token: string) => {
    setErrorIssuesLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('limit', '120');
      if (selectedErrorDay) {
        qs.set('day', selectedErrorDay);
      } else {
        qs.set('preset', errorRangePreset);
        if (errorRangePreset === 'custom') {
          if (errorStartDate) qs.set('start', errorStartDate);
          if (errorEndDate) qs.set('end', errorEndDate);
        }
      }
      if (errorFilter !== 'all') qs.set('status', errorFilter);
      if (errorSeverityFilter !== 'all') qs.set('severity', errorSeverityFilter);
      if (errorSourceFilter !== 'all') qs.set('source', errorSourceFilter);
      if (errorSearch.trim()) qs.set('q', errorSearch.trim());
      if (errorRouteFilter.trim()) qs.set('route', errorRouteFilter.trim());
      if (errorComponentFilter.trim()) qs.set('component', errorComponentFilter.trim());
      const res = await fetch(`/api/admin-error-tracker?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load error tracker');
      setErrorIssues(data.issues || []);
      setErrorSummary(data.summary || null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load error tracker', false);
    } finally {
      setErrorIssuesLoading(false);
    }
  }, [selectedErrorDay, errorRangePreset, errorStartDate, errorEndDate, errorFilter, errorSeverityFilter, errorSourceFilter, errorSearch, errorRouteFilter, errorComponentFilter]);

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
    await loadSecurityEvents(authToken);
    await loadErrorIssues(authToken);
    await loadRequests(authToken);
  }

  useEffect(() => {
    if (!authed || !authToken || adminVerified !== true) return;
    loadErrorIssues(authToken);
  }, [authed, authToken, adminVerified, loadErrorIssues]);

  useEffect(() => {
    if (!authed || !authToken || adminVerified !== true) return;
    loadSecurityEvents(authToken);
  }, [authed, authToken, adminVerified, loadSecurityEvents]);

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

  async function updateErrorIssueStatus(id: string) {
    const nextStatus = (issueStatusDrafts[id] || '').trim();
    if (!nextStatus) return;
    setUpdatingIssueId(id);
    try {
      const res = await fetch('/api/admin-error-tracker', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to update issue');
      showToast('Issue status updated', true);
      await loadErrorIssues(authToken);
    } catch (err: any) {
      showToast(err?.message || 'Failed to update issue', false);
    } finally {
      setUpdatingIssueId(null);
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
  const issueCounts = errorIssues.reduce((acc, issue) => {
    acc.total += 1;
    acc[issue.status] = (acc[issue.status] || 0) + 1;
    return acc;
  }, { total: 0, open: 0, investigating: 0, resolved: 0, muted: 0 } as Record<string, number>);
  const topIssueFingerprints = [...errorIssues]
    .sort((a, b) => (b.occurrences || 0) - (a.occurrences || 0))
    .slice(0, 6);
  const errorCalendarMap = useMemo(() => {
    const out = new Map<string, ErrorCalendarDay>();
    for (const day of errorSummary?.calendar || []) out.set(day.date, day);
    return out;
  }, [errorSummary?.calendar]);
  const errorCalendarDaysInMonth = useMemo(() => {
    const [yy, mm] = errorCalendarMonth.split('-').map((n) => Number(n));
    const year = Number.isFinite(yy) ? yy : new Date().getUTCFullYear();
    const month = Number.isFinite(mm) ? mm : new Date().getUTCMonth() + 1;
    const first = new Date(Date.UTC(year, month - 1, 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const leading = first.getUTCDay();
    const cells: Array<{ date: string; inMonth: boolean }> = [];
    for (let i = 0; i < leading; i += 1) {
      const d = new Date(first);
      d.setUTCDate(d.getUTCDate() - (leading - i));
      cells.push({ date: dateKey(d), inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ date: dateKey(new Date(Date.UTC(year, month - 1, day))), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = new Date(`${cells[cells.length - 1].date}T00:00:00Z`);
      last.setUTCDate(last.getUTCDate() + 1);
      cells.push({ date: dateKey(last), inMonth: false });
    }
    return cells;
  }, [errorCalendarMonth]);
  const maxErrorCalendarCount = useMemo(() => {
    return Math.max(1, ...(errorSummary?.calendar || []).map((d) => d.total || 0));
  }, [errorSummary?.calendar]);
  const errorRangeLabel = errorSummary?.range
    ? `${new Date(errorSummary.range.start).toLocaleDateString()} - ${new Date(errorSummary.range.end).toLocaleDateString()}`
    : 'Selected range';
  const calendarMap = useMemo(() => {
    const out = new Map<string, SecurityCalendarDay>();
    for (const day of securityEventSummary?.calendar || []) out.set(day.date, day);
    return out;
  }, [securityEventSummary?.calendar]);
  const calendarDaysInMonth = useMemo(() => {
    const [yy, mm] = calendarMonth.split('-').map((n) => Number(n));
    const year = Number.isFinite(yy) ? yy : new Date().getUTCFullYear();
    const month = Number.isFinite(mm) ? mm : new Date().getUTCMonth() + 1;
    const first = new Date(Date.UTC(year, month - 1, 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const leading = first.getUTCDay();
    const cells: Array<{ date: string; inMonth: boolean }> = [];
    for (let i = 0; i < leading; i += 1) {
      const d = new Date(first);
      d.setUTCDate(d.getUTCDate() - (leading - i));
      cells.push({ date: dateKey(d), inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ date: dateKey(new Date(Date.UTC(year, month - 1, day))), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = new Date(`${cells[cells.length - 1].date}T00:00:00Z`);
      last.setUTCDate(last.getUTCDate() + 1);
      cells.push({ date: dateKey(last), inMonth: false });
    }
    return cells;
  }, [calendarMonth]);
  const maxCalendarCount = useMemo(() => {
    return Math.max(1, ...(securityEventSummary?.calendar || []).map((d) => d.total || 0));
  }, [securityEventSummary?.calendar]);
  const securityRangeLabel = securityEventSummary?.range
    ? `${new Date(securityEventSummary.range.start).toLocaleDateString()} - ${new Date(securityEventSummary.range.end).toLocaleDateString()}`
    : 'Selected range';
  const suspiciousIpSet = useMemo(() => {
    const out = new Set<string>();
    for (const row of securityEventSummary?.topSuspiciousIps || []) {
      if (row.ip) out.add(row.ip);
    }
    return out;
  }, [securityEventSummary?.topSuspiciousIps]);
  const securitySignalCounts = useMemo(() => {
    const counts = {
      authFailures: 0,
      rateLimitHits: 0,
      riskyEvents: 0,
      uniqueSuspiciousIps: 0,
      adminActions: 0,
      adminDenied: 0,
      api401403: 0,
      api429: 0,
      api5xx: 0,
      webhookFailures: 0,
      privilegeChanges: 0,
    };
    const suspiciousIps = new Set<string>();
    for (const row of securityEvents) {
      if (isSecurityAuthFailure(row.event_type)) counts.authFailures += 1;
      if (isSecurityRateLimit(row.event_type)) counts.rateLimitHits += 1;
      if (isSecurityRisky(row)) counts.riskyEvents += 1;
      if (isSecuritySuspiciousIp(row, suspiciousIpSet) && row.ip) suspiciousIps.add(row.ip);
      if (isSecurityAdminAction(row.event_type)) counts.adminActions += 1;
      if (isSecurityAdminDenied(row.event_type)) counts.adminDenied += 1;
      if (row.status_code === 401 || row.status_code === 403) counts.api401403 += 1;
      if (row.status_code === 429) counts.api429 += 1;
      if ((row.status_code || 0) >= 500) counts.api5xx += 1;
      if (isSecurityWebhookFailure(row)) counts.webhookFailures += 1;
      if (isSecurityPrivilegeChange(row.event_type)) counts.privilegeChanges += 1;
    }
    counts.uniqueSuspiciousIps = suspiciousIps.size;
    return counts;
  }, [securityEvents, suspiciousIpSet]);
  const errorBreakdownCounts = useMemo(() => {
    const severity = { critical: 0, error: 0, warning: 0, info: 0 };
    const source = { client: 0, server: 0 };
    for (const issue of errorIssues) {
      severity[issue.severity] += 1;
      source[issue.source] += 1;
    }
    return { severity, source };
  }, [errorIssues]);
  const filteredSecurityEvents = securityEvents.filter((row) => {
    if (securitySignalFilter === 'all') return true;
    if (securitySignalFilter === 'auth_failures') return isSecurityAuthFailure(row.event_type);
    if (securitySignalFilter === 'rate_limit_hits') return isSecurityRateLimit(row.event_type);
    if (securitySignalFilter === 'risky_events') return isSecurityRisky(row);
    if (securitySignalFilter === 'suspicious_ips') return isSecuritySuspiciousIp(row, suspiciousIpSet);
    if (securitySignalFilter === 'admin_actions') return isSecurityAdminAction(row.event_type);
    if (securitySignalFilter === 'admin_denied') return isSecurityAdminDenied(row.event_type);
    if (securitySignalFilter === 'api_401_403') return row.status_code === 401 || row.status_code === 403;
    if (securitySignalFilter === 'api_429') return row.status_code === 429;
    if (securitySignalFilter === 'api_5xx') return (row.status_code || 0) >= 500;
    if (securitySignalFilter === 'webhook_failures') return isSecurityWebhookFailure(row);
    if (securitySignalFilter === 'privilege_changes') return isSecurityPrivilegeChange(row.event_type);
    return true;
  });

  const filteredErrorIssues = errorIssues.filter((issue) => {
    if (errorSignalFilter === 'all') return true;
    if (errorSignalFilter === 'client' || errorSignalFilter === 'server') return issue.source === errorSignalFilter;
    if (errorSignalFilter === 'critical' || errorSignalFilter === 'error' || errorSignalFilter === 'warning' || errorSignalFilter === 'info') {
      return issue.severity === errorSignalFilter;
    }
    return issue.status === errorSignalFilter;
  });

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
            <Link href="/admin/login" className="btn-primary w-full py-3 text-center block">Sign in</Link>
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
            <Link href="/admin/login" className="btn-primary w-full py-3 text-center block">Try another account</Link>
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
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 mb-8">
            <div className="flex items-start justify-between mb-4 gap-3">
              <div>
                <p className="text-sm font-bold text-white">Security Events</p>
                <p className="text-xs text-neutral-500 mt-1">Auth, admin, rate-limit, and incident timeline with historical drill-down</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => authToken && loadSecurityEvents(authToken)} className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors">
                  Refresh
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-8 gap-2 mb-4">
              <select
                value={securityRangePreset}
                onChange={(e) => { setSelectedSecurityDay(''); setSecurityRangePreset(e.target.value as any); }}
                className="md:col-span-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200"
              >
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7d</option>
                <option value="30d">Last 30d</option>
                <option value="custom">Custom</option>
              </select>
              <input
                type="date"
                value={securityStartDate}
                onChange={(e) => { setSelectedSecurityDay(''); setSecurityRangePreset('custom'); setSecurityStartDate(e.target.value); }}
                className="md:col-span-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200"
              />
              <input
                type="date"
                value={securityEndDate}
                onChange={(e) => { setSelectedSecurityDay(''); setSecurityRangePreset('custom'); setSecurityEndDate(e.target.value); }}
                className="md:col-span-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200"
              />
              <select
                value={securitySeverity}
                onChange={(e) => setSecuritySeverity(e.target.value as any)}
                className="md:col-span-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200"
              >
                <option value="all">All severity</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
              <select
                value={securityEventType}
                onChange={(e) => setSecurityEventType(e.target.value)}
                className="md:col-span-2 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200"
              >
                <option value="">All categories</option>
                {(securityEventSummary?.availableEventTypes || []).map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <input
                value={securitySearch}
                onChange={(e) => setSecuritySearch(e.target.value)}
                placeholder="Search event/route/message"
                className="md:col-span-2 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-8 gap-2 mb-4">
              <input
                value={securityRouteFilter}
                onChange={(e) => setSecurityRouteFilter(e.target.value)}
                placeholder="Route contains"
                className="md:col-span-3 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600"
              />
              <input
                value={securityIpFilter}
                onChange={(e) => setSecurityIpFilter(e.target.value)}
                placeholder="IP contains"
                className="md:col-span-2 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600"
              />
              <button
                onClick={() => {
                  setSelectedSecurityDay('');
                  setSecurityRangePreset('24h');
                  setSecurityStartDate('');
                  setSecurityEndDate('');
                  setSecuritySeverity('all');
                  setSecurityEventType('');
                  setSecuritySearch('');
                  setSecurityRouteFilter('');
                  setSecurityIpFilter('');
                  setSecuritySignalFilter('all');
                }}
                className="md:col-span-1 text-xs px-3 py-2 rounded-xl border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-600 transition-colors"
              >
                Reset
              </button>
              <div className="md:col-span-2 text-[11px] text-neutral-500 flex items-center justify-end">
                {selectedSecurityDay ? `Focused day: ${selectedSecurityDay}` : securityRangeLabel}
              </div>
            </div>
            {securityEventsLoading ? (
              <div className="text-xs text-neutral-500">Loading security events…</div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2">
                    <p className="text-[11px] text-neutral-500">Events (range)</p>
                    <p className="text-sm font-semibold text-white">{securityEventSummary?.total ?? 0}</p>
                  </div>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2">
                    <p className="text-[11px] text-neutral-500">Critical</p>
                    <p className="text-sm font-semibold text-red-400">{securityEventSummary?.severityCounts?.critical ?? 0}</p>
                  </div>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2">
                    <p className="text-[11px] text-neutral-500">Warning</p>
                    <p className="text-sm font-semibold text-yellow-400">{securityEventSummary?.severityCounts?.warning ?? 0}</p>
                  </div>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2">
                    <p className="text-[11px] text-neutral-500">Info</p>
                    <p className="text-sm font-semibold text-emerald-400">{securityEventSummary?.severityCounts?.info ?? 0}</p>
                  </div>
                </div>
                {securityEventSummary?.series?.length ? (
                  <div className="mb-4">
                    <SecurityVolumeChart points={securityEventSummary.series} />
                  </div>
                ) : null}
                {securityEventSummary?.topEventTypes?.length ? (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {securityEventSummary.topEventTypes.slice(0, 6).map((t) => (
                      <button
                        key={t.event_type}
                        onClick={() => setSecurityEventType((prev) => (prev === t.event_type ? '' : t.event_type))}
                        className={`text-[11px] px-2 py-1 rounded-full border ${securityEventType === t.event_type ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200' : 'bg-neutral-950 border-neutral-800 text-neutral-300'}`}
                      >
                        {t.event_type}: {t.count}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] uppercase tracking-wide text-neutral-500">Incident calendar</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))} className="text-xs text-neutral-400 hover:text-neutral-200">Prev</button>
                      <span className="text-xs text-neutral-300">{readableMonth(calendarMonth)}</span>
                      <button onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))} className="text-xs text-neutral-400 hover:text-neutral-200">Next</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-[10px] text-neutral-600 mb-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => <div key={w} className="text-center">{w}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDaysInMonth.map((cell) => {
                      const row = calendarMap.get(cell.date);
                      const intensity = row ? Math.max(0.15, Math.min(1, (row.total || 0) / maxCalendarCount)) : 0;
                      const selected = selectedSecurityDay === cell.date;
                      return (
                        <button
                          key={cell.date}
                          onClick={() => {
                            if (selectedSecurityDay === cell.date) {
                              setSelectedSecurityDay('');
                            } else {
                              setSelectedSecurityDay(cell.date);
                              setCalendarMonth(cell.date.slice(0, 7));
                            }
                          }}
                          className={`h-8 text-[11px] transition-colors ${cell.inMonth ? 'text-neutral-300' : 'text-neutral-700'} ${selected ? 'font-semibold underline underline-offset-4 decoration-emerald-400' : ''}`}
                          style={row && !selected ? { color: `rgba(52,211,153,${Math.max(0.45, intensity)})` } : undefined}
                          title={`${cell.date}${row ? ` · ${row.total} events` : ' · no events'}`}
                        >
                          <div>{Number(cell.date.slice(8, 10))}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {securityEventSummary?.attackSignals ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                    <button
                      onClick={() => setSecuritySignalFilter((prev) => (prev === 'auth_failures' ? 'all' : 'auth_failures'))}
                      className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${securitySignalFilter === 'auth_failures' ? 'border-red-500/50' : 'border-neutral-800'}`}
                    >
                      <p className="text-[11px] text-neutral-500">Auth failures</p>
                      <p className="text-sm font-semibold text-red-300">{securitySignalCounts.authFailures}</p>
                    </button>
                    <button
                      onClick={() => setSecuritySignalFilter((prev) => (prev === 'rate_limit_hits' ? 'all' : 'rate_limit_hits'))}
                      className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${securitySignalFilter === 'rate_limit_hits' ? 'border-yellow-500/50' : 'border-neutral-800'}`}
                    >
                      <p className="text-[11px] text-neutral-500">Rate-limit hits</p>
                      <p className="text-sm font-semibold text-yellow-300">{securitySignalCounts.rateLimitHits}</p>
                    </button>
                    <button
                      onClick={() => setSecuritySignalFilter((prev) => (prev === 'risky_events' ? 'all' : 'risky_events'))}
                      className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${securitySignalFilter === 'risky_events' ? 'border-orange-500/50' : 'border-neutral-800'}`}
                    >
                      <p className="text-[11px] text-neutral-500">Risky events</p>
                      <p className="text-sm font-semibold text-orange-300">{securitySignalCounts.riskyEvents}</p>
                    </button>
                    <button
                      onClick={() => setSecuritySignalFilter((prev) => (prev === 'suspicious_ips' ? 'all' : 'suspicious_ips'))}
                      className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${securitySignalFilter === 'suspicious_ips' ? 'border-cyan-500/50' : 'border-neutral-800'}`}
                    >
                      <p className="text-[11px] text-neutral-500">Suspicious IPs</p>
                      <p className="text-sm font-semibold text-cyan-300">{securitySignalCounts.uniqueSuspiciousIps}</p>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                    <button
                      onClick={() => setSecuritySignalFilter((prev) => (prev === 'admin_actions' ? 'all' : 'admin_actions'))}
                      className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${securitySignalFilter === 'admin_actions' ? 'border-indigo-500/50' : 'border-neutral-800'}`}
                    >
                      <p className="text-[11px] text-neutral-500">Admin actions</p>
                      <p className="text-sm font-semibold text-indigo-300">{securitySignalCounts.adminActions}</p>
                    </button>
                    <button
                      onClick={() => setSecuritySignalFilter((prev) => (prev === 'admin_denied' ? 'all' : 'admin_denied'))}
                      className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${securitySignalFilter === 'admin_denied' ? 'border-rose-500/50' : 'border-neutral-800'}`}
                    >
                      <p className="text-[11px] text-neutral-500">Admin denied</p>
                      <p className="text-sm font-semibold text-rose-300">{securitySignalCounts.adminDenied}</p>
                    </button>
                    <button
                      onClick={() => setSecuritySignalFilter((prev) => (prev === 'api_401_403' ? 'all' : 'api_401_403'))}
                      className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${securitySignalFilter === 'api_401_403' ? 'border-amber-500/50' : 'border-neutral-800'}`}
                    >
                      <p className="text-[11px] text-neutral-500">API 401/403</p>
                      <p className="text-sm font-semibold text-amber-300">{securitySignalCounts.api401403}</p>
                    </button>
                    <button
                      onClick={() => setSecuritySignalFilter((prev) => (prev === 'api_429' ? 'all' : 'api_429'))}
                      className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${securitySignalFilter === 'api_429' ? 'border-yellow-500/50' : 'border-neutral-800'}`}
                    >
                      <p className="text-[11px] text-neutral-500">API 429</p>
                      <p className="text-sm font-semibold text-yellow-300">{securitySignalCounts.api429}</p>
                    </button>
                    <button
                      onClick={() => setSecuritySignalFilter((prev) => (prev === 'api_5xx' ? 'all' : 'api_5xx'))}
                      className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${securitySignalFilter === 'api_5xx' ? 'border-red-500/50' : 'border-neutral-800'}`}
                    >
                      <p className="text-[11px] text-neutral-500">API 5xx</p>
                      <p className="text-sm font-semibold text-red-300">{securitySignalCounts.api5xx}</p>
                    </button>
                    <button
                      onClick={() => setSecuritySignalFilter((prev) => (prev === 'webhook_failures' ? 'all' : 'webhook_failures'))}
                      className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${securitySignalFilter === 'webhook_failures' ? 'border-fuchsia-500/50' : 'border-neutral-800'}`}
                    >
                      <p className="text-[11px] text-neutral-500">Webhook failures</p>
                      <p className="text-sm font-semibold text-fuchsia-300">{securitySignalCounts.webhookFailures}</p>
                    </button>
                    <button
                      onClick={() => setSecuritySignalFilter((prev) => (prev === 'privilege_changes' ? 'all' : 'privilege_changes'))}
                      className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${securitySignalFilter === 'privilege_changes' ? 'border-sky-500/50' : 'border-neutral-800'}`}
                    >
                      <p className="text-[11px] text-neutral-500">Privilege changes</p>
                      <p className="text-sm font-semibold text-sky-300">{securitySignalCounts.privilegeChanges}</p>
                    </button>
                  </div>
                ) : null}
                {securityEventSummary?.topSuspiciousIps?.length ? (
                  <div className="mb-4">
                    <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-2">Top suspicious IP activity (selected range)</p>
                    <div className="space-y-2 max-h-44 overflow-auto pr-1">
                      {securityEventSummary.topSuspiciousIps.slice(0, 6).map((ipRow) => (
                        <div key={ipRow.ip} className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-neutral-200">{ipRow.ip}</p>
                            <p className="text-[11px] text-neutral-500">{ipRow.count} events</p>
                          </div>
                          <p className="text-[11px] text-neutral-500 mt-1">
                            critical {ipRow.critical} · warning {ipRow.warning} · last {formatDate(ipRow.lastSeen)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {securitySignalFilter !== 'all' ? (
                  <div className="text-[11px] text-neutral-500 mb-3">
                    Signal filter active: <span className="text-neutral-300">{securitySignalFilter}</span>{' '}
                    <button onClick={() => setSecuritySignalFilter('all')} className="text-emerald-300 hover:text-emerald-200">show all</button>
                  </div>
                ) : null}
                {filteredSecurityEvents.length === 0 ? (
                  <div className="text-xs text-neutral-500">No security events recorded yet.</div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-auto pr-1">
                    {filteredSecurityEvents.slice(0, 20).map((row) => (
                      <div key={row.id} className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-neutral-200 truncate">
                            <span className={`font-semibold ${row.severity === 'critical' ? 'text-red-400' : row.severity === 'warning' ? 'text-yellow-400' : 'text-emerald-400'}`}>
                              {row.severity.toUpperCase()}
                            </span>
                            {' '}· {row.event_type}
                            {row.route ? ` · ${row.route}` : ''}
                          </p>
                          <p className="text-[11px] text-neutral-500 whitespace-nowrap">{formatDate(row.created_at)}</p>
                        </div>
                        {row.message ? <p className="text-[11px] text-neutral-500 mt-1 truncate">{row.message}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 mb-8">
            <div className="flex items-start justify-between mb-4 gap-3">
              <div>
                <p className="text-sm font-bold text-white">Error Tracker</p>
                <p className="text-xs text-neutral-500 mt-1">Issue history with filtering, category drill-down, and calendar view</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={errorFilter}
                  onChange={(e) => setErrorFilter(e.target.value as any)}
                  className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-neutral-200"
                >
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                  <option value="muted">Muted</option>
                  <option value="all">All</option>
                </select>
                <button onClick={() => authToken && loadErrorIssues(authToken)} className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors">
                  Refresh
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-8 gap-2 mb-4">
              <select
                value={errorRangePreset}
                onChange={(e) => { setSelectedErrorDay(''); setErrorRangePreset(e.target.value as any); }}
                className="md:col-span-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200"
              >
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7d</option>
                <option value="30d">Last 30d</option>
                <option value="custom">Custom</option>
              </select>
              <input
                type="date"
                value={errorStartDate}
                onChange={(e) => { setSelectedErrorDay(''); setErrorRangePreset('custom'); setErrorStartDate(e.target.value); }}
                className="md:col-span-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200"
              />
              <input
                type="date"
                value={errorEndDate}
                onChange={(e) => { setSelectedErrorDay(''); setErrorRangePreset('custom'); setErrorEndDate(e.target.value); }}
                className="md:col-span-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200"
              />
              <select
                value={errorSeverityFilter}
                onChange={(e) => setErrorSeverityFilter(e.target.value as any)}
                className="md:col-span-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200"
              >
                <option value="all">All severity</option>
                <option value="critical">Critical</option>
                <option value="error">Error</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
              <select
                value={errorSourceFilter}
                onChange={(e) => setErrorSourceFilter(e.target.value as any)}
                className="md:col-span-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200"
              >
                <option value="all">All sources</option>
                <option value="client">Client</option>
                <option value="server">Server</option>
              </select>
              <input
                value={errorRouteFilter}
                onChange={(e) => setErrorRouteFilter(e.target.value)}
                placeholder="Route contains"
                className="md:col-span-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600"
              />
              <input
                value={errorComponentFilter}
                onChange={(e) => setErrorComponentFilter(e.target.value)}
                placeholder="Component contains"
                className="md:col-span-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600"
              />
              <input
                value={errorSearch}
                onChange={(e) => setErrorSearch(e.target.value)}
                placeholder="Search message/fingerprint"
                className="md:col-span-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-8 gap-2 mb-4">
              <button
                onClick={() => {
                  setSelectedErrorDay('');
                  setErrorRangePreset('7d');
                  setErrorStartDate('');
                  setErrorEndDate('');
                  setErrorSeverityFilter('all');
                  setErrorSourceFilter('all');
                  setErrorSearch('');
                  setErrorRouteFilter('');
                  setErrorComponentFilter('');
                  setErrorFilter('open');
                  setErrorSignalFilter('all');
                }}
                className="md:col-span-1 text-xs px-3 py-2 rounded-xl border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-600 transition-colors"
              >
                Reset
              </button>
              <div className="md:col-span-7 text-[11px] text-neutral-500 flex items-center justify-end">
                {selectedErrorDay ? `Focused day: ${selectedErrorDay}` : errorRangeLabel}
              </div>
            </div>
            {errorIssuesLoading ? (
              <div className="text-xs text-neutral-500">Loading error issues…</div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2">
                    <p className="text-[11px] text-neutral-500">Issues (range)</p>
                    <p className="text-sm font-semibold text-white">{errorSummary?.total ?? issueCounts.total}</p>
                  </div>
                  <button onClick={() => setErrorSignalFilter((p) => (p === 'open' ? 'all' : 'open'))} className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${errorSignalFilter === 'open' ? 'border-red-500/50' : 'border-neutral-800'}`}>
                    <p className="text-[11px] text-neutral-500">Open</p>
                    <p className="text-sm font-semibold text-red-300">{errorSummary?.statusCounts?.open ?? issueCounts.open}</p>
                  </button>
                  <button onClick={() => setErrorSignalFilter((p) => (p === 'investigating' ? 'all' : 'investigating'))} className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${errorSignalFilter === 'investigating' ? 'border-yellow-500/50' : 'border-neutral-800'}`}>
                    <p className="text-[11px] text-neutral-500">Investigating</p>
                    <p className="text-sm font-semibold text-yellow-300">{errorSummary?.statusCounts?.investigating ?? issueCounts.investigating}</p>
                  </button>
                  <button onClick={() => setErrorSignalFilter((p) => (p === 'resolved' ? 'all' : 'resolved'))} className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${errorSignalFilter === 'resolved' ? 'border-emerald-500/50' : 'border-neutral-800'}`}>
                    <p className="text-[11px] text-neutral-500">Resolved</p>
                    <p className="text-sm font-semibold text-emerald-300">{errorSummary?.statusCounts?.resolved ?? issueCounts.resolved}</p>
                  </button>
                  <button onClick={() => setErrorSignalFilter((p) => (p === 'muted' ? 'all' : 'muted'))} className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${errorSignalFilter === 'muted' ? 'border-neutral-500/50' : 'border-neutral-800'}`}>
                    <p className="text-[11px] text-neutral-500">Muted</p>
                    <p className="text-sm font-semibold text-neutral-300">{errorSummary?.statusCounts?.muted ?? issueCounts.muted}</p>
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                  <button onClick={() => setErrorSignalFilter((p) => (p === 'critical' ? 'all' : 'critical'))} className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${errorSignalFilter === 'critical' ? 'border-red-500/50' : 'border-neutral-800'}`}>
                    <p className="text-[11px] text-neutral-500">Critical</p>
                    <p className="text-sm font-semibold text-red-300">{errorBreakdownCounts.severity.critical}</p>
                  </button>
                  <button onClick={() => setErrorSignalFilter((p) => (p === 'error' ? 'all' : 'error'))} className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${errorSignalFilter === 'error' ? 'border-orange-500/50' : 'border-neutral-800'}`}>
                    <p className="text-[11px] text-neutral-500">Error</p>
                    <p className="text-sm font-semibold text-orange-300">{errorBreakdownCounts.severity.error}</p>
                  </button>
                  <button onClick={() => setErrorSignalFilter((p) => (p === 'warning' ? 'all' : 'warning'))} className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${errorSignalFilter === 'warning' ? 'border-yellow-500/50' : 'border-neutral-800'}`}>
                    <p className="text-[11px] text-neutral-500">Warning</p>
                    <p className="text-sm font-semibold text-yellow-300">{errorBreakdownCounts.severity.warning}</p>
                  </button>
                  <button onClick={() => setErrorSignalFilter((p) => (p === 'client' ? 'all' : 'client'))} className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${errorSignalFilter === 'client' ? 'border-cyan-500/50' : 'border-neutral-800'}`}>
                    <p className="text-[11px] text-neutral-500">Client</p>
                    <p className="text-sm font-semibold text-cyan-300">{errorBreakdownCounts.source.client}</p>
                  </button>
                  <button onClick={() => setErrorSignalFilter((p) => (p === 'server' ? 'all' : 'server'))} className={`text-left bg-neutral-950 border rounded-xl px-3 py-2 ${errorSignalFilter === 'server' ? 'border-violet-500/50' : 'border-neutral-800'}`}>
                    <p className="text-[11px] text-neutral-500">Server</p>
                    <p className="text-sm font-semibold text-violet-300">{errorBreakdownCounts.source.server}</p>
                  </button>
                </div>
                {errorSummary?.series?.length ? (
                  <div className="mb-4">
                    <ErrorVolumeChart points={errorSummary.series} />
                  </div>
                ) : null}
                {errorSummary?.topRoutes?.length ? (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {errorSummary.topRoutes.slice(0, 8).map((t) => (
                      <button
                        key={t.route}
                        onClick={() => setErrorRouteFilter((prev) => (prev === t.route ? '' : t.route))}
                        className={`text-[11px] px-2 py-1 rounded-full border ${errorRouteFilter === t.route ? 'bg-orange-500/20 border-orange-500/40 text-orange-200' : 'bg-neutral-950 border-neutral-800 text-neutral-300'}`}
                      >
                        {t.route}: {t.count}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] uppercase tracking-wide text-neutral-500">Error calendar</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setErrorCalendarMonth(shiftMonth(errorCalendarMonth, -1))} className="text-xs text-neutral-400 hover:text-neutral-200">Prev</button>
                      <span className="text-xs text-neutral-300">{readableMonth(errorCalendarMonth)}</span>
                      <button onClick={() => setErrorCalendarMonth(shiftMonth(errorCalendarMonth, 1))} className="text-xs text-neutral-400 hover:text-neutral-200">Next</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-[10px] text-neutral-600 mb-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => <div key={w} className="text-center">{w}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {errorCalendarDaysInMonth.map((cell) => {
                      const row = errorCalendarMap.get(cell.date);
                      const intensity = row ? Math.max(0.15, Math.min(1, (row.total || 0) / maxErrorCalendarCount)) : 0;
                      const selected = selectedErrorDay === cell.date;
                      return (
                        <button
                          key={cell.date}
                          onClick={() => {
                            if (selectedErrorDay === cell.date) {
                              setSelectedErrorDay('');
                            } else {
                              setSelectedErrorDay(cell.date);
                              setErrorCalendarMonth(cell.date.slice(0, 7));
                            }
                          }}
                          className={`h-8 text-[11px] transition-colors ${cell.inMonth ? 'text-neutral-300' : 'text-neutral-700'} ${selected ? 'font-semibold underline underline-offset-4 decoration-orange-400' : ''}`}
                          style={row && !selected ? { color: `rgba(251,146,60,${Math.max(0.45, intensity)})` } : undefined}
                          title={`${cell.date}${row ? ` · ${row.total} issues` : ' · no issues'}`}
                        >
                          <div>{Number(cell.date.slice(8, 10))}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {topIssueFingerprints.length ? (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {topIssueFingerprints.map((issue) => (
                      <span key={issue.id} className="text-[11px] px-2 py-1 rounded-full bg-neutral-950 border border-neutral-800 text-neutral-300">
                        {issue.occurrences}x · {issue.message.slice(0, 70)}
                      </span>
                    ))}
                  </div>
                ) : null}
                {errorSignalFilter !== 'all' ? (
                  <div className="text-[11px] text-neutral-500 mb-3">
                    Signal filter active: <span className="text-neutral-300">{errorSignalFilter}</span>{' '}
                    <button onClick={() => setErrorSignalFilter('all')} className="text-orange-300 hover:text-orange-200">show all</button>
                  </div>
                ) : null}
                {filteredErrorIssues.length === 0 ? (
                  <div className="text-xs text-neutral-500">No issues for this filter.</div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-auto pr-1">
                    {filteredErrorIssues.slice(0, 25).map((issue) => (
                      <div key={issue.id} className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-neutral-200 truncate">
                            <span className={`font-semibold ${issue.severity === 'critical' ? 'text-red-400' : issue.severity === 'warning' ? 'text-yellow-400' : issue.severity === 'error' ? 'text-orange-300' : 'text-emerald-400'}`}>
                              {issue.severity.toUpperCase()}
                            </span>
                            {' '}· {issue.source} · {issue.status}
                            {issue.route ? ` · ${issue.route}` : ''}
                          </p>
                          <p className="text-[11px] text-neutral-500 whitespace-nowrap">{formatDate(issue.last_seen)}</p>
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-1 truncate">{issue.message}</p>
                        <div className="flex items-center justify-between gap-3 mt-2">
                          <p className="text-[11px] text-neutral-500">
                            {issue.occurrences} occurrences · first {formatDate(issue.first_seen)}
                          </p>
                          <div className="flex items-center gap-2">
                            <select
                              value={issueStatusDrafts[issue.id] || issue.status}
                              onChange={(e) => setIssueStatusDrafts((prev) => ({ ...prev, [issue.id]: e.target.value }))}
                              className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-[11px] text-neutral-200"
                            >
                              <option value="open">open</option>
                              <option value="investigating">investigating</option>
                              <option value="resolved">resolved</option>
                              <option value="muted">muted</option>
                            </select>
                            <button
                              onClick={() => updateErrorIssueStatus(issue.id)}
                              disabled={updatingIssueId === issue.id}
                              className="text-[11px] px-2.5 py-1 rounded-lg border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 disabled:opacity-50"
                            >
                              {updatingIssueId === issue.id ? 'Saving…' : 'Apply'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
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
