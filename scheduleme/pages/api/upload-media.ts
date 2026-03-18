// pages/api/upload-media.ts — handle business media uploads to Supabase Storage
// Uses base64 encoding to avoid needing formidable package
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;   // 8MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;  // 50MB (base64 limit)

export const config = { api: { bodyParser: { sizeLimit: '55mb' } } };

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, { max: 20, windowMs: 60 * 60_000, keyPrefix: 'upload-media' })) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { business_id, media_type, file_data, file_type, file_name } = req.body;

  if (!business_id || !isValidUuid(business_id))
    return res.status(400).json({ error: 'Valid business_id required' });
  if (!file_data || !file_type || !file_name)
    return res.status(400).json({ error: 'file_data, file_type, file_name required' });

  const isVideo = media_type === 'video';
  const allowedTypes = isVideo ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
  if (!allowedTypes.includes(file_type))
    return res.status(400).json({ error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}` });

  // Decode base64
  const base64Data = file_data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (buffer.length > maxSize)
    return res.status(400).json({ error: `File too large. Max: ${Math.round(maxSize / 1024 / 1024)}MB` });

  const supabase = getSupabase();

  // Verify ownership
  const { data: biz } = await supabase
    .from('businesses')
    .select('id, owner_email, media_urls, video_url')
    .eq('id', business_id)
    .maybeSingle();

  if (!biz) return res.status(404).json({ error: 'Business not found' });
  if (biz.owner_email !== user.email) return res.status(403).json({ error: 'Access denied' });

  const ext = file_name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
  const fileName = `${business_id}/${isVideo ? 'video' : 'img_' + Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('business-media')
    .upload(fileName, buffer, { contentType: file_type, upsert: true });

  if (uploadError)
    return res.status(500).json({ error: 'Storage upload failed: ' + uploadError.message });

  const { data: { publicUrl } } = supabase.storage
    .from('business-media')
    .getPublicUrl(fileName);

  if (isVideo) {
    await supabase.from('businesses').update({ video_url: publicUrl }).eq('id', business_id);
  } else {
    const existing: string[] = biz.media_urls || [];
    const updated = [...existing.filter((u: string) => u !== publicUrl), publicUrl].slice(0, 6);
    await supabase.from('businesses').update({
      media_urls: updated,
      cover_url: updated[0],
    }).eq('id', business_id);
  }

  return res.status(200).json({ url: publicUrl });
}
