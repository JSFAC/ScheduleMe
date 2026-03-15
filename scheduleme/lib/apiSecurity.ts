// lib/apiSecurity.ts — shared security utilities for all API routes
// OWASP-aligned: rate limiting, auth verification, input validation, security headers

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

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
export function rateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  opts: { max: number; windowMs: number; keyPrefix?: string }
): boolean {
  const ip = getClientIp(req);
  const key = `${opts.keyPrefix ?? 'rl'}:${ip}`;
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
