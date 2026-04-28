// pages/api/delete-account.ts — SECURED
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Very tight rate limit — account deletion is irreversible
  if (!(await rateLimit(req, res, { max: 3, windowMs: 60 * 60_000, keyPrefix: 'delete-account' }))) return;

  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
  if (!url || !serviceKey) return res.status(500).json({ error: 'Server misconfigured' });

  const anonClient = createClient(url, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);
  const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: 'Invalid or expired session' });

  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Cleanup provider/business-side data first so deleted auth users don't leave stale listings.
  // Best-effort: these deletions should not block auth deletion if a table doesn't exist.
  try {
    if (user.id) {
      await adminClient.from('businesses').delete().eq('owner_id', user.id);
    }
    if (user.email) {
      await adminClient.from('businesses').delete().ilike('owner_email', user.email);
      await adminClient.from('users').delete().eq('email', user.email);
    }
    await adminClient.from('profiles').delete().eq('id', user.id);
  } catch {
    // Ignore cleanup errors and proceed to auth deletion.
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) return res.status(500).json({ error: deleteError.message });

  return res.status(200).json({ success: true });
}
