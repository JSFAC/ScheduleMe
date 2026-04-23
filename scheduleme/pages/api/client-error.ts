import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';
import { logSecurityEvent } from '../../lib/securityEvents';

type ClientErrorBody = {
  message?: string;
  stack?: string;
  route?: string;
  component?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  payload?: Record<string, unknown>;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );
}

function clean(input: unknown, max = 500): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, max);
}

function toSeverity(input: unknown): 'info' | 'warning' | 'error' | 'critical' {
  const value = clean(input, 20).toLowerCase();
  if (value === 'info' || value === 'warning' || value === 'error' || value === 'critical') return value;
  return 'error';
}

function safePayload(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const lk = k.toLowerCase();
    if (lk.includes('token') || lk.includes('secret') || lk.includes('password') || lk.includes('cookie')) {
      out[k] = '[REDACTED]';
      continue;
    }
    if (typeof v === 'string') out[k] = v.slice(0, 500);
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[k] = v;
    else out[k] = '[OBJECT]';
  }
  return out;
}

function makeFingerprint(message: string, route: string, stack: string, component: string): string {
  const stackHead = stack.split('\n').slice(0, 3).join('\n');
  return createHash('sha256')
    .update(`${message}|${route}|${component}|${stackHead}`)
    .digest('hex');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'client-error' }))) return;

  try {
    const body = (req.body || {}) as ClientErrorBody;
    const message = clean(body.message, 1000);
    if (!message) return res.status(400).json({ error: 'message is required' });
    const stack = clean(body.stack, 8000);
    const route = clean(body.route, 300) || null;
    const component = clean(body.component, 200) || null;
    const severity = toSeverity(body.severity);
    const payload = safePayload(body.payload);
    const userAgent = clean(req.headers['user-agent'], 500) || null;

    const fingerprint = makeFingerprint(message, route || '', stack, component || '');
    const supabase = getSupabase();

    const { data: existing } = await supabase
      .from('app_errors')
      .select('id, occurrences, affected_users, last_actor_user_id, status')
      .eq('fingerprint', fingerprint)
      .maybeSingle();

    let errorId: string | null = null;
    if (!existing) {
      const { data: inserted, error } = await supabase
        .from('app_errors')
        .insert({
          source: 'client',
          severity,
          status: 'open',
          fingerprint,
          message,
          route,
          component,
          user_agent: userAgent,
          sample_stack: stack || null,
          sample_payload: payload,
          occurrences: 1,
          affected_users: 0,
        })
        .select('id')
        .single();
      if (error) return res.status(500).json({ error: 'Failed to log client error' });
      errorId = inserted?.id || null;
    } else {
      const nextOccurrences = Math.max(1, Number(existing.occurrences || 0) + 1);
      const { error } = await supabase
        .from('app_errors')
        .update({
          severity,
          message,
          route,
          component,
          user_agent: userAgent,
          sample_stack: stack || null,
          sample_payload: payload,
          occurrences: nextOccurrences,
          last_seen: new Date().toISOString(),
          status: existing.status === 'resolved' ? 'investigating' : existing.status,
        })
        .eq('id', existing.id);
      if (error) return res.status(500).json({ error: 'Failed to update client error' });
      errorId = existing.id;
    }

    await logSecurityEvent({
      eventType: 'client_error_reported',
      severity: severity === 'critical' ? 'critical' : severity === 'warning' ? 'warning' : 'info',
      req,
      statusCode: 200,
      message: 'Client error reported',
      metadata: {
        fingerprint,
        route,
        component,
        severity,
      },
    });

    return res.status(200).json({ ok: true, error_id: errorId });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
