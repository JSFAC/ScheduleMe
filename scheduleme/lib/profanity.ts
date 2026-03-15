// lib/profanity.ts — comprehensive profanity/slur filter
// Patterns use character substitution tolerance for common evasions

// ─── Slur patterns (block on signup fields, censor in messages) ──────────────
const SLUR_PATTERNS: RegExp[] = [
  // Anti-Black
  /\bn[i1!|][g9q]+[e3]r+[s$z]?\b/i,
  /\bn[i1!|][g9q]+[ae3@]+[s$z]?\b/i,
  /\bn[i1!|][g9q]+\b/i,
  /\bc[o0][o0]n[s$z]?\b/i,
  /\bj[i1][g9][a@4]b[o0][o0]\b/i,
  /\bs[a@4]mb[o0]\b/i,
  /\bp[i1]ckan[i1]nn[y]?\b/i,
  /\bz[i1][p]+[e3]r\s*h[e3][a@4]d\b/i,        // zipperhead
  /\bz[o0][o0]\s*z[o0][o0]\b/i,
  /\bb[o0][o0][g9]\b/i,
  /\bporch\s*m[o0]nk[e3]y\b/i,
  /\bjungl[e3]\s*bunn[y]\b/i,
  /\bmul[e3]\b/i,                               // racial
  /\bc[o0]tt[o0]n\s*pick[e3]r\b/i,

  // Anti-Hispanic/Latino
  /\bsp[i1][ck]+[s$z]?\b/i,
  /\bw[e3][t+]\s*b[a@4]ck[s$z]?\b/i,
  /\bb[e3][a@4]n[e3]r[s$z]?\b/i,
  /\bm[e3][x$][i1]c[a@4]n\s*tr[a@4]sh\b/i,
  /\bgreaser[s$z]?\b/i,

  // Anti-Asian
  /\bg[o0]+k[s$z]?\b/i,
  /\bch[i1][nñ][k]+[s$z]?\b/i,
  /\bsl[a@4]nt\s*[e3]y[e3][s$z]?\b/i,
  /\bch[i1]nk[s$z]?\b/i,
  /\bj[a@4]p[s$z]?\b/i,                        // slur for Japanese
  /\bf[i1][l1][i1]p[i1]n[o0]\b/i,              // slur variant
  /\bf[o0]b\b/i,                               // fresh off the boat
  /\bch[i1]nk\b/i,
  /\bch[i1]nc[ks]\b/i,
  /\byz[i1][e3][l1]\b/i,

  // Anti-Jewish
  /\bk[i1!][k][e3][s$z]?\b/i,
  /\bh[e3][e3]b[s$z]?\b/i,
  /\bj[e3]w\s*f[a@4]g\b/i,
  /\bsh[y]l[o0]ck\b/i,
  /\bj[e3]w[e3]d\b/i,

  // Anti-Arab/Middle Eastern
  /\bs[a@4]nd\s*n[i1][g9]+[e3]r[s$z]?\b/i,
  /\bt[o0]w[e3]l?\s*h[e3][a@4]d[s$z]?\b/i,
  /\bc[a@4]m[e3]l\s*j[o0]ck[e3]y\b/i,
  /\br[a@4]gh[e3][a@4]d\b/i,

  // Anti-Native American
  /\br[e3]ds?k[i1]n[s$z]?\b/i,
  /\bs[qu]+[a@4]w[s$z]?\b/i,
  /\bbuck\s*wh[e3][a@4]t\b/i,

  // Anti-White (included for consistency)
  /\bwh[i1][t+][e3]\s*tr[a@4]sh\b/i,
  /\bh[o0]nk[i1][e3]y[s$z]?\b/i,
  /\bcr[a@4]ck[e3]r[s$z]?\b/i,
  /\br[e3]dn[e3]ck[s$z]?\b/i,

  // Anti-LGBTQ+
  /\bf[a@4][g9][g9]?[o0]?t[s$z]?\b/i,
  /\bf[a@4][g9]{1,3}[s$z]?\b/i,
  /\bd[y][k]+[e3][s$z]?\b/i,
  /\btr[a@4]nn[y][s$z]?\b/i,
  /\bsh[e3][m][a@4]l[e3]\b/i,
  /\bh[o0]m[o0]\s*f[a@4][g9]\b/i,
  /\bp[o0][o0]ft[e3]r[s$z]?\b/i,

  // Disability slurs
  /\br[e3]t[a@4]rd[s$z]?\b/i,
  /\br[e3]t[a@4]rd[e3]d\b/i,
  /\bs[p][a@4][s$][t+][i1]c\b/i,
  /\bm[o0]ng[o0]l[o0][i1]d\b/i,
  /\bcr[i1]ppl[e3][s$z]?\b/i,                  // as a slur

  // Religious slurs
  /\bh[a@4][j][i1][s$z]?\b/i,
  /\bpapr[i1]st[s$z]?\b/i,
  /\bpap[i1]st[s$z]?\b/i,

  // Severe profanity
  /\bf[u*][ck][k]?\s*[yu][o0]?[u*]?\b/i,
  /\bm[o0]th[e3]r\s*f[u*][ck][e3]r[s$z]?\b/i,
  /\bc[u*][nñ][t+][s$z]?\b/i,
  /\bwh[o0]r[e3][s$z]?\b/i,
  /\bs[l1][u*][t+][s$z]?\b/i,
];

