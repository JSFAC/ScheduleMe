// @ts-nocheck
// lib/apiSecurity.ts — shared security utilities for all API routes
// OWASP-aligned: rate limiting, auth verification, input validation, security headers

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ─── Security Headers ─────────────────────────────────────────────────────────
// Apply to every API response to prevent common attacks
export function setSecurityHeaders(res: NextApiResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

// ─── Rate Limiter ─────────────────────────────────────────────────────────────
// In-memory store — replace with Upstash Redis for multi-instance production
const rlStore = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of rlStore.entries()) {
      if (now > v.resetAt) rlStore.delete(k);
    }
  }, 5 * 60_000);
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rlStore.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    rlStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

export function getClientIp(req: NextApiRequest): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

// Rate limit helper that sends the 429 response automatically
const upstashLimiters = new Map<string, Ratelimit>();

function getUpstashLimiter(max: number, windowMs: number): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const key = `${max}:${windowMs}`;
  let limiter = upstashLimiters.get(key);
  if (!limiter) {
    const redis = new Redis({ url, token });
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(max, `${windowMs} ms`),
      analytics: true,
      prefix: 'sm',
    });
    upstashLimiters.set(key, limiter);
  }
  return limiter;
}

export async function rateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  opts: { max: number; windowMs: number; keyPrefix?: string }
): Promise<boolean> {
  const ip = getClientIp(req);
  const key = `${opts.keyPrefix ?? 'rl'}:${ip}`;
  const upstash = getUpstashLimiter(opts.max, opts.windowMs);
  if (upstash) {
    try {
      const result = await upstash.limit(key);
      res.setHeader('X-RateLimit-Limit', String(opts.max));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.reset / 1000)));
      if (!result.success) {
        res.status(429).json({
          error: 'Too many requests. Please slow down and try again shortly.',
        });
        return false;
      }
      return true;
    } catch {
      // fall back to in-memory on Upstash failure
    }
  }

  const result = checkRateLimit(key, opts.max, opts.windowMs);

  res.setHeader('X-RateLimit-Limit', String(opts.max));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

  if (!result.allowed) {
    res.status(429).json({
      error: 'Too many requests. Please slow down and try again shortly.',
    });
    return false;
  }
  return true;
}

// ─── Auth Verification ────────────────────────────────────────────────────────
// Verifies the Bearer token and returns the authenticated user
// Returns null and sends 401 if invalid
export async function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '').trim();

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return null;
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
      return null;
    }

    return { id: user.id, email: user.email ?? '' };
  } catch {
    res.status(401).json({ error: 'Authentication failed.' });
    return null;
  }
}

// ─── Admin Verification ─────────────────────────────────────────────────────
// Requires authenticated user + admin role (or email allowlist)
export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<{ id: string; email: string } | null> {
  const user = await requireAuth(req, res);
  if (!user) return null;

  const allowlist = (process.env.ADMIN_EMAIL_ALLOWLIST || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.includes(user.email.toLowerCase())) return user;

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      res.status(500).json({ error: 'Server misconfigured' });
      return null;
    }
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role === 'admin') return user;
  } catch {}

  res.status(403).json({ error: 'Admin access required.' });
  return null;
}

// ─── Input Validation ─────────────────────────────────────────────────────────
export function isValidUuid(s: unknown): s is string {
  return typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export function isValidEmail(s: unknown): s is string {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

export function isValidPhone(s: unknown): s is string {
  return typeof s === 'string' && /^[\d\s\-().+]{7,20}$/.test(s.trim());
}

export function clampString(s: unknown, max: number): string {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max);
}

// Strip unknown fields — only keep allowed keys
export function pickFields<T extends object>(
  body: unknown,
  allowed: (keyof T)[]
): Partial<T> {
  if (!body || typeof body !== 'object') return {};
  const result: Partial<T> = {};
  for (const key of allowed) {
    if (key in (body as object)) {
      (result as any)[key] = (body as any)[key];
    }
  }
  return result;
}

// Return unknown fields in a request body (for strict allowlisting)
export function getUnknownFields(
  body: unknown,
  allowed: string[]
): string[] {
  if (!body || typeof body !== 'object') return [];
  return Object.keys(body as object).filter((key) => !allowed.includes(key));
}

// ─── Audit Logging ───────────────────────────────────────────────────────────
// Writes a lightweight audit log for sensitive mutations (best-effort).
export async function logAuditEvent(
  req: NextApiRequest,
  action: string,
  details: {
    entity_type?: string;
    entity_id?: string | null;
    actor_id?: string | null;
    actor_email?: string | null;
    actor_role?: string | null;
    meta?: Record<string, any>;
  } = {}
) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return;
    const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
    const ip = getClientIp(req);
    const ua = (req.headers['user-agent'] as string) || '';
    await sb.from('audit_logs').insert({
      action,
      entity_type: details.entity_type || null,
      entity_id: details.entity_id || null,
      actor_id: details.actor_id || null,
      actor_email: details.actor_email || null,
      actor_role: details.actor_role || null,
      ip,
      user_agent: ua.slice(0, 512),
      meta: details.meta || null,
    });
  } catch {
    // Never block the request on audit logging failures.
  }
}
