// lib/profanity.ts — shared profanity/content filter
// Used on: messages, business signup (name/description), bookings (service field)

const BLOCKED_PATTERNS = [
  // Slurs
  /\bn[i1][g9][g9][ae3]r?\b/i,
  /\bni[g9]{2}[ae3]?\b/i,
  /\bf[a@]g{1,2}[o0]t\b/i,
  /\bretard\b/i,
  /\bch[i1]nk\b/i,
  /\bsp[i1]c\b/i,
  /\bk[i1]ke\b/i,
  /\bc[u*]nt\b/i,
  /\bwetback\b/i,
  /\bwh[o0]re\b/i,
  // Threats
  /\bkill\s+your?self\b/i,
  /\bkys\b/i,
  /\bgo\s+die\b/i,
  /\bi('ll|m going to|will)\s+kill\b/i,
  /\bfuck\s+you\b/i,
  /\bshut\s+the\s+fuck\b/i,
];

export function containsProfanity(text: string): boolean {
  return BLOCKED_PATTERNS.some(p => p.test(text));
}

export function sanitizeText(text: string): string {
  return text.trim().slice(0, 5000);
}

export function validateAndFilter(
  text: string,
  opts: { maxLength?: number; fieldName?: string } = {}
): { ok: true; value: string } | { ok: false; error: string } {
  const max = opts.maxLength ?? 500;
  const field = opts.fieldName ?? 'Input';
  const trimmed = text?.trim() ?? '';

  if (!trimmed) return { ok: false, error: `${field} is required` };
  if (trimmed.length > max) return { ok: false, error: `${field} is too long (max ${max} characters)` };
  if (containsProfanity(trimmed)) return { ok: false, error: `${field} contains prohibited content` };

  return { ok: true, value: trimmed };
}