// ─── Threats — block entirely ─────────────────────────────────────────────────
const THREAT_PATTERNS: RegExp[] = [
  /\bk[i1]ll\s+y[o0]ur\s*s[e3]lf\b/i,
  /\bkys\b/i,
  /\bg[o0]\s+d[i1][e3]\b/i,
  /\bi\s*(will|am going to|'?ll)\s+kill\b/i,
  /\bi\s*w[i1]ll\s+(hurt|harm|shoot|stab|attack)\b/i,
  /\byou\s*(are|r)\s*dead\b/i,
  /\bwatch\s*your\s*back\b/i,
];

// ─── Censor map — inline replacement for messages ────────────────────────────
const CENSOR_MAP: Array<[RegExp, string]> = [
  // n-word variants
  [/\bn[i1!|][g9q]+[e3]r+[s$z]?\b/gi, '***'],
  [/\bn[i1!|][g9q]+[ae3@]+[s$z]?\b/gi, '***'],
  [/\bn[i1!|][g9q]+\b/gi, '***'],
  [/\bc[o0][o0]n[s$z]?\b/gi, '***'],
  [/\bg[o0]+k[s$z]?\b/gi, '***'],
  [/\bch[i1][nñ][k]+[s$z]?\b/gi, '***'],
  [/\bch[i1]nc[ks]\b/gi, '***'],
  [/\bsp[i1][ck]+[s$z]?\b/gi, '***'],
  [/\bk[i1!][k][e3][s$z]?\b/gi, '***'],
  [/\br[e3]ds?k[i1]n[s$z]?\b/gi, '***'],
  [/\bf[a@4][g9][g9]?[o0]?t[s$z]?\b/gi, '***'],
  [/\bf[a@4][g9]{1,3}[s$z]?\b/gi, '***'],
  [/\btr[a@4]nn[y][s$z]?\b/gi, '***'],
  [/\br[e3]t[a@4]rd(ed)?\b/gi, '***'],
  [/\bc[u*][nñ][t+][s$z]?\b/gi, '***'],
  [/\bwh[o0]r[e3][s$z]?\b/gi, '***'],
  [/\bs[l1][u*][t+][s$z]?\b/gi, '***'],
  [/\bt[o0]w[e3]l?\s*h[e3][a@4]d[s$z]?\b/gi, '***'],
  [/\bwetback[s$z]?\b/gi, '***'],
  [/\bzipperhead\b/gi, '***'],
  [/\bz[i1][p]+[e3]r\s*h[e3][a@4]d\b/gi, '***'],
  [/\bj[a@4]p[s$z]?\b/gi, '***'],
  [/\bs[a@4]nd\s*n[i1][g9]+[e3]r[s$z]?\b/gi, '***'],
  // Profanity (softer censor)
  [/\bf[u*]ck(ing|er|s|ed|face|wit)?\b/gi, 'f***'],
  [/\bsh[i1]t(ty|ter|s|head|face)?\b/gi, 's***'],
  [/\bass\s*hole[s$z]?\b/gi, 'a**hole'],
  [/\bb[i1]tch(es|y|ass)?\b/gi, 'b****'],
  [/\bd[i1]ck[s$z]?\b/gi, 'd***'],
  [/\bm[o0]th[e3]r\s*f[u*][ck][e3]r[s$z]?\b/gi, 'mf***'],
];

export function containsThreat(text: string): boolean {
  return THREAT_PATTERNS.some(p => p.test(text));
}

export function containsProfanity(text: string): boolean {
  return SLUR_PATTERNS.some(p => p.test(text));
}

export function censorText(text: string): string {
  let result = text;
  for (const [pattern, replacement] of CENSOR_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function sanitizeText(text: string): string {
  return text.trim().slice(0, 5000);
}

// Messages: censor inline, only block threats
export function filterMessage(content: string): { ok: boolean; filtered: string; error?: string } {
  const trimmed = content.trim();
  if (!trimmed) return { ok: false, filtered: '', error: 'Message cannot be empty' };
  if (trimmed.length > 2000) return { ok: false, filtered: '', error: 'Message too long (max 2000 chars)' };
  if (containsThreat(trimmed)) return { ok: false, filtered: '', error: 'Message contains threatening content and cannot be sent.' };
  return { ok: true, filtered: censorText(trimmed) };
}

// Signup fields: block entirely
export function validateAndFilter(
  text: string,
  opts: { maxLength?: number; fieldName?: string } = {}
): { ok: true; value: string } | { ok: false; error: string } {
  const max = opts.maxLength ?? 500;
  const field = opts.fieldName ?? 'Input';
  const trimmed = text?.trim() ?? '';
  if (!trimmed) return { ok: false, error: `${field} is required` };
  if (trimmed.length > max) return { ok: false, error: `${field} is too long (max ${max} characters)` };
  if (containsProfanity(trimmed) || containsThreat(trimmed)) return { ok: false, error: `${field} contains prohibited content` };
  return { ok: true, value: trimmed };
}
