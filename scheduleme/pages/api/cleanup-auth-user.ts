// pages/api/cleanup-auth-user.ts
// Deletes an auth user if they have no business account
// Called automatically after a failed business login attempt
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, email } = req.body;
  if (!userId || !email) return res.status(400).json({ error: 'userId and email required' });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Double-check they really have no business account before deleting
  const { data: biz } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_email', email)
    .maybeSingle();

  if (biz) {
    // They DO have a business account — don't delete
    return res.status(400).json({ error: 'User has a business account, not deleting' });
  }

  // Safe to delete — no business account
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    console.error('[cleanup-auth-user] Error:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}
