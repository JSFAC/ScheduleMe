// pages/api/delete-account.ts — Permanently deletes the authenticated user from Supabase
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).json({ error: 'Server misconfigured' });

  // Verify the token and get the user
  const anonClient = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: 'Invalid session' });

  // Delete auth account — profiles row auto-deletes via ON DELETE CASCADE
  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) return res.status(500).json({ error: deleteError.message });

  return res.status(200).json({ success: true });
}
