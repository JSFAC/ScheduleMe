// lib/rateLimit.ts — simple in-memory rate limiter
// For production, replace with Redis (Upstash is free + works on Vercel)

const requests = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  ip: string,
  maxRequests = 10,
  windowMs = 60_000 // 1 minute
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = requests.get(ip);

  if (!entry || now > entry.resetAt) {
    requests.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}

// Clean up old entries every 5 minutes to prevent memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of requests.entries()) {
      if (now > val.resetAt) requests.delete(key);
    }
  }, 5 * 60_000);
}
