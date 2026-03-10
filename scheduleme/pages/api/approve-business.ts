// pages/api/approve-business.ts
// Call this manually (or via n8n) to approve a business and send their welcome email
// Protected by NOTIFY_SECRET so only you can trigger it
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { sendBusinessApprovalEmail } from '../../lib/email';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Protect with your existing secret
  const secret = req.headers['x-notify-secret'];
  if (secret !== process.env.NOTIFY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { businessId } = req.body;
  if (!businessId) return res.status(400).json({ error: 'businessId required' });

  const supabase = getSupabase();

  try {
    // Get business details
    const { data: business, error: fetchError } = await supabase
      .from('businesses')
      .select('id, name, owner_name, owner_email, is_onboarded')
      .eq('id', businessId)
      .single();

    if (fetchError || !business) return res.status(404).json({ error: 'Business not found' });
    if (business.is_onboarded) return res.status(400).json({ error: 'Business already approved' });

    // Mark as onboarded
    await supabase
      .from('businesses')
      .update({ is_onboarded: true })
      .eq('id', businessId);

    // Generate a magic link for them to set up their account
    const { data: magicLinkData, error: magicError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: business.owner_email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/business/dashboard`,
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
