// @ts-nocheck
// pages/api/bookings.ts — SECURED + notifications
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import stripe from '../../lib/stripe';
import { validateAndFilter } from '../../lib/profanity';
import { moderateText } from '../../lib/moderation';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid, isValidEmail } from '../../lib/apiSecurity';
import { getPlatformFeePercent, assertPlatformFeePercent } from '../../lib/platformFees';
const LIMITS = {
  service: 120,
  note: 500,
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function hydrateProfileFromAuth(
  supabase: ReturnType<typeof getSupabase>,
  userId: string | null | undefined,
  profile: any,
  cache: Map<string, any>
) {
  if (!userId) return profile;
  if (cache.has(userId)) return cache.get(userId);
  let nextProfile = profile;
  if (nextProfile?.name) {
    cache.set(userId, nextProfile);
    return nextProfile;
  }
  try {
    const { data: authData } = await supabase.auth.admin.getUserById(userId);
    const authUser = authData?.user;
    const metaName = authUser?.user_metadata?.full_name;
    if (metaName) {
      await supabase.from('profiles').upsert({
        id: userId,
        name: metaName,
        email: authUser?.email || nextProfile?.email || null,
      }, { onConflict: 'id' });
      nextProfile = { ...(nextProfile || {}), id: userId, name: metaName, email: authUser?.email || nextProfile?.email || null };
    }
  } catch {}
  cache.set(userId, nextProfile);
  return nextProfile;
}

async function notifyNewBooking(bookingId: string, supabase: ReturnType<typeof getSupabase>) {
  try {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, service, status, created_at, businesses(name, owner_email, phone), profiles(name, email, phone, avatar_url)')
      .eq('id', bookingId)
      .single();
    if (!booking) return;

    const biz = (booking.businesses as any);
    const user = (booking.profiles as any);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';
    const secret = process.env.NOTIFY_SECRET || '';

    // Email consumer about booking request
    if (user?.email) {
      await fetch(`${siteUrl}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
        body: JSON.stringify({
          type: 'booking_confirmation',
          to: user.email,
          name: user?.name || 'there',
          service: booking.service,
          location: biz?.name || '',
        }),
      }).catch(() => {});
    }

    // Email business owner about new booking
    if (biz?.owner_email) {
      await fetch(`${siteUrl}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': secret },
        body: JSON.stringify({
          type: 'new_booking_business',
          to: biz.owner_email,
          name: biz.name,
          service: booking.service,
          customerName: user?.name || 'A customer',
          customerPhone: user?.phone || '',
          bookingId,
        }),
      }).catch(() => {});
    }

    // Trigger n8n workflow
    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nUrl) {
      await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'new_booking',
          bookingId,
          service: booking.service,
          businessName: biz?.name,
          businessEmail: biz?.owner_email,
          customerName: user?.name,
          customerEmail: user?.email,
          customerPhone: user?.phone,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    }
  } catch { /* non-fatal */ }
}

