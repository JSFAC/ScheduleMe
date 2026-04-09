// lib/paymentAccess.ts
// One-time client-side payment page access tickets.

const KEY = 'sm_payment_access_ticket_v1';
const TTL_MS = 10 * 60 * 1000; // 10 minutes

type Ticket = {
  bookingId: string;
  issuedAt: number;
};

function readTicket(): Ticket | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.bookingId !== 'string' || typeof parsed.issuedAt !== 'number') return null;
    return parsed as Ticket;
  } catch {
    return null;
  }
}

export function issuePaymentAccessTicket(bookingId: string) {
  if (typeof window === 'undefined' || !bookingId) return;
  const payload: Ticket = { bookingId, issuedAt: Date.now() };
  sessionStorage.setItem(KEY, JSON.stringify(payload));
}

export function consumePaymentAccessTicket(bookingId: string): boolean {
  if (typeof window === 'undefined' || !bookingId) return false;
  const t = readTicket();
  sessionStorage.removeItem(KEY);
  if (!t) return false;
  if (t.bookingId !== bookingId) return false;
  if (Date.now() - t.issuedAt > TTL_MS) return false;
  return true;
}
