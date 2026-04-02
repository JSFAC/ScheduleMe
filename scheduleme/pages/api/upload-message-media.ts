// pages/api/upload-message-media.ts — upload + moderate message images
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, isValidUuid } from '../../lib/apiSecurity';
import { moderateImageDataUrl } from '../../lib/moderation';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, { max: 120, windowMs: 60_000, keyPrefix: 'msg-media' })) return;
  const user = await requireAuth(req, res);
  if (!user) return;

  const { booking_id, file_data, file_type, file_name } = req.body;
  if (!booking_id || !isValidUuid(booking_id)) return res.status(400).json({ error: 'Valid booking_id required' });
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

  // Verify caller is part of this booking
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, user_id, businesses(owner_email), business_id')
    .eq('id', booking_id)
    .maybeSingle();
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  const isUser = booking.user_id === user.id;
  const isBiz = (booking.businesses as any)?.owner_email === user.email;
  if (!isUser && !isBiz) return res.status(403).json({ error: 'Access denied' });

  const ext = (file_name.split('.').pop() || 'jpg').toLowerCase();
  const filePath = `${booking_id}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from('message-media').upload(filePath, buffer, { contentType: file_type, upsert: true });
  if (upErr) return res.status(500).json({ error: 'Upload failed: ' + upErr.message });
  const { data: { publicUrl } } = supabase.storage.from('message-media').getPublicUrl(filePath);
  return res.status(200).json({ url: publicUrl });
}
