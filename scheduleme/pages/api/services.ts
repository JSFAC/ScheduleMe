// @ts-nocheck
// pages/api/services.ts — CRUD for business service menu items
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, rateLimitByPrincipal, requireAuth, isValidUuid } from '../../lib/apiSecurity';
import { filterMessage } from '../../lib/profanity';
import { moderateUserText } from '../../lib/openaiModeration';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!, { auth: { persistSession: false } });
}

function isMissingColumnError(error: any, column: string): boolean {
  const message = String(error?.message ?? '').toLowerCase();
  return (
    message.includes(`'${column.toLowerCase()}'`) ||
    message.includes(`"${column.toLowerCase()}"`) ||
    message.includes(` ${column.toLowerCase()} `) ||
    message.includes(`.${column.toLowerCase()}`)
  );
}

async function insertServiceWithFallback(supabase: any, basePayload: Record<string, any>) {
  const candidates: Array<Record<string, any>> = [];
  candidates.push({ ...basePayload });
  candidates.push({ ...basePayload, requires_exact_time: undefined });
  candidates.push({ ...basePayload, sort_order: undefined });
  candidates.push({ ...basePayload, requires_exact_time: undefined, sort_order: undefined });

  let lastError: any = null;
  for (const candidate of candidates) {
    const payload = Object.fromEntries(
      Object.entries(candidate).filter(([, value]) => value !== undefined)
    );
    const result = await supabase.from('services').insert(payload).select().single();
    if (!result.error) return result;
    lastError = result.error;
  }

  return { data: null, error: lastError };
}

async function updateServiceWithFallback(
  supabase: any,
  safeUpdates: Record<string, any>,
  id: string,
  business_id: string
) {
  const candidates: Array<Record<string, any>> = [];
  candidates.push({ ...safeUpdates });
  candidates.push({ ...safeUpdates, requires_exact_time: undefined });
  candidates.push({ ...safeUpdates, sort_order: undefined });
  candidates.push({ ...safeUpdates, requires_exact_time: undefined, sort_order: undefined });

  let lastError: any = null;
  for (const candidate of candidates) {
    const payload = Object.fromEntries(
      Object.entries(candidate).filter(([, value]) => value !== undefined)
    );
    if (Object.keys(payload).length === 0) continue;
    const result = await supabase
      .from('services')
      .update(payload)
      .eq('id', id)
      .eq('business_id', business_id)
      .select()
      .single();
    if (!result.error) return result;
    lastError = result.error;
  }

  return { data: null, error: lastError };
}

function isHardModerationBlock(result: { ok: boolean; flaggedCategories?: string[]; reason?: string }) {
  if (result.ok) return false;
  if ((result.flaggedCategories || []).length > 0) return true;
  const reason = String(result.reason || '').toLowerCase();
  return reason.includes('blocked by safety filter');
}

