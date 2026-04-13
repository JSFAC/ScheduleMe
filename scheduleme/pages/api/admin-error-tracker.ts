import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin, setSecurityHeaders, rateLimit, isValidUuid, clampString } from '../../lib/apiSecurity';
import { logSecurityEvent } from '../../lib/securityEvents';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
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
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 10), 300);

      let query = supabase
        .from('app_errors')
        .select('id, created_at, updated_at, first_seen, last_seen, source, severity, status, fingerprint, message, route, component, user_agent, sample_stack, sample_payload, occurrences, affected_users, notes, resolution_notes, resolved_at')
        .order('last_seen', { ascending: false })
        .limit(limit);

      if (status && ['open', 'investigating', 'resolved', 'muted'].includes(status)) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) return res.status(500).json({ error: 'Failed to load error tracker' });
      return res.status(200).json({ issues: data || [] });
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
