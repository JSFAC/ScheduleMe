// pages/api/upload-avatar.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { moderateUserImageDataUrl, hasHardModerationSignal } from '../../lib/openaiModeration';
import { setSecurityHeaders, rateLimit, rateLimitByPrincipal, requireAuth } from '../../lib/apiSecurity';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
  if (!url || !serviceKey) throw new Error('Missing Supabase env vars');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 15, windowMs: 60 * 60_000, keyPrefix: 'upload-avatar' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;
  if (!(await rateLimitByPrincipal(res, user.id, { max: 30, windowMs: 60 * 60_000, keyPrefix: 'upload-avatar-user' }))) return;

  const { file_data, file_type, file_name } = req.body ?? {};
  if (!file_data || !file_type || !file_name) {
    return res.status(400).json({ error: 'file_data, file_type, file_name required' });
  }
  if (!ALLOWED_IMAGE_TYPES.includes(String(file_type))) {
    return res.status(400).json({ error: 'Invalid file type' });
  }

  const base64Data = String(file_data).replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length > 8 * 1024 * 1024) {
    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(1);
    return res.status(400).json({ error: `File too large (${sizeMB}MB). Max allowed is 8MB.` });
  }

  const dataUrl = String(file_data).startsWith('data:')
    ? String(file_data)
    : `data:${file_type};base64,${base64Data}`;
  const moderation = await moderateUserImageDataUrl(dataUrl);
  if (!moderation.ok && hasHardModerationSignal(moderation.flaggedCategories)) {
    return res.status(400).json({
      error: 'Image blocked by safety filters. Please upload a different image.',
      categories: moderation.flaggedCategories,
    });
  }

  const supabase = getSupabaseService();
  const ext = (String(file_name).split('.').pop() || 'jpg').toLowerCase();
  const bucket = process.env.AVATAR_MEDIA_BUCKET || 'business-media';
  const objectPath = `avatars/${user.id}/avatar_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, buffer, { contentType: String(file_type), upsert: true });
  if (uploadError) {
    return res.status(500).json({ error: `Storage failed: ${uploadError.message}` });
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  const avatarUrl = data.publicUrl;

  await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email,
        avatar_url: avatarUrl,
      },
      { onConflict: 'id', ignoreDuplicates: false }
    );

  return res.status(200).json({ url: avatarUrl });
}
