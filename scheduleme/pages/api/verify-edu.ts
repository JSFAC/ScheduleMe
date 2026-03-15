// pages/api/verify-edu.ts — EDU email verification for campus tab
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { setSecurityHeaders, rateLimit, requireAuth, isValidEmail } from '../../lib/apiSecurity';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

function generate6DigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function extractSchoolDomain(email: string): string | null {
  if (!email.endsWith('.edu')) return null;
  const domain = email.split('@')[1];
  return domain || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);

  // POST /api/verify-edu — send verification code
  if (req.method === 'POST') {
    if (!rateLimit(req, res, { max: 3, windowMs: 10 * 60_000, keyPrefix: 'edu-send' })) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    const { school_email, action } = req.body;

    if (action === 'verify') {
      // Verify a submitted code
      const { code } = req.body;
      if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Code required' });

      const supabase = getSupabase();
      const { data: profile } = await supabase
        .from('profiles')
        .select('edu_code, edu_code_expires_at, school_email')
        .eq('id', user.id)
        .single();

      if (!profile?.edu_code) return res.status(400).json({ error: 'No pending verification. Request a new code.' });
      if (new Date(profile.edu_code_expires_at) < new Date()) return res.status(400).json({ error: 'Code expired. Request a new one.' });
      if (profile.edu_code !== code.trim()) return res.status(400).json({ error: 'Incorrect code. Please try again.' });

      const domain = extractSchoolDomain(profile.school_email);
      await supabase.from('profiles').update({
        edu_verified: true,
        school_name: domain,
        edu_code: null,
        edu_code_expires_at: null,
      }).eq('id', user.id);

      return res.status(200).json({ success: true, school_domain: domain });
    }

    // Send code
    if (!school_email || !isValidEmail(school_email)) return res.status(400).json({ error: 'Valid .edu email required' });
    if (!school_email.endsWith('.edu')) return res.status(400).json({ error: 'Must be a .edu email address' });

    const domain = extractSchoolDomain(school_email);
    if (!domain) return res.status(400).json({ error: 'Invalid .edu email' });

    const code = generate6DigitCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    const supabase = getSupabase();
    await supabase.from('profiles').update({
      school_email,
      edu_code: code,
      edu_code_expires_at: expiresAt,
    }).eq('id', user.id);

    // Send verification email
    try {
      const resend = getResend();
      await resend.emails.send({
        from: 'ScheduleMe <notifications@usescheduleme.com>',
        to: school_email,
        subject: 'Your ScheduleMe campus verification code',
        html: `
<!DOCTYPE html>
<html>
<body style="font-family:Inter,-apple-system,sans-serif;background:#f8fafc;margin:0;padding:40px 16px;">
  <div style="max-width:480px;margin:0 auto;background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#1d4ed8;padding:28px 32px;text-align:center;">
      <p style="margin:0;font-size:13px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:0.1em;text-transform:uppercase;">ScheduleMe Campus</p>
      <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:white;">Verify your .edu email</h1>
    </div>
    <div style="padding:32px;text-align:center;">
      <p style="margin:0 0 24px;font-size:15px;color:#475569;">Enter this code in the app to unlock your campus feed:</p>
      <div style="background:#f1f5f9;border-radius:12px;padding:20px;margin:0 auto 24px;max-width:240px;">
        <span style="font-size:36px;font-weight:800;color:#0f172a;letter-spacing:0.15em;">${code}</span>
      </div>
      <p style="margin:0;font-size:13px;color:#94a3b8;">This code expires in 15 minutes.</p>
    </div>
  </div>
</body>
</html>`,
      });
    } catch (err) {
      console.error('[verify-edu] Email send failed:', err);
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    return res.status(200).json({ success: true, message: `Verification code sent to ${school_email}` });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
