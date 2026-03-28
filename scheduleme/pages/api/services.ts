// @ts-nocheck
// pages/api/services.ts — CRUD for business service menu items
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (!rateLimit(req, res, { max: 60, windowMs: 60000 })) return;

  // GET — public, fetch services for a business
  if (req.method === 'GET') {
    const { business_id } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id required' });
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', business_id)
      .eq('active', true)
      .order('sort_order', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ services: data || [] });
  }

  // All other methods require auth
  const user = await requireAuth(req, res);
  if (!user) return;
  const supabase = getSupabase();

  // Verify business ownership
  async function verifyOwner(business_id: string) {
    const { data } = await supabase.from('businesses').select('id').eq('id', business_id)
      .eq('owner_email', user.email)
      .maybeSingle();
    return !!data;
  }

  if (req.method === 'POST') {
    const { business_id, name, description, price_cents, duration_min, sort_order } = req.body;
    if (!business_id || !name || price_cents === undefined) return res.status(400).json({ error: 'business_id, name, price_cents required' });
    if (!(await verifyOwner(business_id))) return res.status(403).json({ error: 'Access denied' });
    const { data, error } = await supabase.from('services').insert({ business_id, name, description: description || null, price_cents: Math.round(price_cents), duration_min: duration_min || 60, sort_order: sort_order || 0, active: true }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ service: data });
  }

  if (req.method === 'PATCH') {
    const { id, business_id, ...updates } = req.body;
    if (!id || !business_id) return res.status(400).json({ error: 'id and business_id required' });
    if (!(await verifyOwner(business_id))) return res.status(403).json({ error: 'Access denied' });
    if (updates.price_cents) updates.price_cents = Math.round(updates.price_cents);
    const { data, error } = await supabase.from('services').update(updates).eq('id', id).eq('business_id', business_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ service: data });
  }

  if (req.method === 'DELETE') {
    const { id, business_id } = req.body;
    if (!id || !business_id) return res.status(400).json({ error: 'id and business_id required' });
    if (!(await verifyOwner(business_id))) return res.status(403).json({ error: 'Access denied' });
    await supabase.from('services').delete().eq('id', id).eq('business_id', business_id);
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
