// @ts-nocheck
// pages/api/disconnect-edu.ts — remove EDU verification from profile
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit, requireAuth, logAuditEvent } from '../../lib/apiSecurity';

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
  if (!(await rateLimit(req, res, { max: 5, windowMs: 10 * 60_000, keyPrefix: 'edu-disconnect' }))) return;
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const supabase = getSupabase();
    await supabase.from('profiles').update({
      edu_verified: false,
      school_email: null,
      school_domain: null,
      school_name: null,
      edu_code: null,
      edu_code_expires_at: null,
    }).eq('id', user.id);

    await logAuditEvent(req, 'edu_disconnect_consumer', {
      entity_type: 'profile',
      entity_id: user.id,
      actor_id: user.id,
      actor_email: user.email,
      actor_role: 'consumer',
    });

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[disconnect-edu] error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
