// pages/api/admin-featured-notify.ts
// Secured cron/admin job: send featured on/off emails safely
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';
import { sendFeaturedOnEmail, sendFeaturedOffEmail } from '../../lib/email';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function isAuthorized(req: NextApiRequest) {
  const secret = req.headers['x-notify-secret'];
  return !!process.env.NOTIFY_SECRET && secret === process.env.NOTIFY_SECRET;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await rateLimit(req, res, { max: 10, windowMs: 60_000, keyPrefix: 'admin-featured-notify' }))) return;

  const sb = getSupabase();
  const now = new Date();
  const nowIso = now.toISOString();

  let sentOn = 0;
  let sentOff = 0;

  // Manual featured from campus_featured
  const { data: manualRows } = await sb
    .from('campus_featured')
    .select('id, business_id, starts_at, ends_at, notified_on_at, notified_off_at, campus_key')
    .order('slot', { ascending: true });

  const manualActive = (manualRows || []).filter((row: any) => {
    const start = row.starts_at ? new Date(row.starts_at) : null;
    const end = row.ends_at ? new Date(row.ends_at) : null;
    if (start && end) return now >= start && now <= end;
    if (start && !end) return now >= start;
    if (!start && end) return now <= end;
    return true;
  });

  const manualNotifyOn = (manualRows || []).filter((row: any) => !row.notified_on_at).filter((row: any) => {
    const start = row.starts_at ? new Date(row.starts_at) : null;
    const end = row.ends_at ? new Date(row.ends_at) : null;
    if (start && now < start) return false;
    if (end && now > end) return false;
    return true;
  });

  const manualNotifyOff = (manualRows || []).filter((row: any) => !row.notified_off_at).filter((row: any) => {
    const end = row.ends_at ? new Date(row.ends_at) : null;
    return end && now > end;
  });

  const manualBizIds = Array.from(new Set([
    ...manualNotifyOn.map((r: any) => r.business_id),
    ...manualNotifyOff.map((r: any) => r.business_id),
  ].filter(Boolean)));

  if (manualBizIds.length > 0) {
    const { data: bizRows } = await sb
      .from('businesses')
      .select('id, name, owner_email')
      .in('id', manualBizIds);
    const bizMap = new Map((bizRows || []).map((b: any) => [b.id, b]));

    for (const row of manualNotifyOn) {
      const biz = bizMap.get(row.business_id);
      if (biz?.owner_email) {
        await sendFeaturedOnEmail({ to: biz.owner_email, businessName: biz.name || 'Your business', durationDays: 7 }).catch(() => {});
        await sb.from('campus_featured').update({ notified_on_at: nowIso }).eq('id', row.id);
        sentOn++;
      }
    }

    for (const row of manualNotifyOff) {
      const biz = bizMap.get(row.business_id);
      if (biz?.owner_email) {
        await sendFeaturedOffEmail({ to: biz.owner_email, businessName: biz.name || 'Your business' }).catch(() => {});
        await sb.from('campus_featured').update({ notified_off_at: nowIso }).eq('id', row.id);
        sentOff++;
      }
    }
  }

  // Auto featured from businesses.featured_until
  const { data: autoOnRows } = await sb
    .from('businesses')
    .select('id, name, owner_email, featured_until, featured_on_notified_at')
    .gt('featured_until', nowIso)
    .is('featured_on_notified_at', null);

  for (const biz of autoOnRows || []) {
    if (biz.owner_email) {
      await sendFeaturedOnEmail({ to: biz.owner_email, businessName: biz.name || 'Your business', durationDays: 7 }).catch(() => {});
      await sb.from('businesses').update({ featured_on_notified_at: nowIso }).eq('id', biz.id);
      sentOn++;
    }
  }

  const { data: autoOffRows } = await sb
    .from('businesses')
    .select('id, name, owner_email, featured_until, featured_off_notified_at')
    .lt('featured_until', nowIso)
    .is('featured_off_notified_at', null);

  for (const biz of autoOffRows || []) {
    if (biz.owner_email) {
      await sendFeaturedOffEmail({ to: biz.owner_email, businessName: biz.name || 'Your business' }).catch(() => {});
      await sb.from('businesses').update({ featured_off_notified_at: nowIso }).eq('id', biz.id);
      sentOff++;
    }
  }

  return res.status(200).json({ ok: true, sentOn, sentOff, manualActive: manualActive.length });
}
