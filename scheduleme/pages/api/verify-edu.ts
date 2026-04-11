// @ts-nocheck
// pages/api/verify-edu.ts — EDU email verification
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { setSecurityHeaders, rateLimit, requireAuth, isValidEmail, logAuditEvent } from '../../lib/apiSecurity';
import { assignFounder50IfEligible } from '../../lib/founder50Assign';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
function getResend() { return new Resend(process.env.RESEND_API_KEY!); }
function generate6DigitCode(): string { return Math.floor(100000 + Math.random() * 900000).toString(); }
function extractDomain(email: string): string { return email.split('@')[1]?.toLowerCase() ?? ''; }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await rateLimit(req, res, { max: 5, windowMs: 10 * 60_000, keyPrefix: 'edu-verify' }))) return;
  const user = await requireAuth(req, res);
  if (!user) return;
  const supabase = getSupabase();
  const { action, school_email, code, account_type, business_id } = req.body;

  // ─── STEP 2: Verify submitted code ───────────────────────────────────────
  if (action === 'verify') {
    if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Code required' });
    if (account_type === 'business') {
      const bizQuery = supabase
        .from('businesses')
        .select('id, owner_id, owner_email, school_domain, edu_code, edu_code_expires_at, school_email');
      let biz: any = null;
      if (business_id) {
        const { data } = await bizQuery.eq('id', business_id).maybeSingle();
        biz = data;
      } else {
        const { data } = await bizQuery.eq('owner_id', user.id).maybeSingle();
        biz = data;
        if (!biz) {
          const { data: legacyBiz } = await supabase
            .from('businesses')
            .select('id, owner_id, owner_email, school_domain, edu_code, edu_code_expires_at, school_email')
            .eq('owner_email', user.email)
            .maybeSingle();
          biz = legacyBiz;
        }
      }
      if (!biz) return res.status(404).json({ error: 'Business account not found. Please refresh and try again.' });
      const normalizedOwnerEmail = String((biz as any).owner_email || '').toLowerCase().trim();
      const normalizedUserEmail = String(user.email || '').toLowerCase().trim();
      if (!(biz as any).owner_id && normalizedOwnerEmail && normalizedOwnerEmail === normalizedUserEmail) {
        await supabase.from('businesses').update({ owner_id: user.id }).eq('id', biz.id);
        (biz as any).owner_id = user.id;
      }
      if ((biz as any).owner_id !== user.id) return res.status(403).json({ error: 'Not authorized for this business.' });
      if (!biz?.edu_code) return res.status(400).json({ error: 'No pending verification. Request a new code.' });
      if (new Date(biz.edu_code_expires_at) < new Date()) return res.status(400).json({ error: 'Code expired. Request a new one.' });
      if (biz.edu_code !== code.trim()) return res.status(400).json({ error: 'Incorrect code. Try again.' });
      await supabase.from('businesses').update({ edu_verified: true, edu_code: null, edu_code_expires_at: null }).eq('id', biz.id);
      const { data: refreshedBiz } = await supabase
        .from('businesses')
        .select('id, founder50, founder50_status, campus_provider, campus_key, campus_school_name, edu_verified')
        .eq('id', biz.id)
        .maybeSingle();
      try {
        if (refreshedBiz) {
          await assignFounder50IfEligible(supabase, refreshedBiz as any);
        }
      } catch (err) {
        console.warn('[verify-edu] founder50 assignment failed', err);
      }
      await logAuditEvent(req, 'edu_verify_business', {
        entity_type: 'business',
        entity_id: biz.id,
        actor_id: user.id,
        actor_email: user.email,
        actor_role: 'business',
        meta: { school_domain: biz.school_domain },
      });
      return res.status(200).json({ success: true, school_domain: biz.school_domain });
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('edu_code, edu_code_expires_at, school_email')
        .eq('id', user.id)
        .single();
      if (!profile?.edu_code) return res.status(400).json({ error: 'No pending verification. Request a new code.' });
      if (new Date(profile.edu_code_expires_at) < new Date()) return res.status(400).json({ error: 'Code expired. Request a new one.' });
      if (profile.edu_code !== code.trim()) return res.status(400).json({ error: 'Incorrect code. Try again.' });
      const domain = extractDomain(profile.school_email);
      await supabase.from('profiles').update({ edu_verified: true, school_name: domain, edu_code: null, edu_code_expires_at: null }).eq('id', user.id);
      await logAuditEvent(req, 'edu_verify_consumer', {
        entity_type: 'profile',
        entity_id: user.id,
        actor_id: user.id,
        actor_email: user.email,
        actor_role: 'consumer',
        meta: { school_domain: domain },
      });
      return res.status(200).json({ success: true, school_domain: domain });
    }
  }

  // ─── STEP 1: Send verification code ──────────────────────────────────────
  if (!school_email || !isValidEmail(school_email)) return res.status(400).json({ error: 'Valid .edu email required' });
  const normalizedSchoolEmail = String(school_email).trim().toLowerCase();
  if (!normalizedSchoolEmail.endsWith('.edu')) return res.status(400).json({ error: 'Must be a .edu email address' });
  const { data: _existEdu, error: existEduError } = await supabase
    .from('profiles')
    .select('id')
    .eq('school_email', normalizedSchoolEmail)
    .eq('edu_verified', true)
    .neq('id', user.id)
    .limit(1)
    .maybeSingle();
  if (existEduError) return res.status(500).json({ error: 'Unable to validate EDU uniqueness right now. Please try again.' });
  if (_existEdu) return res.status(409).json({ error: 'This .edu email is already linked to another account.' });
  const { data: _existBiz, error: existBizError } = await supabase
    .from('businesses')
    .select('id')
    .eq('school_email', normalizedSchoolEmail)
    .eq('edu_verified', true)
    .limit(1)
    .maybeSingle();
  if (existBizError) return res.status(500).json({ error: 'Unable to validate EDU uniqueness right now. Please try again.' });
  if (_existBiz) return res.status(409).json({ error: 'This .edu email is already linked to a business account.' });
  const submittedDomain = extractDomain(normalizedSchoolEmail);

  if (account_type === 'business') {
    const bizQuery = supabase.from('businesses').select('id, owner_id, owner_email, school_domain');
    let biz: any = null;
    if (business_id) {
      const { data } = await bizQuery.eq('id', business_id).maybeSingle();
      biz = data;
    } else {
      const { data } = await bizQuery.eq('owner_id', user.id).maybeSingle();
      biz = data;
      if (!biz) {
        const { data: legacyBiz } = await supabase
          .from('businesses')
          .select('id, owner_id, owner_email, school_domain')
          .eq('owner_email', user.email)
          .maybeSingle();
        biz = legacyBiz;
      }
    }
    if (!biz) return res.status(404).json({ error: 'Business account not found' });
    const normalizedOwnerEmail = String((biz as any).owner_email || '').toLowerCase().trim();
    const normalizedUserEmail = String(user.email || '').toLowerCase().trim();
    if (!(biz as any).owner_id && normalizedOwnerEmail && normalizedOwnerEmail === normalizedUserEmail) {
      await supabase.from('businesses').update({ owner_id: user.id }).eq('id', biz.id);
      (biz as any).owner_id = user.id;
    }
    if ((biz as any).owner_id !== user.id) return res.status(403).json({ error: 'Not authorized for this business.' });
    if (biz.school_domain && submittedDomain !== biz.school_domain) {
      return res.status(400).json({ error: `This email doesn't match your approved school (${biz.school_domain}). Use your ${biz.school_domain} email address.` });
    }
    const verifyCode = generate6DigitCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await supabase.from('businesses').update({
      edu_code: verifyCode,
      edu_code_expires_at: expiresAt,
      school_domain: biz.school_domain || submittedDomain,
      school_email: normalizedSchoolEmail,
      campus_provider: true,
    }).eq('id', biz.id);
    await logAuditEvent(req, 'edu_send_code_business', {
      entity_type: 'business',
      entity_id: biz.id,
      actor_id: user.id,
      actor_email: user.email,
      actor_role: 'business',
      meta: { school_email: normalizedSchoolEmail },
    });
    await sendVerificationEmail(normalizedSchoolEmail, verifyCode, getResend());
    return res.status(200).json({ success: true, message: `Code sent to ${normalizedSchoolEmail}` });
  } else {
    const verifyCode = generate6DigitCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await supabase.from('profiles').update({ school_email: normalizedSchoolEmail, edu_code: verifyCode, edu_code_expires_at: expiresAt }).eq('id', user.id);
    await logAuditEvent(req, 'edu_send_code_consumer', {
      entity_type: 'profile',
      entity_id: user.id,
      actor_id: user.id,
      actor_email: user.email,
      actor_role: 'consumer',
      meta: { school_email: normalizedSchoolEmail },
    });
    await sendVerificationEmail(normalizedSchoolEmail, verifyCode, getResend());
    return res.status(200).json({ success: true, message: `Code sent to ${normalizedSchoolEmail}` });
  }
}