function isUpdatedAtTriggerMismatch(error: any): boolean {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('record "new" has no field "updated_at"');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  const limited = await rateLimit(req, res, { max: 120, windowMs: 60000 });
  if (!limited) return;

  try {
    // GET — public, fetch services for a business
    if (req.method === 'GET') {
      const { business_id } = req.query;
      if (!business_id) return res.status(400).json({ error: 'business_id required' });
      const supabase = getSupabase();
      let { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', business_id)
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (error && isMissingColumnError(error, 'sort_order')) {
        const fallback = await supabase
          .from('services')
          .select('*')
          .eq('business_id', business_id)
          .eq('active', true);
        data = fallback.data;
        error = fallback.error;
      }

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ services: data || [] });
    }

    // All other methods require auth
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!(await rateLimitByPrincipal(res, user.id, { max: 120, windowMs: 60_000, keyPrefix: 'services-user' }))) return;
    const supabase = getSupabase();

    // Verify business ownership
    async function verifyOwner(business_id: string) {
      const { data } = await supabase
        .from('businesses')
        .select('id, owner_id, owner_email')
        .eq('id', business_id)
        .maybeSingle();
      if (!data) return false;
      const ownerId = typeof data.owner_id === 'string' ? data.owner_id : null;
      const ownerEmail = typeof data.owner_email === 'string' ? data.owner_email.toLowerCase().trim() : '';
      const userEmail = (user.email || '').toLowerCase().trim();
      if (ownerId) return ownerId === user.id;
      return !!ownerEmail && !!userEmail && ownerEmail === userEmail;
    }

    if (req.method === 'POST') {
      const { business_id, name, description, price_cents, duration_min, sort_order, requires_exact_time } = req.body;
      if (!business_id || !name || price_cents === undefined) return res.status(400).json({ error: 'business_id, name, price_cents required' });
      if (!isValidUuid(business_id)) return res.status(400).json({ error: 'Invalid business_id' });
      if (!(await verifyOwner(business_id))) return res.status(403).json({ error: 'Access denied' });

      const safeName = String(name).trim();
      if (!safeName) return res.status(400).json({ error: 'name required' });
      if (safeName.length > 120) return res.status(400).json({ error: 'name too long' });
      const safeDescription = typeof description === 'string' ? description.trim() : '';
      if (safeDescription.length > 5000) return res.status(400).json({ error: 'description too long' });
      let cleanedDescription = safeDescription;

      const filteredName = filterMessage(safeName);
      if (!filteredName.ok) return res.status(400).json({ error: filteredName.error });
      const nameModeration = await moderateUserText(filteredName.filtered);
      if (isHardModerationBlock(nameModeration)) {
        return res.status(400).json({ error: 'Service name blocked by safety filters. Please revise and try again.', categories: nameModeration.flaggedCategories });
      }

      if (safeDescription) {
        const filteredDescription = filterMessage(safeDescription);
        if (!filteredDescription.ok) return res.status(400).json({ error: filteredDescription.error });
        const descriptionModeration = await moderateUserText(filteredDescription.filtered);
        if (isHardModerationBlock(descriptionModeration)) {
          return res.status(400).json({ error: 'Service description blocked by safety filters. Please revise and try again.', categories: descriptionModeration.flaggedCategories });
        }
        cleanedDescription = filteredDescription.filtered;
      }

      const insertPayload: Record<string, any> = {
        business_id,
        name: filteredName.filtered,
        description: cleanedDescription || null,
        price_cents: Math.max(0, Math.round(Number(price_cents))),
        duration_min: Math.max(5, Math.round(Number(duration_min || 60))),
        sort_order: Math.max(0, Math.round(Number(sort_order || 0))),
        requires_exact_time: typeof requires_exact_time === 'boolean' ? requires_exact_time : false,
        active: true,
      };

      const { data, error } = await insertServiceWithFallback(supabase, insertPayload);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json({ service: data });
    }

    if (req.method === 'PATCH') {
      const { id, business_id, ...updates } = req.body;
      if (!id || !business_id) return res.status(400).json({ error: 'id and business_id required' });
      if (!isValidUuid(id) || !isValidUuid(business_id)) return res.status(400).json({ error: 'Invalid id or business_id' });
      if (!(await verifyOwner(business_id))) return res.status(403).json({ error: 'Access denied' });

      const allowedKeys = new Set(['name', 'description', 'price_cents', 'duration_min', 'sort_order', 'active', 'requires_exact_time']);
      const safeUpdates: Record<string, any> = {};
      for (const [key, value] of Object.entries(updates || {})) {
        if (!allowedKeys.has(key)) continue;
        safeUpdates[key] = value;
      }

      if (typeof safeUpdates.name === 'string') {
        const trimmed = safeUpdates.name.trim();
        if (!trimmed) return res.status(400).json({ error: 'name cannot be empty' });
        if (trimmed.length > 120) return res.status(400).json({ error: 'name too long' });
        const filtered = filterMessage(trimmed);
        if (!filtered.ok) return res.status(400).json({ error: filtered.error });
        const moderation = await moderateUserText(filtered.filtered);
        if (isHardModerationBlock(moderation)) {
          return res.status(400).json({ error: 'Service name blocked by safety filters. Please revise and try again.', categories: moderation.flaggedCategories });
        }
        safeUpdates.name = filtered.filtered;
      }

      if (typeof safeUpdates.description === 'string') {
        const trimmed = safeUpdates.description.trim();
        if (trimmed.length > 5000) return res.status(400).json({ error: 'description too long' });
        if (trimmed) {
          const filtered = filterMessage(trimmed);
          if (!filtered.ok) return res.status(400).json({ error: filtered.error });
          const moderation = await moderateUserText(filtered.filtered);
          if (isHardModerationBlock(moderation)) {
            return res.status(400).json({ error: 'Service description blocked by safety filters. Please revise and try again.', categories: moderation.flaggedCategories });
          }
          safeUpdates.description = filtered.filtered;
        } else {
          safeUpdates.description = null;
        }
      }

      if (safeUpdates.price_cents !== undefined) safeUpdates.price_cents = Math.max(0, Math.round(Number(safeUpdates.price_cents)));
      if (safeUpdates.duration_min !== undefined) safeUpdates.duration_min = Math.max(5, Math.round(Number(safeUpdates.duration_min)));
      if (safeUpdates.sort_order !== undefined) safeUpdates.sort_order = Math.max(0, Math.round(Number(safeUpdates.sort_order)));
      if (safeUpdates.active !== undefined) safeUpdates.active = !!safeUpdates.active;
      if (safeUpdates.requires_exact_time !== undefined) safeUpdates.requires_exact_time = !!safeUpdates.requires_exact_time;

      if (Object.keys(safeUpdates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

      const { data, error } = await updateServiceWithFallback(
        supabase,
        safeUpdates,
        id,
        business_id
      );
      if (!error) return res.status(200).json({ service: data });

      // Legacy schema repair path:
      // some deployments have an UPDATE trigger that expects NEW.updated_at even when
      // the column is missing. In that case, update operations fail but inserts still work.
      // We preserve user intent by cloning the service with updated fields, then removing old.
      if (isUpdatedAtTriggerMismatch(error)) {
        const existingResponse = await supabase
          .from('services')
          .select('*')
          .eq('id', id)
          .eq('business_id', business_id)
          .single();
        if (existingResponse.error || !existingResponse.data) {
          return res.status(500).json({ error: existingResponse.error?.message || error.message });
        }

        const existing = existingResponse.data as Record<string, any>;
        const replacementPayload: Record<string, any> = {
          business_id,
          name: safeUpdates.name ?? existing.name,
          description: safeUpdates.description !== undefined ? safeUpdates.description : existing.description,
          price_cents: safeUpdates.price_cents ?? existing.price_cents,
          duration_min: safeUpdates.duration_min ?? existing.duration_min,
          sort_order: safeUpdates.sort_order ?? existing.sort_order ?? 0,
          requires_exact_time: safeUpdates.requires_exact_time ?? existing.requires_exact_time ?? false,
          active: safeUpdates.active ?? existing.active ?? true,
        };

        const inserted = await insertServiceWithFallback(supabase, replacementPayload);
        if (inserted.error) return res.status(500).json({ error: inserted.error.message || error.message });

        // Best-effort cleanup of legacy row. If delete fails, still return the replacement.
        await supabase.from('services').delete().eq('id', id).eq('business_id', business_id);

        return res.status(200).json({
          service: inserted.data,
          replaced_legacy_row: true,
        });
      }

      return res.status(500).json({ error: error.message });
    }

    if (req.method === 'DELETE') {
      const { id, business_id } = req.body;
      if (!id || !business_id) return res.status(400).json({ error: 'id and business_id required' });
      if (!isValidUuid(id) || !isValidUuid(business_id)) return res.status(400).json({ error: 'Invalid id or business_id' });
      if (!(await verifyOwner(business_id))) return res.status(403).json({ error: 'Access denied' });
      await supabase.from('services').delete().eq('id', id).eq('business_id', business_id);
      return res.status(200).json({ success: true });
    }

    return res.status(405).end();
  } catch (error: any) {
    console.error('[api/services] unhandled error', {
      method: req.method,
      message: error?.message,
    });
    return res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
}
