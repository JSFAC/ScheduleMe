// pages/api/approve-business.ts
// Call this manually (or via n8n) to approve a business and send their welcome email
// Admin-only endpoint
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { sendBusinessApprovalEmail } from '../../lib/email';
import { setSecurityHeaders, rateLimit, logAuditEvent, requireAdmin } from '../../lib/apiSecurity';
import { isFounder50CampusAllowed } from '../../lib/founder50Policy';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function normalizeCampusKey(name?: string | null): string | null {
  if (!name) return null;
  const cleaned = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const key = cleaned ? cleaned.replace(/\s+/g, '_') : null;
  if (!key) return null;
  if (key === 'uc_santa_cruz' || key === 'ucsc') return 'ucsc';
  if (key === 'arizona_state_university' || key === 'asu') return 'asu';
  return key;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (!(await rateLimit(req, res, { max: 20, windowMs: 60_000, keyPrefix: 'approve' }))) return;

  const { businessId, schoolDomain } = req.body;
  if (!businessId) return res.status(400).json({ error: 'businessId required' });

  const supabase = getSupabase();

  try {
    // Get business details
    const { data: business, error: fetchError } = await supabase
      .from('businesses')
      .select('id, name, owner_name, owner_email, is_onboarded, campus_provider, campus_school_name, campus_key, founder50')
      .eq('id', businessId)
      .single();

    if (fetchError || !business) return res.status(404).json({ error: 'Business not found' });
    if (business.is_onboarded) return res.status(400).json({ error: 'Business already approved' });

    // Mark as onboarded — store school_domain but do NOT set edu_verified yet.
    // The business owner must self-verify with their actual .edu email from the dashboard.
    // This prevents fake campus listings where someone just typed a school name on the form.
    const updatePayload: any = { is_onboarded: true, approved_at: new Date().toISOString() };
    if (schoolDomain && typeof schoolDomain === 'string' && schoolDomain.endsWith('.edu')) {
      updatePayload.school_domain = schoolDomain.toLowerCase().trim();
      updatePayload.edu_verified = false; // explicitly false until they self-verify
    }

    // Founder50 assignment happens at approval time (if campus-linked, campus is allowed, and under 50).
    // Campus allowlist is stored in Supabase table founder50_allowed_campuses.
    const founder50CampusAllowed = await isFounder50CampusAllowed(supabase, {
      campusKey: business.campus_key,
      campusSchoolName: business.campus_school_name,
    });
    if (!business.founder50 && business.campus_provider && business.campus_school_name && founder50CampusAllowed) {
      const campusKey = business.campus_key || normalizeCampusKey(business.campus_school_name);
      if (campusKey) {
        updatePayload.campus_key = campusKey;
        try {
          const { data: founderRow, error: founderErr } = await supabase
            .from('campus_founder50')
            .select('founder_count')
            .eq('campus_key', campusKey)
            .maybeSingle();
          if (!founderErr) {
            const currentCount = founderRow?.founder_count ?? 0;
            if (currentCount < 50) {
              updatePayload.founder50 = true;
              updatePayload.founder50_status = 'active';
              await supabase.from('campus_founder50').upsert({
                campus_key: campusKey,
                founder_count: currentCount + 1,
              }, { onConflict: 'campus_key' });
            }
          }
        } catch (err) {
          console.warn('[approve-business] founder50 assignment failed', err);
        }
      }
    }
    await supabase.from('businesses').update(updatePayload).eq('id', businessId);
    await logAuditEvent(req, 'admin_approve_business', {
      entity_type: 'business',
      entity_id: businessId,
      actor_role: 'admin',
      meta: { campus_key: updatePayload.campus_key || null, founder50: updatePayload.founder50 || false },
    });

    // Set role=business in profiles so dashboard auth gate works
    await supabase
      .from('profiles')
      .update({ role: 'business' })
      .eq('email', business.owner_email);

    // Generate a magic link for them to set up their account
    const { data: magicLinkData, error: magicError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: business.owner_email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/business/dashboard?onboard=stripe`,
      },
    });

    if (magicError || !magicLinkData) {
      console.error('[approve-business] Magic link error:', magicError);
      return res.status(500).json({ error: 'Failed to generate magic link' });
    }

    // Send approval email with magic link
    await sendBusinessApprovalEmail({
      to: business.owner_email,
      ownerName: business.owner_name ?? 'there',
      businessName: business.name,
      magicLink: magicLinkData.properties?.action_link ?? `${process.env.NEXT_PUBLIC_SITE_URL}/business/auth/login`,
    });

    console.log(`[approve-business] Approved ${business.name} (${business.owner_email})`);

    return res.status(200).json({
      success: true,
      message: `${business.name} approved and email sent to ${business.owner_email}`,
    });
  } catch (err) {
    console.error('[approve-business] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
