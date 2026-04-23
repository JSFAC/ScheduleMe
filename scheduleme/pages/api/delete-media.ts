// pages/api/delete-media.ts — delete a business media file
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 30, windowMs: 60_000, keyPrefix: 'delete-media' }))) return;
  const user = await requireAuth(req, res);
  if (!user) return;

  const { business_id, url, media_type } = req.body;
  if (!business_id || !isValidUuid(business_id)) return res.status(400).json({ error: 'Valid business_id required' });

  const supabase = getSupabase();
  const { data: biz } = await supabase
    .from('businesses')
    .select('id, owner_id, owner_email, media_urls, video_url')
    .eq('id', business_id)
    .maybeSingle();
  if (!biz) return res.status(403).json({ error: 'Access denied' });

  const normalizedOwnerEmail = String((biz as any).owner_email || '').toLowerCase().trim();
  const normalizedUserEmail = String(user.email || '').toLowerCase().trim();
  if (!(biz as any).owner_id && normalizedOwnerEmail && normalizedOwnerEmail === normalizedUserEmail) {
    await supabase.from('businesses').update({ owner_id: user.id }).eq('id', business_id);
    (biz as any).owner_id = user.id;
  }
  if ((biz as any).owner_id !== user.id) return res.status(403).json({ error: 'Access denied' });

  // Extract storage path from URL
  const bucketUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/business-media/`;
  const filePath = url?.replace(bucketUrl, '');
  if (filePath) await supabase.storage.from('business-media').remove([filePath]);

  if (media_type === 'video') {
    await supabase.from('businesses').update({ video_url: null }).eq('id', business_id);
  } else {
    const updated = (biz.media_urls || []).filter((u: string) => u !== url);
    await supabase.from('businesses').update({ media_urls: updated, cover_url: updated[0] || null }).eq('id', business_id);
  }

  return res.status(200).json({ success: true });
}
