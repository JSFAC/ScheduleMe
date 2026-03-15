// pages/api/cleanup-auth-user.ts — SECURED
// Only deletes auth users that have no business account — called after failed biz login
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, isValidUuid, isValidEmail } from '../../lib/apiSecurity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit tightly — this touches auth.users
  if (!rateLimit(req, res, { max: 5, windowMs: 60 * 60_000, keyPrefix: 'cleanup' })) return;

  const { userId, email } = req.body;
  if (!userId || !email) return res.status(400).json({ error: 'userId and email required' });
  if (!isValidUuid(userId)) return res.status(400).json({ error: 'Invalid userId' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Double-check: do NOT delete if they have a business account
  const { data: biz } = await supabase.from('businesses')
    .select('id').eq('owner_email', email).maybeSingle();
  if (biz) return res.status(400).json({ error: 'User has a business account, not deleting' });

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}
