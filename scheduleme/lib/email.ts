// lib/email.ts — Resend email sender with ScheduleMe branded templates
import { Resend } from 'resend';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set.');
  return new Resend(key);
}

const SITE_URL = 'https://usescheduleme.com';

// ─── Shared layout ──────────────────────────────────────────────────────────
function layout(title: string, body: string, preheader: string = '') {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <!-- Logo -->
        <tr><td style="padding-bottom:28px;text-align:center;">
          <a href="${SITE_URL}" style="text-decoration:none;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background:#1e40af;border-radius:10px;padding:8px 16px;">
                  <span style="font-size:17px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">ScheduleMe</span>
                </td>
              </tr>
            </table>
          </a>
        </td></tr>

        <!-- Main card -->
        <tr><td style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:28px 0 8px;text-align:center;">
          <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;line-height:1.6;">
            You received this because you have a ScheduleMe account.
          </p>
          <p style="margin:0;font-size:13px;color:#94a3b8;">
            <a href="${SITE_URL}/account?tab=notifications" style="color:#64748b;text-decoration:underline;">Email preferences</a>
            &nbsp;&middot;&nbsp;
            <a href="${SITE_URL}" style="color:#64748b;text-decoration:underline;">usescheduleme.com</a>
          </p>
          <p style="margin:16px 0 0;font-size:12px;color:#cbd5e1;">&copy; ${new Date().getFullYear()} ScheduleMe. All rights reserved.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Template: booking confirmation ─────────────────────────────────────────
export function bookingConfirmationHtml(opts: {
  name: string;
  service: string;
  urgency: string;
  location: string;
  matches: Array<{ name: string; rating?: number; distance_miles?: number }>;
}) {
  const urgencyColor = opts.urgency?.toLowerCase() === 'high' || opts.urgency?.toLowerCase() === 'emergency'
    ? '#dc2626' : opts.urgency?.toLowerCase() === 'medium' ? '#d97706' : '#16a34a';

  const matchRows = opts.matches.slice(0, 3).map((m, i) => `
    <tr>
      <td style="padding:14px 20px;${i < Math.min(opts.matches.length, 3) - 1 ? 'border-bottom:1px solid #f1f5f9;' : ''}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="width:36px;vertical-align:middle;">
            <div style="width:32px;height:32px;background:#dbeafe;border-radius:8px;text-align:center;line-height:32px;">
              <span style="font-size:13px;font-weight:700;color:#1d4ed8;">${m.name.charAt(0)}</span>
            </div>
          </td>
          <td style="padding-left:12px;vertical-align:middle;">
            <span style="font-size:14px;font-weight:600;color:#0f172a;">${m.name}</span>
            ${m.rating ? `<span style="font-size:12px;color:#f59e0b;margin-left:6px;">&#9733; ${m.rating}</span>` : ''}
            ${m.distance_miles ? `<span style="font-size:12px;color:#94a3b8;margin-left:6px;">&middot; ${m.distance_miles.toFixed(1)} mi</span>` : ''}
          </td>
          ${i === 0 ? `<td style="text-align:right;vertical-align:middle;white-space:nowrap;"><span style="font-size:11px;font-weight:600;color:#16a34a;background:#dcfce7;padding:3px 8px;border-radius:20px;">Best Match</span></td>` : '<td></td>'}
        </tr></table>
      </td>
    </tr>`).join('');

  const body = `
    <tr><td style="background:linear-gradient(160deg,#1e40af 0%,#2563eb 100%);padding:36px 32px;text-align:center;">
      <div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:50%;margin:0 auto 16px;text-align:center;line-height:48px;">
        <span style="font-size:22px;color:#ffffff;">&#10003;</span>
      </div>
      <h1 style="margin:0 0 6px;font-size:21px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">Your request is confirmed</h1>
      <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.75);">We&apos;re connecting you with qualified local professionals</p>
    </td></tr>
    <tr><td style="padding:32px;">
      <p style="margin:0 0 6px;font-size:15px;color:#0f172a;">Hi <strong>${opts.name}</strong>,</p>
      <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;">
        Your service request has been received. Here&apos;s a summary of what we have on file:
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:28px;overflow:hidden;">
        <tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
          <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Service Requested</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${opts.service}</span>
        </td></tr>
        <tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
          <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Priority</span>
          <span style="font-size:14px;font-weight:600;color:${urgencyColor};">${opts.urgency}</span>
        </td></tr>
        <tr><td style="padding:14px 20px;">
          <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Service Area</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${opts.location}</span>
        </td></tr>
      </table>

      ${opts.matches.length > 0 ? `
      <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#0f172a;text-transform:uppercase;letter-spacing:0.06em;">Professionals Notified</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:28px;">
        ${matchRows}
      </table>` : ''}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr><td align="center">
          <a href="${SITE_URL}/account" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:8px;">
            View My Bookings &rarr;
          </a>
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #f1f5f9;padding-top:20px;">
        <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.7;">
          The professionals listed above have been notified and will reach out to you directly to discuss scheduling and pricing.
        </p>
      </td></tr></table>
    </td></tr>`;

  return layout(
    'Service Request Confirmed — ScheduleMe',
    body,
    `Your ${opts.service} request is confirmed. We have notified professionals in ${opts.location}.`
  );
}

// ─── Template: status update ─────────────────────────────────────────────────
export function statusUpdateHtml(opts: {
  name: string;
  service: string;
  status: string;
  businessName?: string;
}) {
  const statusConfig: Record<string, { color: string; bg: string; border: string; icon: string; headline: string; message: string }> = {
    confirmed: {
      color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', icon: '&#10003;',
      headline: 'Your booking has been confirmed',
      message: 'A professional has reviewed your request and confirmed the booking. They will be in touch to finalize the details.'
    },
    completed: {
      color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', icon: '&#10003;',
      headline: 'Service completed',
      message: 'Your service has been marked as completed. We hope everything went smoothly.'
    },
    cancelled: {
      color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', icon: '&#10005;',
      headline: 'Booking cancelled',
      message: 'Your booking has been cancelled. If this was unexpected, please contact us or submit a new request.'
    },
  };
  const cfg = statusConfig[opts.status] || {
    color: '#92400e', bg: '#fffbeb', border: '#fde68a', icon: '&#9679;',
    headline: 'Booking status updated',
    message: 'There has been an update to your booking. Please check your account for details.'
  };

  const body = `
    <tr><td style="background:${cfg.bg};padding:32px;text-align:center;border-bottom:1px solid ${cfg.border};">
      <div style="width:48px;height:48px;background:${cfg.color};border-radius:50%;margin:0 auto 16px;text-align:center;line-height:48px;">
        <span style="font-size:20px;color:#ffffff;">${cfg.icon}</span>
      </div>
      <h1 style="margin:0;font-size:20px;font-weight:700;color:${cfg.color};">${cfg.headline}</h1>
    </td></tr>
    <tr><td style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;color:#0f172a;">Hi <strong>${opts.name}</strong>,</p>
      <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;">${cfg.message}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:28px;overflow:hidden;">
        <tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
          <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Service</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${opts.service}</span>
        </td></tr>
        ${opts.businessName ? `<tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
          <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Professional</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${opts.businessName}</span>
        </td></tr>` : ''}
        <tr><td style="padding:14px 20px;">
          <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Status</span>
          <span style="font-size:14px;font-weight:700;color:${cfg.color};text-transform:capitalize;">${opts.status}</span>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center">
          <a href="${SITE_URL}/account" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:8px;">
            View My Account &rarr;
          </a>
        </td></tr>
      </table>
    </td></tr>`;

  return layout(`Booking ${opts.status} — ScheduleMe`, body,
    `Update on your ${opts.service} booking: status is now ${opts.status}.`);
}

// ─── Template: welcome email ──────────────────────────────────────────────────
export function welcomeHtml(opts: { name: string }) {
  const steps = [
    { num: '1', title: 'Describe your issue', desc: 'Tell us what you need in plain language. No technical knowledge required.' },
    { num: '2', title: 'We find the right pros', desc: 'Our system identifies your service type and finds vetted professionals nearby.' },
    { num: '3', title: 'Get contacted directly', desc: 'Matched pros reach out to discuss scheduling, pricing, and next steps.' },
  ];

  const body = `
    <tr><td style="background:linear-gradient(160deg,#1e40af 0%,#2563eb 100%);padding:40px 32px;text-align:center;">
      <h1 style="margin:0 0 8px;font-size:23px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">Welcome to ScheduleMe</h1>
      <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.8);">Good to have you, ${opts.name}.</p>
    </td></tr>
    <tr><td style="padding:32px;">
      <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;">
        ScheduleMe connects you with trusted local service professionals — fast. Just describe your problem and we handle the matching.
      </p>

      <p style="margin:0 0 14px;font-size:12px;font-weight:600;color:#0f172a;text-transform:uppercase;letter-spacing:0.06em;">How it works</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
        ${steps.map((s, i) => `
        <tr><td style="padding:14px 0;${i < steps.length - 1 ? 'border-bottom:1px solid #f1f5f9;' : ''}">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:top;width:32px;">
              <div style="width:32px;height:32px;background:#dbeafe;border-radius:8px;text-align:center;line-height:32px;">
                <span style="font-size:13px;font-weight:700;color:#1d4ed8;">${s.num}</span>
              </div>
            </td>
            <td style="padding-left:14px;vertical-align:top;">
              <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#0f172a;">${s.title}</p>
              <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">${s.desc}</p>
            </td>
          </tr></table>
        </td></tr>`).join('')}
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr><td align="center">
          <a href="${SITE_URL}/bookings" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:8px;">
            Find a Professional &rarr;
          </a>
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #f1f5f9;padding-top:20px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.7;">
          Questions? Just reply to this email and we will get back to you.
        </p>
      </td></tr></table>
    </td></tr>`;

  return layout('Welcome to ScheduleMe', body,
    `Hi ${opts.name}, welcome to ScheduleMe. Find trusted local professionals in minutes.`);
}

// ─── Send helpers ─────────────────────────────────────────────────────────────

const FROM = 'ScheduleMe <notifications@usescheduleme.com>';

export async function sendBookingConfirmation(opts: {
  to: string;
  name: string;
  service: string;
  urgency: string;
  location: string;
  matches: Array<{ name: string; rating?: number; distance_miles?: number }>;
}) {
  const resend = getResend();
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Service request confirmed — ${opts.service}`,
    html: bookingConfirmationHtml(opts),
  });
}

export async function sendStatusUpdate(opts: {
  to: string;
  name: string;
  service: string;
  status: string;
  businessName?: string;
}) {
  const resend = getResend();
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Your ${opts.service} booking has been ${opts.status}`,
    html: statusUpdateHtml(opts),
  });
}

export async function sendWelcomeEmail(opts: { to: string; name: string }) {
  const resend = getResend();
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Welcome to ScheduleMe, ${opts.name}`,
    html: welcomeHtml({ name: opts.name }),
  });
}