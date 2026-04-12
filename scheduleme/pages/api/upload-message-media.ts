// pages/api/upload-message-media.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { moderateUserImageDataUrl } from '../../lib/openaiModeration';
import { setSecurityHeaders, rateLimit, rateLimitByPrincipal, requireAuth, isValidUuid } from '../../lib/apiSecurity';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export const config = { api: { bodyParser: { sizeLimit: '80mb' } } };

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing Supabase env vars');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function cleanFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 20, windowMs: 60 * 60_000, keyPrefix: 'upload-message-media' }))) return;

  const user = await requireAuth(req, res);
  if (!user) return;
  if (!(await rateLimitByPrincipal(res, user.id, { max: 40, windowMs: 60 * 60_000, keyPrefix: 'upload-message-media-user' }))) return;

  const { booking_id, media_type, file_data, file_type, file_name } = req.body ?? {};

  if (!booking_id || !isValidUuid(booking_id)) {
    return res.status(400).json({ error: 'Valid booking_id required' });
  }
  if (!file_data || !file_type || !file_name || !media_type) {
    return res.status(400).json({ error: 'booking_id, media_type, file_data, file_type, file_name required' });
  }
  if (!['image', 'video'].includes(media_type)) {
    return res.status(400).json({ error: 'media_type must be image or video' });
  }

  const isVideo = media_type === 'video';
  const allowedTypes = isVideo ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
  if (!allowedTypes.includes(file_type)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }

  const base64Data = String(file_data).replace(/^data:[^;]+;base64,/, '');
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Data, 'base64');
  } catch {
    return res.status(400).json({ error: 'Invalid file_data encoding' });
  }
  if (!buffer.length) {
    return res.status(400).json({ error: 'Invalid file_data' });
  }
  const maxSize = isVideo ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
  if (buffer.length > maxSize) {
    return res.status(400).json({ error: 'File too large' });
  }

  const supabase = getSupabaseService();

  // Verify caller belongs to this booking (consumer or provider owner).
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, user_id, businesses(owner_id, owner_email)')
    .eq('id', booking_id)
    .maybeSingle();

  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const isUser = (booking as any).user_id === user.id;
  const ownerId = typeof (booking as any)?.businesses?.owner_id === 'string' ? (booking as any).businesses.owner_id : null;
  const ownerEmail = typeof (booking as any)?.businesses?.owner_email === 'string'
    ? (booking as any).businesses.owner_email.toLowerCase().trim()
    : '';
  const userEmail = (user.email || '').toLowerCase().trim();
  const isBizOwner = ownerId === user.id || (!ownerId && !!ownerEmail && !!userEmail && ownerEmail === userEmail);
  if (!isUser && !isBizOwner) return res.status(403).json({ error: 'Access denied' });

  if (!isVideo) {
    const dataUrl = String(file_data).startsWith('data:')
      ? String(file_data)
      : `data:${file_type};base64,${base64Data}`;
    const moderation = await moderateUserImageDataUrl(dataUrl);
    const hasHardSignal = (moderation.flaggedCategories?.length ?? 0) > 0;
    if (!moderation.ok && hasHardSignal) {
      return res.status(400).json({
        error: 'Image blocked by safety filters. Please upload a different image.',
        categories: moderation.flaggedCategories,
      });
    }
  }

  const ext = (String(file_name).split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase();
  const safeName = cleanFileName(String(file_name));
  const baseName = safeName.endsWith(`.${ext}`) ? safeName.slice(0, -(`.${ext}`.length)) : safeName;
  const stamped = `${Date.now()}_${baseName}`;
  const bucket = process.env.MESSAGE_MEDIA_BUCKET || 'business-media';
  const objectPath = `messages/${booking_id}/${stamped}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, buffer, { contentType: file_type, upsert: false });

  if (uploadError) {
    return res.status(500).json({ error: `Storage failed: ${uploadError.message}` });
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return res.status(200).json({ url: data.publicUrl });
}
