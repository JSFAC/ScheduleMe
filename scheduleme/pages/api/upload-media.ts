// pages/api/upload-media.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, isValidUuid } from '../../lib/apiSecurity';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export const config = { api: { bodyParser: { sizeLimit: '55mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, { max: 20, windowMs: 60 * 60_000, keyPrefix: 'upload-media' })) return;

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
  const maxSize = isVideo ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
  if (buffer.length > maxSize)
    return res.status(400).json({ error: 'File too large' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured in Vercel env vars' });

  // Use service role — bypasses RLS
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { schema: 'public' },
  });

  // Test the connection first
  const { data: testData, error: testError } = await supabase
    .from('businesses')
    .select('id')
    .limit(1);

  if (testError) {
    return res.status(500).json({ 
      error: `DB connection failed: ${testError.message}. Service key prefix: ${serviceKey.slice(0, 20)}...`
    });
  }

  // Now fetch the specific business
  const { data: biz, error: bizError } = await supabase
    .from('businesses')
    .select('id, cover_url')
    .eq('id', business_id)
    .maybeSingle();

  if (bizError) return res.status(500).json({ error: 'DB query error: ' + bizError.message });
  if (!biz) return res.status(404).json({ 
    error: `Business ${business_id} not found in DB. Key works (found ${testData?.length ?? 0} businesses total)`
  });

  const ext = (file_name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase();
  const fileName = `${business_id}/${isVideo ? 'video' : 'img_' + Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('business-media')
    .upload(fileName, buffer, { contentType: file_type, upsert: true });

  if (uploadError) return res.status(500).json({ error: 'Storage failed: ' + uploadError.message });

  const { data: { publicUrl } } = supabase.storage.from('business-media').getPublicUrl(fileName);

  // Update cover_url (and video_url if those columns exist)
  if (isVideo) {
    await supabase.from('businesses').update({ video_url: publicUrl }).eq('id', business_id).then(() => {});
  } else {
    // Always update cover_url with first image
    await supabase.from('businesses').update({ cover_url: publicUrl }).eq('id', business_id);
  }

  return res.status(200).json({ url: publicUrl });
}
