import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin, setSecurityHeaders, rateLimit, isValidUuid, clampString } from '../../lib/apiSecurity';
import { logSecurityEvent } from '../../lib/securityEvents';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );
}

type ErrorStatus = 'open' | 'investigating' | 'resolved' | 'muted';
type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';
type ErrorSource = 'client' | 'server';

type AppErrorRow = {
  id: string;
  created_at: string;
  updated_at: string;
  first_seen: string;
  last_seen: string;
  source: ErrorSource;
  severity: ErrorSeverity;
  status: ErrorStatus;
  fingerprint: string;
  message: string;
  route: string | null;
  component: string | null;
  user_agent: string | null;
  sample_stack: string | null;
  sample_payload: Record<string, unknown> | null;
  occurrences: number;
  affected_users: number;
  notes: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
};

function parseDateInput(raw: unknown, opts: { endOfDay?: boolean } = {}): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const value = raw.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = dateOnly
    ? new Date(`${value}T${opts.endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function sanitizeLike(input: string): string {
  return input.replace(/[%(),]/g, '').trim().slice(0, 120);
}

function applyFilters(
  query: any,
  filters: {
    status: string;
    severity: string;
    source: string;
    routeContains: string;
    componentContains: string;
    q: string;
  }
) {
  if (filters.status && ['open', 'investigating', 'resolved', 'muted'].includes(filters.status)) {
    query = query.eq('status', filters.status);
  }
  if (filters.severity && ['info', 'warning', 'error', 'critical'].includes(filters.severity)) {
    query = query.eq('severity', filters.severity);
  }
  if (filters.source && ['client', 'server'].includes(filters.source)) {
    query = query.eq('source', filters.source);
  }
  if (filters.routeContains) query = query.ilike('route', `%${sanitizeLike(filters.routeContains)}%`);
  if (filters.componentContains) query = query.ilike('component', `%${sanitizeLike(filters.componentContains)}%`);
  if (filters.q) {
    const q = sanitizeLike(filters.q);
    if (q) {
      const pattern = `%${q}%`;
      query = query.or(
        `message.ilike.${pattern},route.ilike.${pattern},component.ilike.${pattern},fingerprint.ilike.${pattern},status.ilike.${pattern}`
      );
    }
  }
  return query;
}

function bucketLabel(ts: string, hourly: boolean) {
  const d = new Date(ts);
  if (hourly) return d.toLocaleTimeString('en-US', { hour: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'admin-error-tracker' }))) return;

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const supabase = getSupabase();

  if (req.method === 'GET') {
    try {
      const status = clampString(req.query.status, 20).toLowerCase();
      const severity = clampString(req.query.severity, 20).toLowerCase();
      const source = clampString(req.query.source, 20).toLowerCase();
      const routeContains = clampString(req.query.route, 120);
      const componentContains = clampString(req.query.component, 120);
      const q = clampString(req.query.q, 120);
      const preset = clampString(req.query.preset, 20).toLowerCase() || '7d';
      const selectedDay = clampString(req.query.day, 20);
      const startInput = req.query.start;
      const endInput = req.query.end;
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 10), 300);
      const now = new Date();

      let rangeStart: Date;
      let rangeEnd: Date = now;
      if (selectedDay) {
        rangeStart = parseDateInput(selectedDay) || new Date(now.getTime() - 24 * 60 * 60 * 1000);
        rangeEnd = parseDateInput(selectedDay, { endOfDay: true }) || now;
      } else if (preset === '24h') {
        rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (preset === '30d') {
        rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (preset === 'custom') {
        rangeStart = parseDateInput(startInput) || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        rangeEnd = parseDateInput(endInput, { endOfDay: true }) || now;
      } else {
        rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
      if (rangeEnd.getTime() < rangeStart.getTime()) {
        const tmp = rangeStart;
        rangeStart = rangeEnd;
        rangeEnd = tmp;
      }
      const rangeStartIso = rangeStart.toISOString();
      const rangeEndIso = rangeEnd.toISOString();
      const filters = { status, severity, source, routeContains, componentContains, q };

      let query = supabase
        .from('app_errors')
        .select('id, created_at, updated_at, first_seen, last_seen, source, severity, status, fingerprint, message, route, component, user_agent, sample_stack, sample_payload, occurrences, affected_users, notes, resolution_notes, resolved_at')
        .gte('last_seen', rangeStartIso)
        .lte('last_seen', rangeEndIso)
        .order('last_seen', { ascending: false })
        .limit(limit);
      query = applyFilters(query, filters);

      const { data, error } = await query;
      if (error) return res.status(500).json({ error: 'Failed to load error tracker' });
      const issues = (data || []) as AppErrorRow[];

      let analyticsQuery = supabase
        .from('app_errors')
        .select('id, last_seen, source, severity, status, route, component, message')
        .gte('last_seen', rangeStartIso)
        .lte('last_seen', rangeEndIso)
        .order('last_seen', { ascending: true })
        .limit(10000);
      analyticsQuery = applyFilters(analyticsQuery, filters);
      const { data: analyticsData, error: analyticsError } = await analyticsQuery;
      if (analyticsError) return res.status(500).json({ error: 'Failed to load error analytics' });
      const analyticsRows = (analyticsData || []) as Array<{
        id: string;
        last_seen: string;
        source: ErrorSource;
        severity: ErrorSeverity;
        status: ErrorStatus;
        route: string | null;
        component: string | null;
        message: string | null;
      }>;

      const severityCounts = { info: 0, warning: 0, error: 0, critical: 0 };
      const statusCounts = { open: 0, investigating: 0, resolved: 0, muted: 0 };
      const sourceCounts = { client: 0, server: 0 };
      const routeCounts: Record<string, number> = {};
      for (const row of analyticsRows) {
        severityCounts[row.severity] += 1;
        statusCounts[row.status] += 1;
        sourceCounts[row.source] += 1;
        if (row.route) routeCounts[row.route] = (routeCounts[row.route] || 0) + 1;
      }
      const topRoutes = Object.entries(routeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([route, count]) => ({ route, count }));

      const spanMs = rangeEnd.getTime() - rangeStart.getTime();
      const hourly = spanMs / (60 * 60 * 1000) <= 48;
      const stepMs = hourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      const base = new Date(rangeStart);
      if (hourly) base.setMinutes(0, 0, 0);
      else base.setUTCHours(0, 0, 0, 0);
      const series: Array<{ ts: string; label: string; total: number; critical: number; error: number; warning: number; info: number }> = [];
      for (let t = base.getTime(); t <= rangeEnd.getTime(); t += stepMs) {
        const ts = new Date(t).toISOString();
        series.push({ ts, label: bucketLabel(ts, hourly), total: 0, critical: 0, error: 0, warning: 0, info: 0 });
      }
      if (series.length) {
        const firstTs = new Date(series[0].ts).getTime();
        const lastTs = new Date(series[series.length - 1].ts).getTime() + stepMs - 1;
        for (const row of analyticsRows) {
          const t = new Date(row.last_seen).getTime();
          if (Number.isNaN(t) || t < firstTs || t > lastTs) continue;
          const idx = Math.floor((t - firstTs) / stepMs);
          if (idx < 0 || idx >= series.length) continue;
          series[idx].total += 1;
          series[idx][row.severity] += 1;
        }
      }

      let calendarQuery = supabase
        .from('app_errors')
        .select('last_seen, severity, status, source, route, component, message')
        .gte('last_seen', new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString())
        .lte('last_seen', now.toISOString())
        .order('last_seen', { ascending: true })
        .limit(15000);
      calendarQuery = applyFilters(calendarQuery, filters);
      const { data: calendarData } = await calendarQuery;
      const calendarMap = new Map<string, { date: string; total: number; critical: number; error: number; warning: number; info: number }>();
      for (const row of (calendarData || []) as Array<{ last_seen: string; severity: ErrorSeverity }>) {
        const d = new Date(row.last_seen);
        if (Number.isNaN(d.getTime())) continue;
        const date = d.toISOString().slice(0, 10);
        const agg = calendarMap.get(date) || { date, total: 0, critical: 0, error: 0, warning: 0, info: 0 };
        agg.total += 1;
        agg[row.severity] += 1;
        calendarMap.set(date, agg);
      }
      const calendar = Array.from(calendarMap.values()).sort((a, b) => (a.date > b.date ? 1 : -1));

      return res.status(200).json({
        issues,
        summary: {
          range: {
            preset: selectedDay ? 'day' : preset,
            day: selectedDay || null,
            start: rangeStartIso,
            end: rangeEndIso,
          },
          total: analyticsRows.length,
          severityCounts,
          statusCounts,
          sourceCounts,
          topRoutes,
          series: series.slice(-120),
          calendar,
        },
      });
    } catch {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const id = clampString(req.body?.id, 64);
      if (!isValidUuid(id)) return res.status(400).json({ error: 'Invalid id' });

      const status = clampString(req.body?.status, 20).toLowerCase();
      const notes = clampString(req.body?.notes, 2000);
      const resolutionNotes = clampString(req.body?.resolution_notes, 2000);

      const update: Record<string, unknown> = {};
      if (status && ['open', 'investigating', 'resolved', 'muted'].includes(status)) update.status = status;
      if (notes) update.notes = notes;
      if (resolutionNotes) update.resolution_notes = resolutionNotes;
      if (status === 'resolved') update.resolved_at = new Date().toISOString();

      if (!Object.keys(update).length) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const { error } = await supabase.from('app_errors').update(update).eq('id', id);
      if (error) return res.status(500).json({ error: 'Failed to update issue' });

      await logSecurityEvent({
        eventType: 'admin_error_issue_updated',
        severity: 'info',
        req,
        statusCode: 200,
        actorUserId: admin.id,
        actorEmail: admin.email,
        message: 'Admin updated error tracker issue',
        metadata: { id, status: update.status || null },
      });

      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
