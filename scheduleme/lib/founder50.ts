type Founder50State = 'active' | 'paused' | 'revoked';

type Founder50Business = {
  founder50?: boolean | null;
  founder50_status?: Founder50State | string | null;
  last_completed_booking_at?: string | null;
  away_start?: string | null;
  away_end?: string | null;
  availability_status?: string | null;
  break_until?: string | null;
};

const INACTIVITY_DAYS = 30;

function parseIso(value?: string | null): Date | null {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function isAwayWindow(business?: Founder50Business | null, now = new Date()): boolean {
  if (!business) return false;
  const start = parseIso(business.away_start);
  const end = parseIso(business.away_end);
  if (start && end) {
    return now.getTime() >= start.getTime() && now.getTime() <= end.getTime();
  }
  if (business.availability_status === 'break') {
    const breakUntil = parseIso(business.break_until);
    if (breakUntil && breakUntil.getTime() > now.getTime()) return true;
  }
  return false;
}

export function computeFounder50Status(business?: Founder50Business | null, now = new Date()): Founder50State | null {
  if (!business?.founder50) return null;
  if (business.founder50_status === 'revoked') return 'revoked';
  if (isAwayWindow(business, now)) return 'active';
  const last = parseIso(business.last_completed_booking_at);
  if (!last) return 'paused';
  const diffMs = now.getTime() - last.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > INACTIVITY_DAYS ? 'paused' : 'active';
}

export function isFounder50Active(business?: Founder50Business | null, now = new Date()): boolean {
  if (!business?.founder50) return false;
  const status = computeFounder50Status(business, now) || 'active';
  return status === 'active';
}

export function getFounder50InactivityDays(): number {
  return INACTIVITY_DAYS;
}
