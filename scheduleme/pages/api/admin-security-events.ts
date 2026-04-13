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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 20, windowMs: 60_000, keyPrefix: 'admin-security-events' }))) return;

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 10), 300);
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('security_events')
      .select('id, created_at, event_type, severity, route, method, status_code, ip, actor_user_id, actor_email, message, metadata')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ error: 'Failed to fetch security events' });

    const events = (data || []) as SecurityEventRow[];
    const sinceMs = Date.now() - (24 * 60 * 60 * 1000);
    const events24h = events.filter((e) => new Date(e.created_at).getTime() >= sinceMs);

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

    return res.status(200).json({
      summary: {
        last24h: {
          total: events24h.length,
          severityCounts,
          topEventTypes,
        },
      },
      events,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
