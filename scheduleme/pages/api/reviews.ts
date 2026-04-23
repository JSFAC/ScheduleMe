// pages/api/reviews.ts — submit and fetch business reviews
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';
import { validateAndFilter } from '../../lib/profanity';
import { moderateUserText, hasHardModerationSignal } from '../../lib/openaiModeration';

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm', 'quicktime']);

function isVideoURL(value: string): boolean {
  try {
    const parsed = new URL(value);
    const ext = parsed.pathname.split('.').pop()?.toLowerCase() ?? '';
    return VIDEO_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
}

function isAllowedReviewMediaHost(value: string): boolean {
  try {
    const parsed = new URL(value);
    const host = parsed.host.toLowerCase();
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host.toLowerCase()
      : '';
    if (supabaseHost && host === supabaseHost) return true;
    return host === 'usescheduleme.com' || host === 'www.usescheduleme.com';
  } catch {
    return false;
  }
}

function isAllowedReviewMediaPath(value: string): boolean {
  try {
    const parsed = new URL(value);
    const path = parsed.pathname.toLowerCase();
    return path.includes('/messages/') || path.includes('/reviews/');
  } catch {
    return false;
  }
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);

  // POST — submit a review
  if (req.method === 'POST') {
    if (!(await rateLimit(req, res, { max: 5, windowMs: 60 * 60_000, keyPrefix: 'review-post' }))) return;
    const user = await requireAuth(req, res);
    if (!user) return;

    const { booking_id, business_id, rating, comment, review_media_urls } = req.body;

    if (!booking_id || !business_id || !rating)
      return res.status(400).json({ error: 'booking_id, business_id, rating required' });
    if (!isValidUuid(booking_id) || !isValidUuid(business_id))
      return res.status(400).json({ error: 'Invalid IDs' });
    if (typeof rating !== 'number' || rating < 1 || rating > 5)
      return res.status(400).json({ error: 'Rating must be 1-5' });

    const mediaURLs = Array.isArray(review_media_urls)
      ? review_media_urls.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
    if (mediaURLs.length > 3) {
      return res.status(400).json({ error: 'Reviews can include up to 3 media items.' });
    }
    let videoCount = 0;
    for (const raw of mediaURLs) {
      const value = raw.trim();
      try {
        const parsed = new URL(value);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return res.status(400).json({ error: 'Review media URLs must be http or https.' });
        }
      } catch {
        return res.status(400).json({ error: 'Invalid review media URL.' });
      }
      if (!isAllowedReviewMediaHost(value)) {
        return res.status(400).json({ error: 'Review media must be uploaded through ScheduleMe.' });
      }
      if (!isAllowedReviewMediaPath(value)) {
        return res.status(400).json({ error: 'Review media must use message/review uploads, not provider cover media.' });
      }
      if (isVideoURL(value)) videoCount += 1;
    }
    if (videoCount > 1) {
      return res.status(400).json({ error: 'Reviews can include at most 1 video.' });
    }

    // Filter comment if provided
    let cleanComment = '';
    if (comment) {
      const check = validateAndFilter(comment, { maxLength: 500, fieldName: 'Review' });
      if (!check.ok) {
        const reason = 'error' in check ? check.error : 'Review failed validation';
        return res.status(400).json({ error: reason });
      }
      const moderation = await moderateUserText(check.value);
      const hardSignal = hasHardModerationSignal(moderation.flaggedCategories);
      if (!moderation.ok && hardSignal) {
        return res.status(400).json({
          error: 'Review blocked by safety filters. Please revise and try again.',
          categories: moderation.flaggedCategories,
        });
      }
      cleanComment = check.value;
    }

    const supabase = getSupabase();

    // Verify the booking belongs to this user and is completed
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status, user_id')
      .eq('id', booking_id)
      .maybeSingle();

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.user_id !== user.id) return res.status(403).json({ error: 'Access denied' });
    if (!['completed', 'paid'].includes(booking.status))
      return res.status(400).json({ error: 'Can only review completed bookings' });

    // Check no existing review for this booking
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('booking_id', booking_id)
      .maybeSingle();

    if (existing) return res.status(409).json({ error: 'You already reviewed this booking' });

    // One review per provider (business) per user.
    const { data: existingBusinessReview } = await supabase
      .from('reviews')
      .select('id, booking_id')
      .eq('business_id', business_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingBusinessReview) {
      return res.status(409).json({ error: 'You already reviewed this provider' });
    }

    // Insert review
    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        booking_id,
        business_id,
        user_id: user.id,
        rating,
        comment: cleanComment || null,
        review_media_urls: mediaURLs,
      })
      .select('id, rating, comment, review_media_urls, created_at')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to submit review' });

    // Update business average rating
    const { data: allReviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('business_id', business_id);

    if (allReviews?.length) {
      const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      await supabase.from('businesses').update({
        rating: Math.round(avg * 10) / 10,
        review_count: allReviews.length,
      }).eq('id', business_id);
    }

    // Mark booking as reviewed
    await supabase.from('bookings').update({ reviewed: true }).eq('id', booking_id);

    return res.status(200).json({ review });
  }

  // GET — fetch reviews for a business
  if (req.method === 'GET') {
    if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'review-get' }))) return;

    const { business_id, check_user } = req.query;
    if (!business_id || !isValidUuid(business_id as string))
      return res.status(400).json({ error: 'Valid business_id required' });

    if (check_user === '1') {
      const user = await requireAuth(req, res);
      if (!user) return;
      const supabase = getSupabase();
      const { data: mine, error: mineError } = await supabase
        .from('reviews')
        .select('id')
        .eq('business_id', business_id)
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (mineError) return res.status(500).json({ error: 'Failed to check review status' });
      return res.status(200).json({ has_user_reviewed: !!mine });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, comment, review_media_urls, created_at, profiles(name,avatar_url)')
      .eq('business_id', business_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: 'Failed to fetch reviews' });
    // Public display rule:
    // Star-only reviews (no comment and no media) still count toward average/count,
    // but remain anonymous and hidden from the visible review feed.
    const visibleReviews = (data || []).filter((row: any) => {
      const comment = typeof row?.comment === 'string' ? row.comment.trim() : '';
      const media = Array.isArray(row?.review_media_urls) ? row.review_media_urls.filter(Boolean) : [];
      return comment.length > 0 || media.length > 0;
    });
    return res.status(200).json({ reviews: visibleReviews });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
