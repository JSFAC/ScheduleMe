// lib/profanity.ts — shared profanity filter with censoring
// Used on: messages, business signup, bookings

// ─── Word list with flexible regex matching ──────────────────────────────────
// Each pattern uses character substitution tolerance (1=i, 0=o, 3=e, @=a, $=s, etc.)
// and optional repeated letters to catch common evasions

const SLUR_PATTERNS: RegExp[] = [
  // Racial slurs
  /\bn[i1!|][g9q]+[e3]r+[s$]?\b/i,            // n*gger + niggger + variants
  /\bn[i1!|][g9q]+[ae3@]+[s$]?\b/i,             // n*gga + nigga + niggaa etc
  /\bn[i1!|][g9q]+\b/i,                          // nig, nigg, niga etc
  /\bg[o0][o0]k[s$]?\b/i,                        // g**k
  /\bch[i1][nñ][k]s?\b/i,                       // ch*nk
  /\bch[i1]n[kc]s?\b/i,
  /\bzip+er\s*head\b/i,                          // zipperhead
  /\bsl[a@]nt\s*ey[e3]s?\b/i,                   // slanteye
  /\bwet\s*back[s$]?\b/i,                        // wetback
  /\bsp[i1][ck]s?\b/i,                           // sp*c
  /\bk[i1]k[e3]s?\b/i,                           // k*ke
  /\bf[a@4][g9][g9]?[o0]?t[s$]?\b/i,            // f*ggot
  /\bf[a@4][g9]{1,3}s?\b/i,                      // f*gs
  /\bcr[a@4]ck[e3]r[s$]?\b/i,                   // cracker (racial)
  /\bs[a@4]nd\s*n[i1][g9]+[e3]r[s$]?\b/i,       // sand n*gger
  /\bwh[o0]r[e3][s$]?\b/i,                       // wh*re
  /\bc[u*][nñ][t+][s$]?\b/i,                     // c*nt
  /\br[e3]t[a@4]rd[s$]?\b/i,                     // ret*rd
  /\bs[p][a@4][s$][t+][i1]c\b/i,                // sp*stic
  
  // Threats / harassment
  /\bk[i1y]\s*y[o0]?[u*]?r?s[e3]?l[f]?\b/i,    // kys / kill yourself
  /\bk[i1]ll\s+y[o0]ur\s*s[e3]lf\b/i,
  /\bg[o0]\s+d[i1][e3]\b/i,                      // go die
  /\bi\s*(will|am going to|'?ll)\s+kill\b/i,
  /\bi\s*w[i1]ll\s+h[u*]rt\b/i,
  
  // Severe profanity
  /\bf[u*][ck][k]?\s+y[o0][u*]\b/i,             // f*ck you
  /\bsh[u*][t+]\s+[t+]?h[e3]\s+f[u*]ck\b/i,    // shut the f*ck
  /\bm[o0]th[e3]r\s*f[u*]ck[e3]r[s$]?\b/i,     // motherf*cker
];

// Words to censor inline (replace with ***)
const CENSOR_WORDS: Array<[RegExp, string]> = [
  [/\bn[i1!|][g9q]+[e3]r+[s$]?\b/gi, '***'],
  [/\bn[i1!|][g9q]+[ae3@]+[s$]?\b/gi, '***'],
  [/\bn[i1!|][g9q]+\b/gi, '***'],
  [/\bg[o0]{1,2}k[s$]?\b/gi, '***'],
  [/\bch[i1][nñ]ks?\b/gi, '***'],
  [/\bzip+er\s*head\b/gi, '***'],
  [/\bwet\s*back[s$]?\b/gi, '***'],
  [/\bsp[i1][ck]s?\b/gi, '***'],
  [/\bk[i1]k[e3]s?\b/gi, '***'],
  [/\bf[a@4][g9][g9]?[o0]?t[s$]?\b/gi, '***'],
  [/\bwh[o0]r[e3][s$]?\b/gi, '***'],
  [/\bc[u*][nñ][t+][s$]?\b/gi, '***'],
  [/\br[e3]t[a@4]rd[s$]?\b/gi, '***'],
  [/\bf[u*]ck(ing|er|ers|ed)?\b/gi, 'f***'],
  [/\bsh[i1]t(ty|ter|s)?\b/gi, 's***'],
  [/\bass\s*hole[s$]?\b/gi, 'a***hole'],
  [/\bb[i1]tch(es|y)?\b/gi, 'b***'],
  [/\bd[i1]ck[s$]?\b/gi, 'd***'],
];

// ─── Threat patterns — these block entirely (no censor) ─────────────────────
const THREAT_PATTERNS: RegExp[] = [
  /\bk[i1y]\s*y[o0]?[u*]?r?s[e3]?l[f]?\b/i,
  /\bk[i1]ll\s+y[o0]ur\s*s[e3]lf\b/i,
  /\bg[o0]\s+d[i1][e3]\b/i,
  /\bi\s*(will|am going to|'?ll)\s+kill\b/i,
];

export function containsThreat(text: string): boolean {
  return THREAT_PATTERNS.some(p => p.test(text));
}

export function containsProfanity(text: string): boolean {
  return SLUR_PATTERNS.some(p => p.test(text));
}

// Censors bad words in-place, returns cleaned text
export function censorText(text: string): string {
  let result = text;
  for (const [pattern, replacement] of CENSOR_WORDS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function sanitizeText(text: string): string {
  return text.trim().slice(0, 5000);
}

// For messages: censor inline rather than block (unless it's a threat)
export function filterMessage(content: string): { ok: boolean; filtered: string; error?: string } {
  const trimmed = content.trim();
  if (!trimmed) return { ok: false, filtered: '', error: 'Message cannot be empty' };
  if (trimmed.length > 2000) return { ok: false, filtered: '', error: 'Message too long (max 2000 chars)' };
  
  // Threats block entirely
  if (containsThreat(trimmed)) {
    return { ok: false, filtered: '', error: 'Message contains threatening content and cannot be sent.' };
  }
  
  // Slurs/profanity get censored
  const filtered = censorText(trimmed);
  return { ok: true, filtered };
}

// For signup fields: block entirely if profanity found
export function validateAndFilter(
  text: string,
  opts: { maxLength?: number; fieldName?: string } = {}
): { ok: true; value: string } | { ok: false; error: string } {
  const max = opts.maxLength ?? 500;
  const field = opts.fieldName ?? 'Input';
  const trimmed = text?.trim() ?? '';

  if (!trimmed) return { ok: false, error: `${field} is required` };
  if (trimmed.length > max) return { ok: false, error: `${field} is too long (max ${max} characters)` };
  if (containsProfanity(trimmed) || containsThreat(trimmed)) {
    return { ok: false, error: `${field} contains prohibited content` };
  }

  return { ok: true, value: trimmed };
}
