// pages/api/blocks.ts — block/unblock messaging between a user and business
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid, getUnknownFields } from '../../lib/apiSecurity';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
  if (!url || !key) throw new Error('Missing env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  const supabase = getSupabase();

  async function resolveBusinessOwnership(businessId: string, user: { id: string; email: string }) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('id, owner_id, owner_email')
      .eq('id', businessId)
      .maybeSingle();
    if (!biz) return { biz: null, isOwner: false };

    const normalizedOwnerEmail = String((biz as any).owner_email || '').toLowerCase().trim();
    const normalizedUserEmail = String(user.email || '').toLowerCase().trim();
    if (!(biz as any).owner_id && normalizedOwnerEmail && normalizedOwnerEmail === normalizedUserEmail) {
      await supabase.from('businesses').update({ owner_id: user.id }).eq('id', businessId);
      (biz as any).owner_id = user.id;
    }
    const isOwner = (biz as any).owner_id === user.id;
    return { biz, isOwner };
  }

  if (req.method === 'GET') {
    if (!(await rateLimit(req, res, { max: 60, windowMs: 60_000, keyPrefix: 'blocks-get' }))) return;
    const user = await requireAuth(req, res);
    if (!user) return;

    const { business_id, user_id } = req.query;
    if (business_id) {
      if (!isValidUuid(business_id as string)) return res.status(400).json({ error: 'Valid business_id required' });
      // Verify business ownership
      const { biz, isOwner } = await resolveBusinessOwnership(String(business_id), user);
      if (!biz) return res.status(404).json({ error: 'Business not found' });
      if (!isOwner) return res.status(403).json({ error: 'Access denied' });
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
    if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'blocks-post' }))) return;
    const user = await requireAuth(req, res);
    if (!user) return;

    const allowed = ['business_id','user_id','action','reason'];
    const unknown = getUnknownFields(req.body, allowed);
    if (unknown.length > 0) return res.status(400).json({ error: `Unexpected fields: ${unknown.join(', ')}` });
    const { business_id, user_id, action, reason } = req.body;
    if (!business_id || !isValidUuid(business_id)) return res.status(400).json({ error: 'Valid business_id required' });
    if (!user_id || !isValidUuid(user_id)) return res.status(400).json({ error: 'Valid user_id required' });

    // Determine who is blocking
    const { isOwner: isBusinessOwner } = await resolveBusinessOwnership(String(business_id), user);
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
