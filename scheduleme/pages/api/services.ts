// @ts-nocheck
// pages/api/services.ts — CRUD for business service menu items
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, getUnknownFields } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (!(await rateLimit(req, res, { max: 60, windowMs: 60000 }))) return;
  const NAME_MAX = 60;
  const DESC_MAX = 300;

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
    const allowed = ['business_id', 'name', 'description', 'price_cents', 'duration_min', 'sort_order', 'requires_time'];
    const unknown = getUnknownFields(req.body, allowed);
    if (unknown.length > 0) return res.status(400).json({ error: `Unexpected fields: ${unknown.join(', ')}` });
    const { business_id, name, description, price_cents, duration_min, sort_order, requires_time } = req.body;
    if (!business_id || !name || price_cents === undefined) return res.status(400).json({ error: 'business_id, name, price_cents required' });
    if (typeof name !== 'string' || name.trim().length === 0) return res.status(400).json({ error: 'Service name required' });
    if (name.length > NAME_MAX) return res.status(400).json({ error: `Service name must be ${NAME_MAX} characters or less` });
    if (typeof description === 'string' && description.length > DESC_MAX) return res.status(400).json({ error: `Service description must be ${DESC_MAX} characters or less` });
    if (!(await verifyOwner(business_id))) return res.status(403).json({ error: 'Access denied' });
    const { data, error } = await supabase.from('services').insert({
      business_id,
      name: name.slice(0, NAME_MAX),
      description: typeof description === 'string' ? description.slice(0, DESC_MAX) : null,
      price_cents: Math.round(price_cents),
      duration_min: duration_min || 60,
      sort_order: sort_order || 0,
      requires_time: requires_time !== false,
      active: true,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ service: data });
  }

  if (req.method === 'PATCH') {
    const allowed = ['id', 'business_id', 'name', 'description', 'price_cents', 'duration_min', 'sort_order', 'requires_time', 'active'];
    const unknown = getUnknownFields(req.body, allowed);
    if (unknown.length > 0) return res.status(400).json({ error: `Unexpected fields: ${unknown.join(', ')}` });
    const { id, business_id, ...updates } = req.body;
    if (!id || !business_id) return res.status(400).json({ error: 'id and business_id required' });
    if (!(await verifyOwner(business_id))) return res.status(403).json({ error: 'Access denied' });
    if (typeof updates.name === 'string' && updates.name.length > NAME_MAX) return res.status(400).json({ error: `Service name must be ${NAME_MAX} characters or less` });
    if (typeof updates.description === 'string' && updates.description.length > DESC_MAX) return res.status(400).json({ error: `Service description must be ${DESC_MAX} characters or less` });
    if (updates.price_cents) updates.price_cents = Math.round(updates.price_cents);
    if (typeof updates.name === 'string') updates.name = updates.name.slice(0, NAME_MAX);
    if (typeof updates.description === 'string') updates.description = updates.description.slice(0, DESC_MAX);
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
