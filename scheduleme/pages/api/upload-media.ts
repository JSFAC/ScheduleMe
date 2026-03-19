// pages/api/upload-media.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, isValidUuid } from '../../lib/apiSecurity';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

export const config = { api: { bodyParser: { sizeLimit: '55mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, { max: 20, windowMs: 60 * 60_000, keyPrefix: 'upload-media' })) return;

  const token = req.headers.authorization?.replace('Bearer ', '') || '';
  if (!token) return res.status(401).json({ error: 'No auth token' });

  const { business_id, media_type, file_data, file_type, file_name } = req.body;

  if (!business_id || !isValidUuid(business_id))
    return res.status(400).json({ error: 'Valid business_id required' });
  if (!file_data || !file_type || !file_name)
    return res.status(400).json({ error: 'file_data, file_type, file_name required' });

  const isVideo = media_type === 'video';
  const allowedTypes = isVideo ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
  if (!allowedTypes.includes(file_type))
    return res.status(400).json({ error: 'Invalid file type' });

  const base64Data = file_data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length > (isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE))
    return res.status(400).json({ error: `File too large` });

  // Use service role to bypass RLS entirely for business media uploads
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // Verify the token is valid
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid session' });

  // Get business — service role bypasses all RLS
  const { data: biz } = await supabase
    .from('businesses')
    .select('id, media_urls, video_url')
    .eq('id', business_id)
    .single();

  if (!biz) return res.status(404).json({ error: `Business ${business_id} not found in database` });

  const ext = (file_name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase();
  const fileName = `${business_id}/${isVideo ? 'video' : 'img_' + Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('business-media')
    .upload(fileName, buffer, { contentType: file_type, upsert: true });

  if (uploadError) return res.status(500).json({ error: 'Storage failed: ' + uploadError.message });

  const { data: { publicUrl } } = supabase.storage.from('business-media').getPublicUrl(fileName);

  if (isVideo) {
    await supabase.from('businesses').update({ video_url: publicUrl }).eq('id', business_id);
  } else {
    const existing: string[] = biz.media_urls || [];
    const updated = [...existing.filter((u: string) => u !== publicUrl), publicUrl].slice(0, 6);
    await supabase.from('businesses').update({ media_urls: updated, cover_url: updated[0] }).eq('id', business_id);
  }

  return res.status(200).json({ url: publicUrl });
}
