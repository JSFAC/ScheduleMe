// pages/api/blocks.ts — block/unblock messaging between a user and business
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  const supabase = getSupabase();

  if (req.method === 'GET') {
    if (!rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'blocks-get' })) return;
    const user = await requireAuth(req, res);
    if (!user) return;

    const { business_id, user_id } = req.query;
    if (business_id) {
      if (!isValidUuid(business_id as string)) return res.status(400).json({ error: 'Valid business_id required' });
      // Verify business ownership
      const { data: biz } = await supabase.from('businesses').select('owner_email').eq('id', business_id).maybeSingle();
      if (!biz) return res.status(404).json({ error: 'Business not found' });
      if (biz.owner_email !== user.email) return res.status(403).json({ error: 'Access denied' });
      const { data } = await supabase
        .from('blocks')
        .select('id, user_id, business_id, blocked_by, created_at')
        .eq('business_id', business_id);
      return res.status(200).json({ blocks: data || [] });
    }
    if (user_id) {
      if (!isValidUuid(user_id as string)) return res.status(400).json({ error: 'Valid user_id required' });
      if (user_id !== user.id) return res.status(403).json({ error: 'Access denied' });
      const { data } = await supabase
        .from('blocks')
        .select('id, user_id, business_id, blocked_by, created_at')
        .eq('user_id', user_id);
      return res.status(200).json({ blocks: data || [] });
    }
    return res.status(400).json({ error: 'business_id or user_id required' });
  }

  if (req.method === 'POST') {
    if (!rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'blocks-post' })) return;
    const user = await requireAuth(req, res);
    if (!user) return;

    const { business_id, user_id, action, reason } = req.body;
    if (!business_id || !isValidUuid(business_id)) return res.status(400).json({ error: 'Valid business_id required' });
    if (!user_id || !isValidUuid(user_id)) return res.status(400).json({ error: 'Valid user_id required' });

    // Determine who is blocking
    const { data: biz } = await supabase.from('businesses').select('owner_email').eq('id', business_id).maybeSingle();
    const isBusinessOwner = biz?.owner_email === user.email;
    const isUser = user.id === user_id;
    if (!isBusinessOwner && !isUser) return res.status(403).json({ error: 'Access denied' });

    if (action === 'unblock') {
      await supabase.from('blocks').delete().eq('business_id', business_id).eq('user_id', user_id);
      return res.status(200).json({ ok: true });
    }

    const blocked_by = isBusinessOwner ? 'business' : 'user';
    const { data, error } = await supabase
      .from('blocks')
      .upsert({ business_id, user_id, blocked_by, reason: reason || null }, { onConflict: 'business_id,user_id' })
      .select('id, business_id, user_id, blocked_by, created_at')
      .single();
    if (error) return res.status(500).json({ error: 'Failed to block' });
    return res.status(200).json({ block: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
