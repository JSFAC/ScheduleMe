// lib/safeRedirect.ts — sanitize user-provided redirect targets
export function safeRedirect(target: unknown, fallback: string, origin?: string): string {
  if (typeof target !== 'string' || !target.trim()) return fallback;
  const trimmed = target.trim();
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://usescheduleme.com');
  try {
    const url = new URL(trimmed, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
