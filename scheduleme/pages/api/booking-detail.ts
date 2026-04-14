// pages/api/booking-detail.ts
// Returns one booking for the authenticated customer (secure, minimal payload for pay page)
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';
import stripe from '../../lib/stripe';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'booking-detail' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const bookingId = typeof req.query.booking_id === 'string' ? req.query.booking_id : '';
  if (!isValidUuid(bookingId)) return res.status(400).json({ error: 'Invalid booking_id' });

  try {
    const supabase = getSupabase();
    let { data, error } = await supabase
      .from('bookings')
      .select('id, user_id, business_id, service, status, created_at, note, notes, scheduled_start, scheduled_end, amount_cents, protection_fee_cents, paid_at, stripe_customer_id, stripe_payment_method_id')
      .eq('id', bookingId)
      .maybeSingle();

    // Backward-compat fallback for DBs missing newer columns and/or relation joins.
    if (error) {
      const fallback = await supabase
        .from('bookings')
        .select('id, user_id, business_id, service, status, created_at, notes, scheduled_start, scheduled_end, amount_cents, paid_at, stripe_customer_id, stripe_payment_method_id')
        .eq('id', bookingId)
        .maybeSingle();
      data = fallback.data as any;
      error = fallback.error as any;
    }

    if (error) {
      // Last-resort minimal shape so pay page can still render.
      const fallbackMinimal = await supabase
        .from('bookings')
        .select('id, user_id, business_id, service, status, created_at')
        .eq('id', bookingId)
        .maybeSingle();
      data = fallbackMinimal.data as any;
      error = fallbackMinimal.error as any;
    }

    if (error || !data) return res.status(404).json({ error: 'Booking not found' });

    let canAccess = data.user_id === user.id;
    if (!canAccess && user.email) {
      const normalizedEmail = user.email.trim().toLowerCase();
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', normalizedEmail)
        .limit(20);
      if ((profiles || []).some((p: any) => p?.id && p.id === data.user_id)) canAccess = true;
      if (!canAccess) {
        try {
          const { data: legacyUsers } = await supabase
            .from('users')
            .select('id')
            .ilike('email', normalizedEmail)
            .limit(20);
          if ((legacyUsers || []).some((u: any) => u?.id && u.id === data.user_id)) canAccess = true;
        } catch {}
      }
      if (!canAccess && (data as any)?.stripe_customer_id) {
        try {
          const customer = await stripe.customers.retrieve((data as any).stripe_customer_id);
          const customerEmail = String((customer as any)?.email || '').trim().toLowerCase();
          if (!(customer as any)?.deleted && customerEmail && customerEmail === normalizedEmail) canAccess = true;
        } catch {}
      }
    }
    if (!canAccess) return res.status(403).json({ error: 'Access denied' });

    let businessName: string | null = null;
    let businessStripeOnboarded: boolean | null | undefined = undefined;
    let businessStripeAccountId: string | null | undefined = undefined;
    if (data.business_id) {
      const { data: biz } = await supabase
        .from('businesses')
        .select('name, stripe_onboarded, stripe_account_id')
        .eq('id', data.business_id)
        .maybeSingle();
      businessName = (biz as any)?.name || null;
      businessStripeOnboarded = (biz as any)?.stripe_onboarded;
      businessStripeAccountId = (biz as any)?.stripe_account_id;
    }

    const booking = {
      ...data,
      business_name: businessName,
      business_stripe_onboarded: businessStripeOnboarded,
      business_stripe_account_id: businessStripeAccountId,
      businesses: undefined,
      note: data.note ?? data.notes ?? null,
    };

    return res.status(200).json({ booking });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
