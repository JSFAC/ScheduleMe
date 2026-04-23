import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { clampString, logAuditEvent, rateLimit, requireAdmin, setSecurityHeaders } from '../../lib/apiSecurity';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

async function sendTrustEmail(opts: {
  to?: string | null;
  businessName: string;
  ownerName: string;
  action: string;
  notes?: string | null;
}) {
  if (!opts.to) return;
  const resend = getResend();
  if (!resend) return;

  const subject =
    opts.action === 'warn'
      ? `Important notice for ${opts.businessName}`
      : opts.action === 'request_info'
        ? `More information requested for ${opts.businessName}`
        : null;
  if (!subject) return;

  const actionLabel = opts.action === 'warn' ? 'warning' : 'request for more information';
  const body = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:white;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
    <div style="background:#0f766e;padding:20px 24px;">
      <p style="margin:0;color:rgba(255,255,255,0.72);font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">ScheduleMe Trust & Safety</p>
      <h1 style="margin:8px 0 0;color:white;font-size:22px;line-height:1.2;">Action needed on your provider profile</h1>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 12px;color:#334155;font-size:14px;">Hi ${opts.ownerName || 'there'},</p>
      <p style="margin:0 0 12px;color:#334155;font-size:14px;">Your provider profile <strong>${opts.businessName}</strong> received a ${actionLabel} from our operations team.</p>
      ${opts.notes ? `<p style="margin:0 0 12px;color:#334155;font-size:14px;"><strong>Details:</strong> ${opts.notes}</p>` : ''}
      <p style="margin:0;color:#64748b;font-size:13px;">Reply to this email or contact support if you need help resolving this quickly.</p>
    </div>
  </div>
  </body></html>`;

  await resend.emails.send({
    from: 'ScheduleMe <notifications@usescheduleme.com>',
    to: opts.to,
    subject,
    html: body,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 40, windowMs: 60_000, keyPrefix: 'admin-provider-trust' }))) return;

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const action = clampString(req.body?.action, 40);
  const businessId = clampString(req.body?.businessId, 100);
  const notes = clampString(req.body?.notes, 2000) || null;
  if (!businessId) return res.status(400).json({ error: 'businessId required' });

  const validActions = ['clear_flag', 'flag', 'warn', 'request_info', 'suspend', 'unsuspend'];
  if (!validActions.includes(action)) return res.status(400).json({ error: 'Invalid action' });

  const supabase = getSupabase();
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, owner_name, owner_email, trust_status, trust_flagged, public_visibility')
    .eq('id', businessId)
    .maybeSingle();
  if (!business) return res.status(404).json({ error: 'Provider not found' });

  const nowIso = new Date().toISOString();
  const payload: Record<string, any> = {
    trust_last_action_at: nowIso,
    trust_last_action_by: admin.email || admin.id,
    trust_notes: notes,
  };

  if (action === 'flag') {
    payload.trust_status = 'flagged';
    payload.trust_flagged = true;
    payload.public_visibility = false;
  } else if (action === 'clear_flag') {
    payload.trust_status = 'clear';
    payload.trust_flagged = false;
    if (business.public_visibility === false) payload.public_visibility = true;
  } else if (action === 'warn') {
    payload.trust_status = 'warned';
    payload.trust_flagged = false;
  } else if (action === 'request_info') {
    payload.trust_status = 'requested_info';
    payload.trust_flagged = false;
  } else if (action === 'suspend') {
    payload.trust_status = 'suspended';
    payload.trust_flagged = true;
    payload.public_visibility = false;
  } else if (action === 'unsuspend') {
    payload.trust_status = 'clear';
    payload.trust_flagged = false;
    if (business.public_visibility === false) payload.public_visibility = true;
  }

  const { error } = await supabase
    .from('businesses')
    .update(payload)
    .eq('id', businessId);
  if (error) return res.status(500).json({ error: 'Failed to update trust status' });

  if (action === 'warn' || action === 'request_info') {
    await sendTrustEmail({
      to: business.owner_email,
      businessName: business.name || 'your provider profile',
      ownerName: business.owner_name || 'there',
      action,
      notes,
    });
  }

  await logAuditEvent(req, 'admin_provider_trust_action', {
    entity_type: 'provider',
    entity_id: businessId,
    actor_role: 'admin',
    actor_id: admin.id,
    actor_email: admin.email,
    meta: { action, notes: notes || null },
  });

  return res.status(200).json({ success: true, action });
}