async function handleCompletionBusinessUpdate(
  supabase: ReturnType<typeof getSupabase>,
  businessId: string
) {
  const { data: biz } = await supabase
    .from('businesses')
    .select('id, name, owner_email, founder50, founder50_status, bookings_completed, last_completed_booking_at, away_start, away_end, availability_status, break_until, featured_until, featured_on_notified_at')
    .eq('id', businessId)
    .maybeSingle();
  if (!biz) return;

  const now = new Date();
  const updates: any = {};
  const currentCompleted = Number(biz.bookings_completed || 0);
  updates.bookings_completed = currentCompleted + 1;
  updates.last_completed_booking_at = now.toISOString();

  if (biz.founder50 && biz.founder50_status !== 'revoked') {
    updates.founder50_status = 'active';
  }

  const featuredUntil = biz.featured_until ? new Date(biz.featured_until) : null;
  const shouldFeature = updates.bookings_completed >= 3 && (!featuredUntil || Number.isNaN(featuredUntil.getTime()) || featuredUntil.getTime() < now.getTime());
  if (shouldFeature) {
    const nextUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    updates.featured_until = nextUntil.toISOString();
    updates.featured_reason = 'milestone';
    updates.featured_on_notified_at = now.toISOString();
  }

  await supabase.from('businesses').update(updates).eq('id', businessId);

  if (shouldFeature && biz.owner_email && process.env.RESEND_API_KEY) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';
    fetch(`${siteUrl}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-notify-secret': process.env.NOTIFY_SECRET || '' },
      body: JSON.stringify({
        type: 'featured_on',
        to: biz.owner_email,
        name: biz.name || 'there',
        businessName: biz.name || 'Your business',
      }),
    }).catch(() => {});
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'POST') {
    if (!(await rateLimit(req, res, { max: 1000, windowMs: 10 * 60_000, keyPrefix: 'book-post' }))) return;

    const { business_id, user_id, service, user_name, user_phone, user_email, scheduled_start, scheduled_end, timezone, note, service_price_cents } = req.body;
    let email = user_email;

    let authUser: { id: string; email: string } | null = null;
    if (req.headers.authorization) {
      authUser = await requireAuth(req, res);
      if (!authUser) return;
      if (!email) email = authUser.email;
    }


    if (!business_id) return res.status(400).json({ error: 'business_id is required' });
    if (!isValidUuid(business_id)) return res.status(400).json({ error: 'Invalid business_id' });
    if (user_id && !isValidUuid(user_id)) return res.status(400).json({ error: 'Invalid user_id' });
    if (email && !isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });

    if (service_price_cents && typeof service_price_cents !== 'number') return res.status(400).json({ error: 'Invalid service_price_cents' });

    if (service) {
      const svcCheck = validateAndFilter(service, { maxLength: LIMITS.service, fieldName: 'Service description' });
      if (!svcCheck.ok) return res.status(400).json({ error: svcCheck.error });
    }
    if (typeof note === 'string' && note.length > LIMITS.note) {
      return res.status(400).json({ error: `Note must be ${LIMITS.note} characters or less` });
    }
    if (typeof note === 'string' && note.trim()) {
      const textMod = await moderateText(note);
      if (!textMod.ok) return res.status(400).json({ error: textMod.reason || 'Note violates content policy' });
    }

    try {
      const supabase = getSupabase();
      const blockUserId = user_id || authUser?.id;
      if (blockUserId) {
        const { data: block } = await supabase
          .from('blocks')
          .select('id')
          .eq('business_id', business_id)
          .eq('user_id', blockUserId)
          .maybeSingle();
        if (block) {
          return res.status(403).json({ error: 'This business has blocked new bookings from your account.' });
        }
      }
      if (email) {
        const { data: owner } = await supabase
          .from('businesses')
          .select('owner_email')
          .eq('id', business_id)
          .maybeSingle();
        if (owner?.owner_email && owner.owner_email.toLowerCase() === email.toLowerCase()) {
          return res.status(403).json({ error: 'You cannot book your own business.' });
        }
      }
      // Block paid bookings if business hasn't connected Stripe
      if (typeof service_price_cents === 'number') {
        const { data: biz } = await supabase
          .from('businesses')
          .select('stripe_onboarded, stripe_account_id')
          .eq('id', business_id)
          .maybeSingle();
        if (!biz?.stripe_onboarded || !biz?.stripe_account_id) {
          return res.status(400).json({ error: 'Business has not connected their bank account yet' });
        }
      }

      let scheduledStart: string | null = null;
      if (scheduled_start && typeof scheduled_start === 'string') {
        const d = new Date(scheduled_start);
        if (!Number.isNaN(d.getTime())) scheduledStart = d.toISOString();
      }
      let scheduledEnd: string | null = null;
      if (scheduled_end && typeof scheduled_end === 'string') {
        const d = new Date(scheduled_end);
        if (!Number.isNaN(d.getTime())) scheduledEnd = d.toISOString();
      }

      let resolvedUserId = user_id || authUser?.id;
      if (!email && authUser?.email) email = authUser.email;

      let profileId: string | null = null;
      if (email) {
        // Prefer existing profile id for this email to avoid mismatches
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        if (existing?.id) {
          profileId = existing.id;
        } else {
          const payload: any = { email: email, name: user_name?.slice(0, 100), phone: user_phone?.slice(0, 20) };
          if (authUser?.id) payload.id = authUser.id;
          const { data: userData } = await supabase
            .from('profiles')
            .upsert(payload, { onConflict: authUser?.id ? 'id' : 'email' })
            .select('id').single();
          profileId = userData?.id ?? null;
        }
        if (existing?.id && user_name) {
          await supabase
            .from('profiles')
            .update({ name: user_name.slice(0, 100) })
            .eq('id', existing.id)
            .is('name', null);
        }
      }
      if (profileId) resolvedUserId = profileId;

      let profileStripeCustomerId = null;
      let profileStripePaymentMethodId = null;
      if (profileId) {
        const { data: pStripe } = await supabase
          .from('profiles')
          .select('stripe_customer_id, stripe_payment_method_id')
          .eq('id', profileId)
          .maybeSingle();
        if (pStripe) {
          profileStripeCustomerId = pStripe.stripe_customer_id || null;
          profileStripePaymentMethodId = pStripe.stripe_payment_method_id || null;
        }
      }

      const { data, error } = await supabase.from('bookings').insert({
        business_id,
        user_id: resolvedUserId ?? null,
        service: (service?.slice(0, LIMITS.service) ?? (typeof service_price_cents === 'number' ? 'Service' : 'Custom Request')),
        amount_cents: typeof service_price_cents === 'number' ? service_price_cents : undefined,
        note: typeof note === 'string' ? note.slice(0, LIMITS.note) : null,
        scheduled_start: scheduledStart ?? null,
        scheduled_end: scheduledEnd ?? null,
        timezone: typeof timezone === 'string' ? timezone : undefined,
        status: 'pending',
        requires_manual_action: true,
        stripe_customer_id: profileStripeCustomerId || undefined,
        stripe_payment_method_id: profileStripePaymentMethodId || undefined,
      }).select('id, status, created_at').single();

      if (error) {
        // Fallback: some deployments don't have optional columns yet
        const { data: fallback, error: fbErr } = await supabase.from('bookings').insert({
          business_id,
          user_id: resolvedUserId ?? null,
          service: (service?.slice(0, LIMITS.service) ?? (typeof service_price_cents === 'number' ? 'Service' : 'Custom Request')),
          status: 'pending',
          requires_manual_action: true,
        stripe_customer_id: profileStripeCustomerId || undefined,
        stripe_payment_method_id: profileStripePaymentMethodId || undefined,
        }).select('id, status, created_at').single();
        if (fbErr) return res.status(500).json({ error: 'Failed to create booking', details: error.message || error });
        if (!service_price_cents || typeof service_price_cents !== 'number') {
          notifyNewBooking(fallback.id, supabase);
        }
        return res.status(200).json({ booking: fallback, warning: 'Booking created without schedule details. Please update database columns.' });
      }

      // Fire-and-forget notifications (only for non-paid/custom requests)
      if (!service_price_cents || typeof service_price_cents !== 'number') {
        notifyNewBooking(data.id, supabase);
      }

      return res.status(200).json({ booking: data });
    } catch (err) {
      return res.status(500).json({ error: (err as any)?.message || 'Internal server error' });
    }
  }

  if (req.method === 'PATCH') {
    // Business confirms/cancels/completes a booking
    if (!(await rateLimit(req, res, { max: 1000, windowMs: 60_000, keyPrefix: 'book-patch' }))) return;
    const user = await requireAuth(req, res);
    if (!user) return;

    const { booking_id, status, dispute_amount_cents, dispute_note } = req.body;
    if (!isValidUuid(booking_id)) return res.status(400).json({ error: 'Invalid booking_id' });
    const VALID_STATUSES = ['pending', 'confirmed', 'active', 'completed', 'cancelled', 'payment_pending', 'paid', 'price_disputed'];
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const supabase = getSupabase();

    // Verify caller owns the business for this booking
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('id, status, service, user_id, amount_cents, stripe_payment_intent_id, stripe_customer_id, stripe_payment_method_id, business_id, businesses(id, owner_email, name, stripe_account_id, stripe_onboarded, founder50, founder50_status, last_completed_booking_at, away_start, away_end, availability_status, break_until)')
      .eq('id', booking_id)
      .maybeSingle();

    if (bookingErr) return res.status(500).json({ error: bookingErr.message || 'Failed to load booking' });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    let biz = booking.businesses as any;
    if (!biz && booking.business_id) {
      const { data: fallbackBiz } = await supabase
        .from('businesses')
      .select('id, owner_email, name, stripe_account_id, stripe_onboarded, founder50, founder50_status, last_completed_booking_at, away_start, away_end, availability_status, break_until')
        .eq('id', booking.business_id)
        .maybeSingle();
      biz = fallbackBiz || null;
    }
    const isBusinessOwner = biz?.owner_email === user.email;
    let canCancelAsConsumer = false;
    let canDisputeAsConsumer = false;
    if (!isBusinessOwner && status === 'cancelled') {
      let canCancel = booking.user_id === user.id;
      if (!canCancel && user.email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        if (profile?.id && booking.user_id === profile.id) canCancel = true;
        if (!canCancel) {
          try {
            const { data: legacyUser } = await supabase
              .from('users')
              .select('id')
              .eq('email', user.email)
              .maybeSingle();
            if (legacyUser?.id && booking.user_id === legacyUser.id) canCancel = true;
          } catch {}
        }
      }
      canCancelAsConsumer = canCancel;
    }
    if (!isBusinessOwner && status === 'price_disputed') {
      let canDispute = booking.user_id === user.id;
      if (!canDispute && user.email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        if (profile?.id && booking.user_id === profile.id) canDispute = true;
        if (!canDispute) {
          try {
            const { data: legacyUser } = await supabase
              .from('users')
              .select('id')
              .eq('email', user.email)
              .maybeSingle();
            if (legacyUser?.id && booking.user_id === legacyUser.id) canDispute = true;
          } catch {}
        }
      }
      canDisputeAsConsumer = canDispute;
    }

    if (!isBusinessOwner && !canCancelAsConsumer && !canDisputeAsConsumer)
      return res.status(403).json({ error: 'Access denied' });

    const updatePayload: any = { status };
    if (status === 'price_disputed') {
      if (!dispute_amount_cents || dispute_amount_cents <= 0) {
        return res.status(400).json({ error: 'Valid dispute_amount_cents required' });
      }
      updatePayload.dispute_amount_cents = Math.round(dispute_amount_cents);
      updatePayload.dispute_note = dispute_note || null;
      updatePayload.dispute_at = new Date().toISOString();
    }

    // If cancelling a paid booking, issue a full refund and reverse transfer + app fee
    if (status === 'cancelled' && booking.stripe_payment_intent_id && booking.paid_at) {
      try {
        await stripe.refunds.create({
          payment_intent: booking.stripe_payment_intent_id,
          reverse_transfer: true,
          refund_application_fee: true,
        });
      } catch (e: any) {
        console.error('[booking] refund failed', e);
        return res.status(500).json({ error: e?.message || 'Refund failed' });
      }
    }

    // Charge on completion using saved card (SetupIntent flow)
    if (status === 'completed' && booking.amount_cents && booking.amount_cents > 0) {
      if (!biz?.stripe_onboarded || !biz?.stripe_account_id) {
        return res.status(400).json({ error: 'Business has not connected their bank account yet' });
      }
      const customerId = booking.stripe_customer_id || profileStripeCustomerId;
      const paymentMethodId = booking.stripe_payment_method_id || profileStripePaymentMethodId;
      if (!customerId || !paymentMethodId) {
        return res.status(400).json({ error: 'Customer has not saved a card yet' });
      }
      try {
        const platformFeePercent = getPlatformFeePercent(biz);
        if (!assertPlatformFeePercent(biz, platformFeePercent)) {
          return res.status(400).json({ error: 'Platform fee mismatch. Please contact support.' });
        }
        const platformFeeCents = Math.round(booking.amount_cents * platformFeePercent / 100);
        const pi = await stripe.paymentIntents.create({
          amount: booking.amount_cents,
          currency: 'usd',
          customer: customerId,
          payment_method: paymentMethodId,
          confirm: true,
          off_session: true,
          application_fee_amount: platformFeeCents,
          transfer_data: { destination: biz.stripe_account_id },
          metadata: { bookingId: booking_id, businessId: biz.id, platform_fee_percent: String(platformFeePercent) },
        });

        if (pi.status !== 'succeeded') {
          return res.status(500).json({ error: 'Payment could not be completed. Please try again.' });
        }

        updatePayload.paid_at = new Date().toISOString();
        updatePayload.stripe_payment_intent_id = pi.id;
        updatePayload.stripe_customer_id = customerId;
        updatePayload.stripe_payment_method_id = paymentMethodId;

        // Best-effort instant payout to connected account (if enabled)
        const transferAmount = Math.max(0, booking.amount_cents - platformFeeCents);
        if (transferAmount > 0) {
          try {
            await stripe.payouts.create(
              { amount: transferAmount, currency: 'usd', method: 'instant' },
              { stripeAccount: biz.stripe_account_id }
            );
          } catch (e: any) {
            console.warn('[booking] instant payout failed, falling back to standard schedule', e?.message || e);
          }
        }
      } catch (e: any) {
        console.error('[booking] payment intent create failed', e);
        return res.status(500).json({ error: e?.message || 'Payment failed' });
      }
    }

    const { error: updErr } = await supabase.from('bookings').update(updatePayload).eq('id', booking_id);
    if (updErr) {
      const msg = updErr.message || '';
      const isDisputeFieldMissing = status === 'price_disputed' && (msg.includes('dispute_amount_cents') || msg.includes('dispute_note') || msg.includes('dispute_at'));
      if (isDisputeFieldMissing) {
        const { error: fallbackErr } = await supabase.from('bookings').update({ status }).eq('id', booking_id);
        if (fallbackErr) return res.status(500).json({ error: fallbackErr.message || 'Failed to update booking' });
      } else {
        return res.status(500).json({ error: msg || 'Failed to update booking' });
      }
    }

    // Notify business of dispute so they can respond immediately
    if (status === 'price_disputed' && biz?.owner_email) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';
      fetch(`${siteUrl}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': process.env.NOTIFY_SECRET || '' },
        body: JSON.stringify({
          type: 'status_update',
          to: biz.owner_email,
          name: biz?.name || 'there',
          service: booking.service,
          status: 'price_disputed',
          businessName: biz?.name,
        }),
      }).catch(() => {});
    }

    if (status === 'completed' && booking.status !== 'completed' && booking.business_id) {
      await handleCompletionBusinessUpdate(supabase, booking.business_id);
    }

    // Notify consumer of status change
    let consumer: any = null;
    if (booking.user_id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', booking.user_id)
        .maybeSingle();
      consumer = prof || null;
      if (!consumer) {
        try {
          const { data: legacy } = await supabase
            .from('users')
            .select('name, email')
            .eq('id', booking.user_id)
            .maybeSingle();
          consumer = legacy || null;
        } catch {}
      }
    }
    if (consumer?.email) {
      // Send review request email when booking is completed
      if (status === 'completed') {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';
        fetch(`${siteUrl}/api/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-notify-secret': process.env.NOTIFY_SECRET || '' },
          body: JSON.stringify({
            type: 'review_request',
            to: consumer.email,
            name: consumer.name || 'there',
            service: booking.service,
            bookingId: booking_id,
          }),
        }).catch(() => {});
      }
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://usescheduleme.com';
      fetch(`${siteUrl}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notify-secret': process.env.NOTIFY_SECRET || '' },
        body: JSON.stringify({
          type: 'status_update',
          to: consumer.email,
          name: consumer.name || 'there',
          service: booking.service,
          status,
          businessName: (booking.businesses as any)?.name,
        }),
      }).catch(() => {});

      // n8n trigger for status changes
      if (process.env.N8N_WEBHOOK_URL) {
        fetch(process.env.N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: `booking_${status}`,
            bookingId: booking_id,
            service: booking.service,
            customerEmail: consumer.email,
            customerName: consumer.name,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {});
      }
    }

    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET') {
    if (!(await rateLimit(req, res, { max: 1000, windowMs: 60_000, keyPrefix: 'book-get' }))) return;

    const { business_id, user_id } = req.query;

    if (business_id) {
      if (!isValidUuid(business_id)) return res.status(400).json({ error: 'Invalid business_id' });
      const user = await requireAuth(req, res);
      if (!user) return;

      const supabase = getSupabase();
      const { data: biz } = await supabase.from('businesses')
        .select('owner_email').eq('id', business_id).maybeSingle();
      if (!biz) return res.status(404).json({ error: 'Business not found' });
      if (biz.owner_email !== user.email) return res.status(403).json({ error: 'Access denied' });

      try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, profiles(id, name, phone, email, avatar_url)')
        .eq('business_id', business_id)
        .or('amount_cents.is.null,service.ilike.%custom%,stripe_payment_method_id.not.is.null,status.eq.price_disputed')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) return res.status(500).json({ error: 'Failed to fetch bookings' });
      const profileCache = new Map<string, any>();
      const withProfiles = await Promise.all((data || []).map(async (b: any) => {
        const userId = b.profiles?.id || b.user_id || null;
        const prof = await hydrateProfileFromAuth(supabase, userId, b.profiles, profileCache);
        return { ...b, profiles: prof || b.profiles };
      }));
      return res.status(200).json({ bookings: withProfiles || [] });
      } catch (err) {
        return res.status(500).json({ error: (err as any)?.message || 'Internal server error' });
      }
    }

    // Consumer bookings (auth required)
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user_id && !isValidUuid(user_id)) return res.status(400).json({ error: 'Invalid user_id' });

    try {
      const supabase = getSupabase();
      const ids = new Set<string>();
      ids.add(user.id);
      if (user_id) ids.add(user_id as string);

      if (user.email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        if (profile?.id) ids.add(profile.id);

        try {
          const { data: legacyUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();
          if (legacyUser?.id) ids.add(legacyUser.id);
        } catch {}
      }

      const idList = Array.from(ids).filter(Boolean);
      let query = supabase
        .from('bookings')
        .select('id, service, status, created_at, scheduled_start, scheduled_end, amount_cents, paid_at, note, reviewed, business_id, business_name, stripe_payment_method_id, stripe_customer_id, businesses(name, phone, email), profiles(email, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(100);

      let data: any[] | null = null;
      let error: any = null;
      if (idList.length > 1) {
        const resq = await query.in('user_id', idList);
        data = resq.data; error = resq.error;
      } else {
        const resq = await query.eq('user_id', idList[0]);
        data = resq.data; error = resq.error;
      }

      if (error) {
        // Retry without relational selects if FK isn't present in this environment
        let plainQuery = supabase
          .from('bookings')
          .select('id, service, status, created_at, scheduled_start, scheduled_end, amount_cents, paid_at, note, reviewed, business_id, business_name, stripe_payment_method_id, stripe_customer_id')
          .order('created_at', { ascending: false })
          .limit(100);
        if (idList.length > 1) {
          const retry = await plainQuery.in('user_id', idList);
          data = retry.data; error = retry.error;
        } else {
          const retry = await plainQuery.eq('user_id', idList[0]);
          data = retry.data; error = retry.error;
        }
      }

      if (error) return res.status(500).json({ error: error.message || 'Failed to fetch bookings' });
      let bizMap: Record<string, { name?: string | null; phone?: string | null; email?: string | null }> = {};
      const bizIds = Array.from(new Set((data || []).map((b: any) => b.business_id || b.businesses?.id).filter(Boolean)));
      if (bizIds.length > 0) {
        const { data: bizData } = await supabase
          .from('businesses')
          .select('id, name, phone, email')
          .in('id', bizIds);
        (bizData || []).forEach((biz: any) => {
          bizMap[biz.id] = { name: biz.name, phone: biz.phone, email: biz.email };
        });
      }
      const bookings = (data || []).map((b: any) => ({
        ...b,
        scheduled_at: b.scheduled_start ?? null,
        business_name: b.business_name ?? b.businesses?.name ?? bizMap[b.business_id || b.businesses?.id]?.name ?? null,
        business_phone: b.businesses?.phone ?? bizMap[b.business_id || b.businesses?.id]?.phone ?? null,
        business_email: b.businesses?.email ?? bizMap[b.business_id || b.businesses?.id]?.email ?? null,
      }));
      return res.status(200).json({ bookings });
    } catch (err) {
      return res.status(500).json({ error: (err as any)?.message || 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
