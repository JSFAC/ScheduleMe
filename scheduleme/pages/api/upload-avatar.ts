// pages/api/upload-avatar.ts — upload and moderate user avatar
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth } from '../../lib/apiSecurity';
import { moderateImageDataUrl } from '../../lib/moderation';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 20, windowMs: 60_000, keyPrefix: 'avatar' }))) return;
  const user = await requireAuth(req, res);
  if (!user) return;

  const { file_data, file_type, file_name } = req.body;
  if (!file_data || !file_type || !file_name) return res.status(400).json({ error: 'file_data, file_type, file_name required' });
  if (!ALLOWED.includes(file_type)) return res.status(400).json({ error: 'Invalid file type' });

  const base64Data = file_data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length > 4 * 1024 * 1024) return res.status(400).json({ error: 'File too large' });

  const mod = await moderateImageDataUrl(file_data);
  if (!mod.ok) return res.status(400).json({ error: mod.reason || 'Image rejected by safety filters' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const ext = (file_name.split('.').pop() || 'jpg').toLowerCase();
  const path = `avatars/${user.id}.${ext}`;
  const { error: upErr } = await supabase.storage.from('avatars').upload(path, buffer, { upsert: true, contentType: file_type });
  if (upErr) return res.status(500).json({ error: 'Upload failed: ' + upErr.message });

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
  await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);

  return res.status(200).json({ url: publicUrl });
}