async function sendVerificationEmail(to: string, code: string, resend: Resend) {
  await resend.emails.send({
    from: 'ScheduleMe <notifications@usescheduleme.com>',
    to,
    subject: 'Your ScheduleMe campus verification code',
    html: `<!DOCTYPE html>
<html>
<body style="font-family:Inter,-apple-system,sans-serif;background:#f8fafc;margin:0;padding:40px 16px;">
  <div style="max-width:480px;margin:0 auto;background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div bgcolor="#1d4ed8" style="background:#1d4ed8;padding:28px 32px;text-align:center;">
      <p style="margin:0;font-size:13px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:0.1em;text-transform:uppercase;">ScheduleMe Campus</p>
      <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:white;">Verify your .edu email</h1>
    </div>
    <div style="padding:32px;text-align:center;">
      <p style="margin:0 0 24px;font-size:15px;color:#475569;">Enter this code in the app:</p>
      <div style="background:#f1f5f9;border-radius:12px;padding:20px;margin:0 auto 24px;max-width:240px;">
        <span style="font-size:36px;font-weight:800;color:#0f172a;letter-spacing:0.15em;">${code}</span>
      </div>
      <p style="margin:0;font-size:13px;color:#94a3b8;">Expires in 15 minutes. Don't share this code.</p>
    </div>
  </div>
</body>
</html>`,
  });
}
