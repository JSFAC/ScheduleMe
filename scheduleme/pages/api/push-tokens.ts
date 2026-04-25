// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, rateLimit, setSecurityHeaders } from '../../lib/apiSecurity';

type Body = {
  token?: string;
  platform?: string;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function upsertToken(
  sb: ReturnType<typeof getSupabase>,
  table: string,
  userId: string,
  token: string,
  platform: string
) {
  return sb
    .from(table)
    .upsert(
      {
        user_id: userId,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token', ignoreDuplicates: false }
    );
}

async function deleteToken(
  sb: ReturnType<typeof getSupabase>,
  table: string,
  userId: string,
  token: string
) {
  return sb.from(table).delete().eq('user_id', userId).eq('token', token);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (!(await rateLimit(req, res, { max: 180, windowMs: 60_000, keyPrefix: 'push-tokens' }))) return;
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const body = (req.body || {}) as Body;
  const token = (body.token || '').trim();
  const platform = (body.platform || 'ios').trim().toLowerCase();
  if (!token) return res.status(400).json({ error: 'token is required' });

  const sb = getSupabase();
  const tablesToTry = ['push_tokens', 'device_push_tokens'];

  try {
    if (req.method === 'POST') {
      for (const table of tablesToTry) {
        const { error } = await upsertToken(sb, table, user.id, token, platform);
        if (!error) return res.status(200).json({ success: true });
      }
      // Graceful success to avoid breaking auth/session flows on deployments
      // that have not provisioned push token storage yet.
      return res.status(200).json({ success: true, warning: 'push token storage unavailable' });
    }

    for (const table of tablesToTry) {
      const { error } = await deleteToken(sb, table, user.id, token);
      if (!error) return res.status(200).json({ success: true });
    }
    return res.status(200).json({ success: true, warning: 'push token storage unavailable' });
  } catch {
    return res.status(500).json({ error: 'Failed to process push token request' });
  }
}
