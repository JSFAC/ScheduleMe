import type { NextApiRequest } from 'next';
import { createClient } from '@supabase/supabase-js';

type SecuritySeverity = 'info' | 'warning' | 'critical';

type SecurityEventInput = {
  eventType: string;
  severity?: SecuritySeverity;
  req?: NextApiRequest;
  statusCode?: number;
  actorUserId?: string | null;
  actorEmail?: string | null;
  message?: string;
  metadata?: Record<string, unknown>;
};

function getClientIp(req?: NextApiRequest): string | null {
  if (!req) return null;
  const fwd = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim();
  return fwd || req.socket?.remoteAddress || null;
}

function redactValue(key: string, value: unknown): unknown {
  const k = key.toLowerCase();
  if (
    k.includes('token') ||
    k.includes('secret') ||
    k.includes('password') ||
    k.includes('authorization') ||
    k.includes('cookie')
  ) {
    return '[REDACTED]';
  }
  return value;
}

function sanitizeMetadata(input: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!input) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested: Record<string, unknown> = {};
      for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) {
        nested[nk] = redactValue(nk, nv);
      }
      out[k] = nested;
      continue;
    }
    out[k] = redactValue(k, v);
  }
  return out;
}

let cachedClient: ReturnType<typeof createClient> | null = null;

function getAdminClient() {
  if (cachedClient) return cachedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

export async function logSecurityEvent(input: SecurityEventInput): Promise<void> {
  const client = getAdminClient();
  if (!client) return;

  try {
    await client.from('security_events').insert({
      event_type: input.eventType,
      severity: input.severity || 'info',
      route: input.req?.url || null,
      method: input.req?.method || null,
      status_code: input.statusCode || null,
      ip: getClientIp(input.req),
      actor_user_id: input.actorUserId || null,
      actor_email: (input.actorEmail || '').trim().toLowerCase() || null,
      message: input.message || null,
      metadata: sanitizeMetadata(input.metadata),
    });
  } catch {
    // Never throw from logger.
  }
}
