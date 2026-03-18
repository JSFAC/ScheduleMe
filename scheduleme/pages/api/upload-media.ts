// pages/api/upload-media.ts — handle business media uploads to Supabase Storage
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = { api: { bodyParser: false } };

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;  // 8MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

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

  const form = formidable({ maxFileSize: MAX_VIDEO_SIZE, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'Upload failed' });

    const businessId = Array.isArray(fields.business_id) ? fields.business_id[0] : fields.business_id;
    const mediaType = Array.isArray(fields.media_type) ? fields.media_type[0] : fields.media_type; // 'image' | 'video'

    if (!businessId || !isValidUuid(businessId)) return res.status(400).json({ error: 'Valid business_id required' });

    // Verify ownership
    const supabase = getSupabase();
    const { data: biz } = await supabase.from('businesses').select('id, owner_email, media_urls, video_url').eq('id', businessId).maybeSingle();
    if (!biz) return res.status(404).json({ error: 'Business not found' });
    if (biz.owner_email !== user.email) return res.status(403).json({ error: 'Access denied' });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    const isVideo = mediaType === 'video';
    const allowedTypes = isVideo ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

    if (!allowedTypes.includes(file.mimetype || '')) {
      return res.status(400).json({ error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}` });
    }
    if (file.size > maxSize) {
      return res.status(400).json({ error: `File too large. Max: ${maxSize / 1024 / 1024}MB` });
    }

    const ext = path.extname(file.originalFilename || file.newFilename || '.jpg');
    const fileName = `${businessId}/${isVideo ? 'video' : 'img_' + Date.now()}${ext}`;
    const bucket = 'business-media';
    const fileBuffer = fs.readFileSync(file.filepath);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileBuffer, { contentType: file.mimetype || 'application/octet-stream', upsert: true });

    if (uploadError) return res.status(500).json({ error: 'Storage upload failed: ' + uploadError.message });

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);

    // Update DB
    if (isVideo) {
      await supabase.from('businesses').update({ video_url: publicUrl }).eq('id', businessId);
    } else {
      const existing: string[] = biz.media_urls || [];
      const updated = [...existing.filter(u => u !== publicUrl), publicUrl].slice(0, 6);
      await supabase.from('businesses').update({ media_urls: updated, cover_url: updated[0] }).eq('id', businessId);
    }

    fs.unlinkSync(file.filepath);
    return res.status(200).json({ url: publicUrl });
  });
}
