// pages/api/upload-avatar.ts — upload and moderate user avatar
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth } from '../../lib/apiSecurity';
import { moderateUserImageDataUrl } from '../../lib/openaiModeration';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 15, windowMs: 60 * 60_000, keyPrefix: 'upload-avatar' }))) return;
  const user = await requireAuth(req, res);
  if (!user) return;

  const { file_data, file_type, file_name } = req.body;
  if (!file_data || !file_type || !file_name) return res.status(400).json({ error: 'file_data, file_type, file_name required' });
  if (!ALLOWED_IMAGE_TYPES.includes(String(file_type))) return res.status(400).json({ error: 'Invalid file type' });

  const base64Data = String(file_data).replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'File too large' });

  const dataUrl = String(file_data).startsWith('data:')
    ? String(file_data)
    : `data:${file_type};base64,${base64Data}`;
  const moderation = await moderateUserImageDataUrl(dataUrl);
  if (!moderation.ok) {
    return res.status(400).json({
      error: 'Image blocked by safety filters. Please upload a different image.',
      categories: moderation.flaggedCategories,
    });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const ext = (String(file_name).split('.').pop() || 'jpg').toLowerCase();
  const bucket = process.env.AVATAR_MEDIA_BUCKET || 'business-media';
  const path = `avatars/${user.id}/avatar_${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(bucket).upload(path, buffer, { upsert: true, contentType: String(file_type) });
  if (upErr) return res.status(500).json({ error: 'Upload failed: ' + upErr.message });

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email,
      avatar_url: publicUrl,
    },
    { onConflict: 'id', ignoreDuplicates: false }
  );

  return res.status(200).json({ url: publicUrl });
}
