// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import { setSecurityHeaders, rateLimit } from '../../lib/apiSecurity';

const SUPPORT_EMAIL = 'usescheduleme@gmail.com';

function clean(value: unknown, max = 500): string {
  return String(value || '').trim().slice(0, max);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setSecurityHeaders(res);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await rateLimit(req, res, { max: 5, windowMs: 30 * 60_000, keyPrefix: 'concierge-request' }))) {
    return;
  }

  const name = clean(req.body?.name, 80);
  const contact = clean(req.body?.contact, 120);
  const service = clean(req.body?.service, 120);
  const budget = clean(req.body?.budget, 80);
  const timing = clean(req.body?.timing, 120);
  const campus = clean(req.body?.campus, 120);
  const details = clean(req.body?.details, 2500);
  const reference = clean(req.body?.reference, 600);
  const productInterest = clean(req.body?.productInterest, 120);
  const source = clean(req.body?.source, 120) || 'Concierge page';

  if (!name || !contact || !service || !timing || !details) {
    return res.status(400).json({
      error: 'Name, contact info, service, timing, and request details are required.',
    });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return res.status(500).json({ error: 'Concierge inbox is not configured yet.' });
  }

  const requestId = `concierge_${randomUUID().slice(0, 8)}`;
  const submittedAt = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const safeName = escapeHtml(name);
  const safeContact = escapeHtml(contact);
  const safeService = escapeHtml(service);
  const safeBudget = escapeHtml(budget || 'Not specified');
  const safeTiming = escapeHtml(timing);
  const safeCampus = escapeHtml(campus || 'Campus not specified');
  const safeDetails = escapeHtml(details);
  const safeReference = escapeHtml(reference || 'None included');
  const safeProductInterest = escapeHtml(productInterest || 'No preference given');
  const safeSource = escapeHtml(source);
  const safeRequestId = escapeHtml(requestId);
  const safeSubmittedAt = escapeHtml(submittedAt);

  const html = `
    <div style="font-family:Inter,system-ui,-apple-system,sans-serif;max-width:700px;margin:0 auto;padding:28px;background:#f8fafc;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
        <div style="padding:28px 28px 22px;background:linear-gradient(135deg,#0f766e 0%,#0b5c56 100%);color:#ffffff;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;opacity:0.82;">ScheduleMe Concierge</p>
          <h1 style="margin:0;font-size:26px;line-height:1.1;letter-spacing:-0.03em;">New concierge request</h1>
          <p style="margin:10px 0 0;font-size:14px;opacity:0.82;">${safeName} wants help finding a better provider.</p>
        </div>
        <div style="padding:24px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin-bottom:18px;">
            <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Request ID:</strong> ${safeRequestId}</td></tr>
            <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Submitted:</strong> ${safeSubmittedAt}</td></tr>
            <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Name:</strong> ${safeName}</td></tr>
            <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Contact:</strong> ${safeContact}</td></tr>
            <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Requested service:</strong> ${safeService}</td></tr>
            <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Budget:</strong> ${safeBudget}</td></tr>
            <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Timing:</strong> ${safeTiming}</td></tr>
            <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Campus / area:</strong> ${safeCampus}</td></tr>
            <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;"><strong>Preferred future product:</strong> ${safeProductInterest}</td></tr>
            <tr><td style="padding:12px 16px;"><strong>Source:</strong> ${safeSource}</td></tr>
          </table>
          <div style="border:1px solid #e2e8f0;border-radius:14px;padding:16px;background:#fcfcfd;margin-bottom:18px;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#0f766e;">What they want</p>
            <p style="margin:0;white-space:pre-wrap;font-size:15px;line-height:1.65;color:#0f172a;">${safeDetails}</p>
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:14px;padding:16px;background:#fcfcfd;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#0f766e;">Reference link</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">
              ${reference ? `<a href="${reference}" style="color:#0f766e;text-decoration:underline;">${safeReference}</a>` : safeReference}
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ScheduleMe Concierge <notifications@usescheduleme.com>',
        to: SUPPORT_EMAIL,
        reply_to: contact.includes('@') ? contact : undefined,
        subject: `[Concierge] ${service} request from ${name}`,
        html,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return res.status(502).json({ error: `Could not deliver request: ${errText || 'Unknown error'}` });
    }

    return res.status(200).json({ success: true, requestId });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Could not submit concierge request.' });
  }
}
