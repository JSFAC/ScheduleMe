// @ts-nocheck
// lib/apiSecurity.ts — shared security utilities for all API routes
// OWASP-aligned: rate limiting, auth verification, input validation, security headers

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { sendWelcomeEmail } from './email';

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
// In-memory fallback store.
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

async function checkRateLimitUpstash(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number } | null> {
  const baseURL = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!baseURL || !token) return null;

  const now = Date.now();
  const fallbackResetAt = now + windowMs;
  const encodedKey = encodeURIComponent(key);
  const authHeaders = { Authorization: `Bearer ${token}` };

  try {
    const incrRes = await fetch(`${baseURL}/incr/${encodedKey}`, { headers: authHeaders });
    if (!incrRes.ok) return null;
    const incrPayload = await incrRes.json();
    const count = Number(incrPayload?.result ?? 0);
    if (!Number.isFinite(count) || count <= 0) return null;

    if (count === 1) {
      // First hit in window sets TTL.
      await fetch(`${baseURL}/expire/${encodedKey}/${Math.max(1, Math.ceil(windowMs / 1000))}`, {
        headers: authHeaders,
      });
    }

    let resetAt = fallbackResetAt;
    try {
      const ttlRes = await fetch(`${baseURL}/pttl/${encodedKey}`, { headers: authHeaders });
      if (ttlRes.ok) {
        const ttlPayload = await ttlRes.json();
        const ttlMs = Number(ttlPayload?.result ?? -1);
        if (Number.isFinite(ttlMs) && ttlMs > 0) {
          resetAt = now + ttlMs;
        }
      }
    } catch {
      // keep fallback resetAt
    }

    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetAt,
    };
  } catch {
    return null;
  }
}

export function getClientIp(req: NextApiRequest): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

// Rate limit helper that sends the 429 response automatically
export async function rateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  opts: { max: number; windowMs: number; keyPrefix?: string }
): Promise<boolean> {
  const ip = getClientIp(req);
  const key = `${opts.keyPrefix ?? 'rl'}:${ip}`;
  const result =
    (await checkRateLimitUpstash(key, opts.max, opts.windowMs)) ??
    checkRateLimit(key, opts.max, opts.windowMs);

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

// Per-user/principal rate limit helper for authenticated routes.
export async function rateLimitByPrincipal(
  res: NextApiResponse,
  principal: string,
  opts: { max: number; windowMs: number; keyPrefix?: string }
): Promise<boolean> {
  const normalizedPrincipal = principal?.trim() || 'unknown';
  const key = `${opts.keyPrefix ?? 'rl-user'}:${normalizedPrincipal}`;
  const result =
    (await checkRateLimitUpstash(key, opts.max, opts.windowMs)) ??
    checkRateLimit(key, opts.max, opts.windowMs);

  res.setHeader('X-User-RateLimit-Limit', String(opts.max));
  res.setHeader('X-User-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-User-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

  if (!result.allowed) {
    res.status(429).json({
      error: 'Too many requests for this account. Please try again shortly.',
    });
    return false;
  }
  return true;
}

// ─── Auth Verification ────────────────────────────────────────────────────────
// Verifies the Bearer token and returns the authenticated user
// Returns null and sends 401 if invalid
const welcomeEmailInFlight = new Set<string>();

async function maybeSendFirstLoginWelcome(user: any) {
  const userId = user?.id;
  const email = (user?.email || '').toString().trim().toLowerCase();
  if (!userId || !email) return;
  if (welcomeEmailInFlight.has(userId)) return;
  if (!process.env.RESEND_API_KEY) return;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  welcomeEmailInFlight.add(userId);
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: profile } = await admin
      .from('profiles')
      .select('has_seen_welcome, name, role')
      .eq('id', userId)
      .maybeSingle();

    // Provider/business accounts follow a separate onboarding and should not get consumer welcome.
    if ((profile as any)?.role === 'business') return;
    if ((profile as any)?.has_seen_welcome === true) return;

    const derivedName =
      (profile as any)?.name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      email.split('@')[0] ||
      'there';

    await sendWelcomeEmail({ to: email, name: derivedName });

    await admin
      .from('profiles')
      .upsert(
        {
          id: userId,
          email,
          name: derivedName,
          has_seen_welcome: true,
        },
        { onConflict: 'id', ignoreDuplicates: false }
      );
  } catch (err) {
    console.error('[welcome-email][requireAuth]', err);
  } finally {
    welcomeEmailInFlight.delete(userId);
  }
}

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
    const supabaseURL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const verifyKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseURL || !verifyKey) {
      console.error('[requireAuth] Missing Supabase auth env vars', {
        hasURL: !!supabaseURL,
        hasAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      });
      res.status(500).json({ error: 'Server auth configuration is missing.' });
      return null;
    }

    const supabase = createClient(
      supabaseURL,
      verifyKey
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
      return null;
    }

    // Fire-and-forget first-login welcome email for consumer accounts.
    // This makes welcome delivery independent of any specific page (web/mobile parity).
    void maybeSendFirstLoginWelcome(user);

    return { id: user.id, email: user.email ?? '' };
  } catch {
    res.status(401).json({ error: 'Authentication failed.' });
    return null;
  }
}

// ─── Admin Verification ──────────────────────────────────────────────────────
// Verifies Bearer token belongs to an allowed admin user.
// Admin is determined by:
// 1) ADMIN_EMAIL_ALLOWLIST env (comma-separated), OR
// 2) profiles.role = 'admin'
export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<{ id: string; email: string } | null> {
  const user = await requireAuth(req, res);
  if (!user) return null;

  const email = (user.email || '').toLowerCase().trim();
  const allowlist = (process.env.ADMIN_EMAIL_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (email && allowlist.includes(email)) {
    return user;
  }

  // Fallback: explicit admin role in profiles
  try {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if ((profile as any)?.role === 'admin') return user;
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

// Return keys present in body but not in allowed list.
export function getUnknownFields(body: unknown, allowed: string[]): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  const allowedSet = new Set((allowed || []).map((k) => String(k)));
  return Object.keys(body as Record<string, unknown>).filter((k) => !allowedSet.has(k));
}

// Best-effort audit logger. Never throws into request handlers.
export async function logAuditEvent(
  req: NextApiRequest,
  action: string,
  details: {
    entity_type?: string | null;
    entity_id?: string | null;
    actor_id?: string | null;
    actor_email?: string | null;
    actor_role?: string | null;
    meta?: Record<string, unknown> | null;
  } = {}
): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || !action) return;

    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const ip = getClientIp(req);
    const ua = String(req.headers['user-agent'] || '');

    await supabase.from('audit_logs').insert({
      action,
      entity_type: details.entity_type || null,
      entity_id: details.entity_id || null,
      actor_id: details.actor_id || null,
      actor_email: details.actor_email || null,
      actor_role: details.actor_role || null,
      ip,
      user_agent: ua || null,
      meta: details.meta || null,
    });
  } catch (err) {
    console.error('[audit] failed to write audit event', err);
  }
}
