import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin, setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

type SecurityEventRow = {
  id: string;
  created_at: string;
  event_type: string;
  severity: 'info' | 'warning' | 'critical';
  route: string | null;
  method: string | null;
  status_code: number | null;
  ip: string | null;
  actor_user_id: string | null;
  actor_email: string | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
};

type SecuritySeverity = 'info' | 'warning' | 'critical';
type SeriesPoint = {
  ts: string;
  label: string;
  total: number;
  info: number;
  warning: number;
  critical: number;
};

function isSuspiciousEvent(ev: SecurityEventRow): boolean {
  const type = (ev.event_type || '').toLowerCase();
  if (ev.severity === 'critical' || ev.severity === 'warning') return true;
  if ((ev.status_code || 0) >= 400) return true;
  return (
    type.includes('auth_') ||
    type.includes('admin_access_denied') ||
    type.includes('rate_limit') ||
    type.includes('forbidden') ||
    type.includes('unauthorized')
  );
}

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

function applyEventFilters(
  query: any,
  filters: {
    severities: SecuritySeverity[];
    eventType: string;
    routeContains: string;
    ip: string;
    q: string;
  }
) {
  if (filters.severities.length === 1) {
    query = query.eq('severity', filters.severities[0]);
  } else if (filters.severities.length > 1) {
    query = query.in('severity', filters.severities);
  }
  if (filters.eventType) query = query.eq('event_type', filters.eventType);
  if (filters.routeContains) query = query.ilike('route', `%${sanitizeLike(filters.routeContains)}%`);
  if (filters.ip) query = query.ilike('ip', `%${sanitizeLike(filters.ip)}%`);
  if (filters.q) {
    const q = sanitizeLike(filters.q);
    if (q) {
      const pattern = `%${q}%`;
      query = query.or(
        `event_type.ilike.${pattern},route.ilike.${pattern},message.ilike.${pattern},ip.ilike.${pattern},actor_email.ilike.${pattern}`
      );
    }
  }
  return query;
}

