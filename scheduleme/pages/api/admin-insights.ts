import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAdmin } from '../../lib/apiSecurity';
import { getPlatformFeePercent } from '../../lib/platformFees';

type BookingRow = {
  id: string;
  user_id: string | null;
  business_id: string | null;
  service: string | null;
  amount_cents: number | null;
  protection_fee_cents: number | null;
  paid_at: string | null;
  status: string | null;
  businesses?: {
    id?: string | null;
    name?: string | null;
    service_tags?: string[] | null;
    founder50?: boolean | null;
    founder50_status?: string | null;
  } | null;
};

function startOfUtcDay(input = new Date()) {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

function startOfUtcMonth(input = new Date()) {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), 1));
}

function addUtcDays(input: Date, days: number) {
  const next = new Date(input.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addUtcMonths(input: Date, months: number) {
  const next = new Date(input.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function lower(value: string | null | undefined) {
  return String(value || '').toLowerCase();
}

function isHaircutBooking(booking: BookingRow) {
  const tags = Array.isArray(booking.businesses?.service_tags)
    ? booking.businesses?.service_tags || []
    : [];
  const haystack = [...tags, booking.service || '', booking.businesses?.name || '']
    .map((part) => lower(part))
    .join(' | ');
  return [
    'hair',
    'haircut',
    'barber',
    'barbershop',
    'salon',
    'beauty',
    'fade',
    'lineup',
  ].some((needle) => haystack.includes(needle));
}

function centsToDollars(cents: number) {
  return Math.round(cents) / 100;
}

function pct(value: number, total: number) {
  if (!total) return 0;
  return Number(((value / total) * 100).toFixed(1));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'admin' }))) return;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );

  const now = new Date();
  const sevenDaysAgo = addUtcDays(startOfUtcDay(now), -7).toISOString();
  const monthStart = startOfUtcMonth(now).toISOString();
  const prevMonthStartDate = addUtcMonths(startOfUtcMonth(now), -1);
  const prevMonthStart = prevMonthStartDate.toISOString();
  const nextMonthStart = addUtcMonths(startOfUtcMonth(now), 1).toISOString();

  const { data, error } = await supabase
    .from('bookings')
    .select('id, user_id, business_id, service, amount_cents, protection_fee_cents, paid_at, status, businesses(id, name, service_tags, founder50, founder50_status)')
    .not('paid_at', 'is', null)
    .order('paid_at', { ascending: true });

  if (error) return res.status(500).json({ error: 'Failed to load booking insights' });

  const paidBookings = ((data || []) as BookingRow[]).filter((booking) => booking.paid_at && Number(booking.amount_cents || 0) > 0);
  const haircutBookings = paidBookings.filter(isHaircutBooking);

  const weeklyHaircutBookings = haircutBookings.filter((booking) => String(booking.paid_at) >= sevenDaysAgo).length;
  const monthlyHaircutGmvCents = haircutBookings
    .filter((booking) => {
      const paidAt = String(booking.paid_at || '');
      return paidAt >= monthStart && paidAt < nextMonthStart;
    })
    .reduce((sum, booking) => sum + Number(booking.amount_cents || 0), 0);

  const activeBarbersThisWeek = new Set(
    haircutBookings
      .filter((booking) => String(booking.paid_at) >= sevenDaysAgo)
      .map((booking) => booking.business_id)
      .filter(Boolean)
  ).size;

  const paidByUser = new Map<string, BookingRow[]>();
  paidBookings.forEach((booking) => {
    const userId = String(booking.user_id || '').trim();
    if (!userId) return;
    const existing = paidByUser.get(userId) || [];
    existing.push(booking);
    paidByUser.set(userId, existing);
  });

  function repeatRateWithin(days: number) {
    const eligibleUsers: string[] = [];
    let repeated = 0;
    paidByUser.forEach((bookings, userId) => {
      const ordered = [...bookings].sort((a, b) => new Date(String(a.paid_at)).getTime() - new Date(String(b.paid_at)).getTime());
      const first = ordered[0];
      if (!first?.paid_at) return;
      const firstAt = new Date(first.paid_at);
      if (firstAt.getTime() > addUtcDays(now, -days).getTime()) return;
      eligibleUsers.push(userId);
      const deadline = addUtcDays(firstAt, days).getTime();
      const hasRepeat = ordered.slice(1).some((booking) => {
        const paidAt = new Date(String(booking.paid_at || '')).getTime();
        return paidAt <= deadline;
      });
      if (hasRepeat) repeated += 1;
    });
    return {
      percent: pct(repeated, eligibleUsers.length),
      repeated,
      eligible: eligibleUsers.length,
    };
  }

  const repeat30 = repeatRateWithin(30);
  const repeat60 = repeatRateWithin(60);
  const repeat90 = repeatRateWithin(90);

  const activeThisMonth = new Set<string>();
  const activePrevMonth = new Set<string>();
  paidBookings.forEach((booking) => {
    const businessId = String(booking.business_id || '').trim();
    if (!businessId || !booking.paid_at) return;
    const paidAt = String(booking.paid_at);
    if (paidAt >= monthStart && paidAt < nextMonthStart) activeThisMonth.add(businessId);
    if (paidAt >= prevMonthStart && paidAt < monthStart) activePrevMonth.add(businessId);
  });
  let retainedFromLastMonth = 0;
  activePrevMonth.forEach((businessId) => {
    if (activeThisMonth.has(businessId)) retainedFromLastMonth += 1;
  });

  let takeRateNumerator = 0;
  let takeRateDenominator = 0;
  let contributionMarginTotal = 0;
  paidBookings.forEach((booking) => {
    const serviceAmount = Number(booking.amount_cents || 0);
    const protectionFee = Math.max(0, Number(booking.protection_fee_cents || 0));
    const platformFee = Math.round(serviceAmount * getPlatformFeePercent(booking.businesses || null) / 100);
    const gross = serviceAmount + protectionFee;
    const revenue = platformFee + protectionFee;
    takeRateNumerator += revenue;
    takeRateDenominator += gross;
    contributionMarginTotal += revenue;
  });

  return res.status(200).json({
    insight: {
      headline: {
        weeklyHaircutBookings,
        monthlyHaircutGmvCents,
        activeBarbersThisWeek,
        averageTakeRatePct: pct(takeRateNumerator, takeRateDenominator),
        averageContributionMarginCents: paidBookings.length ? Math.round(contributionMarginTotal / paidBookings.length) : 0,
      },
      repeat: {
        within30dPct: repeat30.percent,
        within60dPct: repeat60.percent,
        within90dPct: repeat90.percent,
        cohorts: {
          within30d: repeat30.eligible,
          within60d: repeat60.eligible,
          within90d: repeat90.eligible,
        },
      },
      retention: {
        activeProvidersThisMonth: activeThisMonth.size,
        activeProvidersLastMonth: activePrevMonth.size,
        retainedFromLastMonth,
        providerRetentionMoMPct: pct(retainedFromLastMonth, activePrevMonth.size),
      },
      trackingGaps: [
        {
          key: 'organic_referral_share',
          label: 'Organic vs referral bookings',
          available: false,
          note: 'Bookings do not yet store acquisition source. Add a first-touch / booking_source field or an attribution events table to measure this cleanly.',
        },
        {
          key: 'browse_to_booking_median',
          label: 'Median time from browse to booking',
          available: false,
          note: 'You need browse / provider-view / request-start timestamps before checkout to calculate this. Stripe alone will not provide it.',
        },
      ],
      notes: {
        haircutDefinition: 'Haircut metrics currently include providers or services tagged with hair, haircut, barber, barbershop, salon, beauty, fade, or lineup.',
        contributionMargin: `Contribution margin per booking is currently a proxy for platform revenue per paid booking (platform fee + protection fee). It does not yet subtract Stripe processing or support costs.`,
        monthlyHaircutGmvDollars: centsToDollars(monthlyHaircutGmvCents),
      },
    },
  });
}
