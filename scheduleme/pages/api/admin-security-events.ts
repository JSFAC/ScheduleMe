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

function hourLabel(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: 'numeric' });
}

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 20, windowMs: 60_000, keyPrefix: 'admin-security-events' }))) return;

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 10), 300);
    const supabase = getSupabase();
    const now = Date.now();
    const sinceIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('security_events')
      .select('id, created_at, event_type, severity, route, method, status_code, ip, actor_user_id, actor_email, message, metadata')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ error: 'Failed to fetch security events' });

    const { data: dayData, error: dayError } = await supabase
      .from('security_events')
      .select('id, created_at, event_type, severity, route, method, status_code, ip, actor_user_id, actor_email, message, metadata')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .limit(5000);

    if (dayError) return res.status(500).json({ error: 'Failed to fetch security summary' });

    const events = (data || []) as SecurityEventRow[];
    const events24h = (dayData || []) as SecurityEventRow[];

    const severityCounts = { info: 0, warning: 0, critical: 0 };
    const eventTypeCounts: Record<string, number> = {};
    for (const ev of events24h) {
      severityCounts[ev.severity] = (severityCounts[ev.severity] || 0) + 1;
      eventTypeCounts[ev.event_type] = (eventTypeCounts[ev.event_type] || 0) + 1;
    }

    const topEventTypes = Object.entries(eventTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([event_type, count]) => ({ event_type, count }));

    const currentHourMs = new Date(new Date(now).setMinutes(0, 0, 0)).getTime();
    const startHourMs = currentHourMs - 23 * 60 * 60 * 1000;
    const series = Array.from({ length: 24 }, (_, i) => {
      const ts = new Date(startHourMs + i * 60 * 60 * 1000).toISOString();
      return {
        ts,
        label: hourLabel(ts),
        total: 0,
        info: 0,
        warning: 0,
        critical: 0,
      };
    });

    for (const ev of events24h) {
      const t = new Date(ev.created_at).getTime();
      if (t < startHourMs || t > currentHourMs + 59 * 60 * 1000 + 59 * 1000) continue;
      const idx = Math.floor((t - startHourMs) / (60 * 60 * 1000));
      if (idx < 0 || idx >= 24) continue;
      series[idx].total += 1;
      series[idx][ev.severity] += 1;
    }

    const ipMap = new Map<
      string,
      { count: number; critical: number; warning: number; lastSeen: string; eventTypeCounts: Record<string, number> }
    >();
    for (const ev of events24h) {
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

    const authFailures = events24h.filter((ev) => {
      const t = (ev.event_type || '').toLowerCase();
      return (
        t.includes('auth_') ||
        t.includes('admin_access_denied') ||
        t.includes('forbidden') ||
        t.includes('unauthorized')
      );
    }).length;
    const rateLimitHits = events24h.filter((ev) => (ev.event_type || '').toLowerCase().includes('rate_limit')).length;
    const riskyEvents = events24h.filter((ev) => isSuspiciousEvent(ev)).length;

    return res.status(200).json({
      summary: {
        last24h: {
          total: events24h.length,
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
        },
      },
      events,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
