import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function parseAllowedOrigins(): string[] {
  const raw = process.env.CORS_ALLOWLIST || process.env.NEXT_PUBLIC_SITE_URL || '';
  return raw
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
    .map(v => (v.endsWith('/') ? v.slice(0, -1) : v));
}

function normalizeHost(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    return url.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return value.replace(/^www\./i, '').toLowerCase();
  }
}

function isOriginAllowed(origin: string | null, allowlist: string[], host: string | null): boolean {
  if (!origin) return true; // non-browser clients
  const normalized = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  if (allowlist.includes(normalized)) return true;
  const originHost = normalizeHost(origin);
  const reqHost = normalizeHost(host);
  if (originHost && reqHost && originHost === reqHost) return true;
  return false;
}

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();

  const allowlist = parseAllowedOrigins();
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');

  if (allowlist.length > 0 && !isOriginAllowed(origin, allowlist, host)) {
    return new NextResponse(JSON.stringify({ error: 'CORS origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const corsHeaders: Record<string, string> = {};
  if (origin && (allowlist.length === 0 || isOriginAllowed(origin, allowlist, host))) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
    corsHeaders['Access-Control-Allow-Credentials'] = 'true';
    corsHeaders['Access-Control-Allow-Methods'] = 'GET,POST,PATCH,PUT,DELETE,OPTIONS';
    corsHeaders['Access-Control-Allow-Headers'] = 'Authorization, Content-Type, X-Requested-With, X-Notify-Secret';
    corsHeaders['Vary'] = 'Origin';
  }

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  const res = NextResponse.next();
  Object.entries(corsHeaders).forEach(([key, value]) => res.headers.set(key, value));
  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