function dayLabel(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function hourLabel(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric' });
}

function buildSeries(events: SecurityEventRow[], rangeStart: Date, rangeEnd: Date): SeriesPoint[] {
  const spanMs = rangeEnd.getTime() - rangeStart.getTime();
  const spanHours = spanMs / (60 * 60 * 1000);
  const hourly = spanHours <= 48;
  const stepMs = hourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const base = new Date(rangeStart);
  if (hourly) base.setMinutes(0, 0, 0);
  else base.setUTCHours(0, 0, 0, 0);

  const points: SeriesPoint[] = [];
  for (let t = base.getTime(); t <= rangeEnd.getTime(); t += stepMs) {
    const ts = new Date(t).toISOString();
    points.push({
      ts,
      label: hourly ? hourLabel(ts) : dayLabel(ts),
      total: 0,
      info: 0,
      warning: 0,
      critical: 0,
    });
  }
  if (!points.length) return points;
  const firstTs = new Date(points[0].ts).getTime();
  const lastTs = new Date(points[points.length - 1].ts).getTime() + stepMs - 1;

  for (const ev of events) {
    const eventTime = new Date(ev.created_at).getTime();
    if (Number.isNaN(eventTime)) continue;
    if (eventTime < firstTs || eventTime > lastTs) continue;
    const index = Math.floor((eventTime - firstTs) / stepMs);
    if (index < 0 || index >= points.length) continue;
    points[index].total += 1;
    points[index][ev.severity] += 1;
  }

  return points.slice(-120);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 20, windowMs: 60_000, keyPrefix: 'admin-security-events' }))) return;

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 10), 300);
    const supabase = getSupabase();
    const now = new Date();

    const preset = String(req.query.preset || '24h').toLowerCase();
    const selectedDay = typeof req.query.day === 'string' ? req.query.day.trim() : '';
    const startInput = req.query.start;
    const endInput = req.query.end;
    const severityInput = typeof req.query.severity === 'string' ? req.query.severity : '';
    const eventType = typeof req.query.event_type === 'string' ? req.query.event_type.trim().slice(0, 80) : '';
    const routeContains = typeof req.query.route === 'string' ? req.query.route.trim().slice(0, 120) : '';
    const ip = typeof req.query.ip === 'string' ? req.query.ip.trim().slice(0, 120) : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';

    let rangeStart: Date;
    let rangeEnd: Date = now;
    if (selectedDay) {
      rangeStart = parseDateInput(selectedDay) || new Date(now.getTime() - 24 * 60 * 60 * 1000);
      rangeEnd = parseDateInput(selectedDay, { endOfDay: true }) || now;
    } else if (preset === '7d') {
      rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (preset === '30d') {
      rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (preset === 'custom') {
      rangeStart = parseDateInput(startInput) || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      rangeEnd = parseDateInput(endInput, { endOfDay: true }) || now;
    } else {
      rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    if (rangeEnd.getTime() < rangeStart.getTime()) {
      const tmp = rangeStart;
      rangeStart = rangeEnd;
      rangeEnd = tmp;
    }

    const severities = (severityInput ? severityInput.split(',') : ['info', 'warning', 'critical'])
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is SecuritySeverity => s === 'info' || s === 'warning' || s === 'critical');
    const normalizedSeverities = severities.length ? severities : ['info', 'warning', 'critical'];
    const filters = { severities: normalizedSeverities, eventType, routeContains, ip, q };
    const rangeStartIso = rangeStart.toISOString();
    const rangeEndIso = rangeEnd.toISOString();

    let eventsQuery = supabase
      .from('security_events')
      .select('id, created_at, event_type, severity, route, method, status_code, ip, actor_user_id, actor_email, message, metadata')
      .gte('created_at', rangeStartIso)
      .lte('created_at', rangeEndIso)
      .order('created_at', { ascending: false })
      .limit(limit);
    eventsQuery = applyEventFilters(eventsQuery, filters);
    const { data, error } = await eventsQuery;

    if (error) return res.status(500).json({ error: 'Failed to fetch security events' });

    let analyticsQuery = supabase
      .from('security_events')
      .select('id, created_at, event_type, severity, route, method, status_code, ip, actor_user_id, actor_email, message, metadata')
      .gte('created_at', rangeStartIso)
      .lte('created_at', rangeEndIso)
      .order('created_at', { ascending: true })
      .limit(10000);
    analyticsQuery = applyEventFilters(analyticsQuery, filters);
    const { data: analyticsData, error: analyticsError } = await analyticsQuery;
    if (analyticsError) return res.status(500).json({ error: 'Failed to fetch security summary' });

    const events = (data || []) as SecurityEventRow[];
    const rangeEvents = (analyticsData || []) as SecurityEventRow[];

    const severityCounts = { info: 0, warning: 0, critical: 0 };
    const eventTypeCounts: Record<string, number> = {};
    for (const ev of rangeEvents) {
      severityCounts[ev.severity] = (severityCounts[ev.severity] || 0) + 1;
      eventTypeCounts[ev.event_type] = (eventTypeCounts[ev.event_type] || 0) + 1;
    }

    const topEventTypes = Object.entries(eventTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([event_type, count]) => ({ event_type, count }));

    const series = buildSeries(rangeEvents, rangeStart, rangeEnd);

    const ipMap = new Map<
      string,
      { count: number; critical: number; warning: number; lastSeen: string; eventTypeCounts: Record<string, number> }
    >();
    for (const ev of rangeEvents) {
      const ip = (ev.ip || '').trim();
      if (!ip) continue;
      if (!isSuspiciousEvent(ev)) continue;
      const next = ipMap.get(ip) || {
        count: 0,
        critical: 0,
        warning: 0,
        lastSeen: ev.created_at,
        eventTypeCounts: {},
      };
      next.count += 1;
      if (ev.severity === 'critical') next.critical += 1;
      if (ev.severity === 'warning') next.warning += 1;
      if (new Date(ev.created_at).getTime() > new Date(next.lastSeen).getTime()) {
        next.lastSeen = ev.created_at;
      }
      next.eventTypeCounts[ev.event_type] = (next.eventTypeCounts[ev.event_type] || 0) + 1;
      ipMap.set(ip, next);
    }

    const topSuspiciousIps = Array.from(ipMap.entries())
      .map(([ip, value]) => ({
        ip,
        count: value.count,
        critical: value.critical,
        warning: value.warning,
        lastSeen: value.lastSeen,
        topEventTypes: Object.entries(value.eventTypeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([eventType, count]) => ({ eventType, count })),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const authFailures = rangeEvents.filter((ev) => {
      const t = (ev.event_type || '').toLowerCase();
      return (
        t.includes('auth_') ||
        t.includes('admin_access_denied') ||
        t.includes('forbidden') ||
        t.includes('unauthorized')
      );
    }).length;
    const rateLimitHits = rangeEvents.filter((ev) => (ev.event_type || '').toLowerCase().includes('rate_limit')).length;
    const riskyEvents = rangeEvents.filter((ev) => isSuspiciousEvent(ev)).length;

    const calendarStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    let calendarQuery = supabase
      .from('security_events')
      .select('created_at, severity, event_type, route, message, ip, actor_email, status_code')
      .gte('created_at', calendarStart.toISOString())
      .lte('created_at', now.toISOString())
      .order('created_at', { ascending: true })
      .limit(15000);
    calendarQuery = applyEventFilters(calendarQuery, filters);
    const { data: calendarData } = await calendarQuery;

    const calendarMap = new Map<string, { date: string; total: number; info: number; warning: number; critical: number }>();
    for (const raw of (calendarData || []) as Array<{ created_at: string; severity: SecuritySeverity }>) {
      const d = new Date(raw.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const date = d.toISOString().slice(0, 10);
      const row = calendarMap.get(date) || { date, total: 0, info: 0, warning: 0, critical: 0 };
      row.total += 1;
      row[raw.severity] += 1;
      calendarMap.set(date, row);
    }
    const calendar = Array.from(calendarMap.values()).sort((a, b) => (a.date > b.date ? 1 : -1));

    const availableEventTypes = Object.entries(eventTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([event_type]) => event_type);

    return res.status(200).json({
      summary: {
        last24h: {
          total: rangeEvents.length,
          severityCounts,
          topEventTypes,
          series,
          attackSignals: {
            authFailures,
            rateLimitHits,
            riskyEvents,
            uniqueSuspiciousIps: topSuspiciousIps.length,
          },
          topSuspiciousIps,
          range: {
            preset: selectedDay ? 'day' : preset,
            day: selectedDay || null,
            start: rangeStartIso,
            end: rangeEndIso,
          },
          calendar,
          availableEventTypes,
        },
      },
      events,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
