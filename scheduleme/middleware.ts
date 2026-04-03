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

function isOriginAllowed(origin: string | null, allowlist: string[]): boolean {
  if (!origin) return true; // non-browser clients
  const normalized = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  return allowlist.includes(normalized);
}

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();

  const allowlist = parseAllowedOrigins();
  const origin = req.headers.get('origin');

  if (allowlist.length > 0 && !isOriginAllowed(origin, allowlist)) {
    return new NextResponse(JSON.stringify({ error: 'CORS origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const corsHeaders: Record<string, string> = {};
  if (origin && (allowlist.length === 0 || isOriginAllowed(origin, allowlist))) {
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
