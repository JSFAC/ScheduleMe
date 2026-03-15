// pages/api/reviews.ts — submit and fetch business reviews
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';
import { validateAndFilter } from '../../lib/profanity';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);

  // POST — submit a review
  if (req.method === 'POST') {
    if (!rateLimit(req, res, { max: 5, windowMs: 60 * 60_000, keyPrefix: 'review-post' })) return;
    const user = await requireAuth(req, res);
    if (!user) return;

    const { booking_id, business_id, rating, comment } = req.body;

    if (!booking_id || !business_id || !rating)
      return res.status(400).json({ error: 'booking_id, business_id, rating required' });
    if (!isValidUuid(booking_id) || !isValidUuid(business_id))
      return res.status(400).json({ error: 'Invalid IDs' });
    if (typeof rating !== 'number' || rating < 1 || rating > 5)
      return res.status(400).json({ error: 'Rating must be 1-5' });

    // Filter comment if provided
    let cleanComment = '';
    if (comment) {
      const check = validateAndFilter(comment, { maxLength: 500, fieldName: 'Review' });
      if (!check.ok) return res.status(400).json({ error: check.error });
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

    // Insert review
    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        booking_id,
        business_id,
        user_id: user.id,
        rating,
        comment: cleanComment || null,
      })
      .select('id, rating, comment, created_at')
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
    if (!rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'review-get' })) return;

    const { business_id } = req.query;
    if (!business_id || !isValidUuid(business_id as string))
      return res.status(400).json({ error: 'Valid business_id required' });

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at, profiles(name)')
      .eq('business_id', business_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: 'Failed to fetch reviews' });
    return res.status(200).json({ reviews: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
