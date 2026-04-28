// @ts-nocheck
// lib/email.ts — Resend email sender with ScheduleMe branded templates
import { Resend } from 'resend';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set.');
  return new Resend(key);
}

const SITE_URL = 'https://usescheduleme.com';
const EMAIL_BG = '#f6f2e9';
const EMAIL_CARD = '#ffffff';
const EMAIL_BORDER = '#d8efe7';
const EMAIL_ACCENT = '#007e6d';
const EMAIL_ACCENT_DARK = '#0f766e';
const EMAIL_ACCENT_SOFT = '#e8f6f1';

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
<body style="margin:0;padding:0;background-color:${EMAIL_BG};font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${EMAIL_BG};">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <!-- Logo -->
        <tr><td style="padding-bottom:28px;text-align:center;">
          <a href="${SITE_URL}" style="text-decoration:none;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td bgcolor="${EMAIL_ACCENT}" style="background:${EMAIL_ACCENT};border-radius:10px;padding:8px 16px;">
                  <span style="font-size:17px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">ScheduleMe</span>
                </td>
              </tr>
            </table>
          </a>
        </td></tr>

        <!-- Main card -->
        <tr><td style="background:${EMAIL_CARD};border-radius:18px;border:1px solid ${EMAIL_BORDER};overflow:hidden;">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:28px 0 8px;text-align:center;">
          <p style="margin:0 0 8px;font-size:13px;color:#7a8a96;line-height:1.6;">
            You received this because you have a ScheduleMe account.
          </p>
          <p style="margin:0;font-size:13px;color:#7a8a96;">
            <a href="${SITE_URL}/account?tab=notifications" style="color:${EMAIL_ACCENT_DARK};text-decoration:underline;">Email preferences</a>
            &nbsp;&middot;&nbsp;
            <a href="${SITE_URL}" style="color:${EMAIL_ACCENT_DARK};text-decoration:underline;">usescheduleme.com</a>
          </p>
          <p style="margin:16px 0 0;font-size:12px;color:#a0b1bb;">&copy; ${new Date().getFullYear()} ScheduleMe. All rights reserved.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
            <div style="width:32px;height:32px;background:${EMAIL_ACCENT_SOFT};border-radius:8px;text-align:center;line-height:32px;">
              <span style="font-size:13px;font-weight:700;color:${EMAIL_ACCENT_DARK};">${m.name.charAt(0)}</span>
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
    <tr><td bgcolor="${EMAIL_ACCENT_DARK}" style="background:${EMAIL_ACCENT_DARK};padding:36px 32px;text-align:center;">
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
          <a href="${SITE_URL}/account" style="display:inline-block;background:${EMAIL_ACCENT};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:8px;">
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
      color: EMAIL_ACCENT_DARK, bg: '#effaf6', border: '#bfe5db', icon: '&#10003;',
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
    <tr><td style="background:${cfg.bg};padding:32px;text-align:center;border-bottom:1px solid ${cfg.border};" bgcolor="${cfg.bg}">
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
          <a href="${SITE_URL}/account" style="display:inline-block;background:${EMAIL_ACCENT};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:8px;">
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
    <tr><td bgcolor="${EMAIL_ACCENT_DARK}" style="background:${EMAIL_ACCENT_DARK};padding:40px 32px;text-align:center;">
      <h1 style="margin:0 0 8px;font-size:23px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">You're all set, ${opts.name}</h1>
      <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.8);">Your account has been created.</p>
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
              <div style="width:32px;height:32px;background:${EMAIL_ACCENT_SOFT};border-radius:8px;text-align:center;line-height:32px;">
                <span style="font-size:13px;font-weight:700;color:${EMAIL_ACCENT_DARK};">${s.num}</span>
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
          <a href="${SITE_URL}/bookings" style="display:inline-block;background:${EMAIL_ACCENT};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:8px;">
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

  return layout('Your ScheduleMe account is ready', body,
    `Your account is set up. Here is how to find a trusted local professional in minutes.`);
}

// ─── Template: password reset ───────────────────────────────────────────────
export function passwordResetHtml(opts: { name: string; resetUrl: string }) {
  const body = `
    <tr><td bgcolor="${EMAIL_ACCENT_DARK}" style="background:${EMAIL_ACCENT_DARK};padding:36px 32px;text-align:center;">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">Reset your password</h1>
      <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.82);">Use the secure link below to set a new password.</p>
    </td></tr>
    <tr><td style="padding:32px;">
      <p style="margin:0 0 14px;font-size:15px;color:#0f172a;">Hi <strong>${opts.name}</strong>,</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7;">
        We received a request to reset your ScheduleMe password. If this was you, continue below.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr><td align="center">
          <a href="${opts.resetUrl}" style="display:inline-block;background:${EMAIL_ACCENT};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:10px;">
            Reset Password →
          </a>
        </td></tr>
      </table>
      <p style="margin:0 0 10px;font-size:13px;color:#64748b;line-height:1.7;">
        If the button does not work, copy and paste this link into your browser:
      </p>
      <p style="margin:0 0 18px;font-size:12px;color:#334155;word-break:break-all;">${opts.resetUrl}</p>
      <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.7;">
        If you did not request this, you can ignore this email. Your password will remain unchanged.
      </p>
    </td></tr>`;
  return layout('Reset your ScheduleMe password', body, 'Reset your password using this secure link.');
}

// ─── Template: new booking notification to business ──────────────────────────
export function newBookingBusinessHtml(opts: {
  businessName: string;
  customerName: string;
  service: string;
  bookingId: string;
  scheduledAt?: string;
  note?: string;
  amountDollars?: string;
}) {
  const dashUrl = `${SITE_URL}/business/dashboard`;
  const body = `
    <tr><td bgcolor="${EMAIL_ACCENT_DARK}" style="background:${EMAIL_ACCENT_DARK};padding:32px;text-align:center;">
      <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#ffffff;">New booking request</h1>
      <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.8);">A customer wants to book ${opts.businessName}</p>
    </td></tr>
    <tr><td style="padding:32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:28px;overflow:hidden;">
        <tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
          <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Customer</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${opts.customerName}</span>
        </td></tr>
        <tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
          <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Service Requested</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${opts.service}</span>
        </td></tr>
        <tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
          <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Date & Time</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${opts.scheduledAt || 'Not specified yet'}</span>
        </td></tr>
        <tr><td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
          <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Booking Note</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${opts.note || 'No note provided'}</span>
        </td></tr>
        <tr><td style="padding:14px 20px;">
          <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Price (incl. protection)</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${opts.amountDollars ? `$${opts.amountDollars}` : 'Pending provider pricing'}</span>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr><td align="center">
          <a href="${dashUrl}" style="display:inline-block;background:${EMAIL_ACCENT};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:8px;">
            View in Dashboard →
          </a>
        </td></tr>
      </table>
      <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;line-height:1.6;">
        Reply to the customer through your dashboard to confirm the booking.
      </p>
    </td></tr>`;
  return layout(`New booking — ${opts.service}`, body, `${opts.customerName} wants to book ${opts.service}`);
}

export function bookingCancelledBusinessHtml(opts: {
  businessName: string;
  customerName: string;
  service: string;
  bookingId: string;
  scheduledAt?: string;
  cancellationReason: string;
  cancelledByLabel?: string;
}) {
  const dashUrl = `${SITE_URL}/business/dashboard`;
  const cancelledBy = opts.cancelledByLabel || `${opts.customerName} (customer)`;
  const body = `
    <tr><td bgcolor="#b91c1c" style="background:#b91c1c;padding:32px;text-align:center;">
      <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#ffffff;">Booking cancelled</h1>
      <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">${cancelledBy} cancelled a booking for ${opts.businessName}</p>
    </td></tr>
    <tr><td style="padding:32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7f7;border-radius:10px;border:1px solid #fecaca;margin-bottom:24px;overflow:hidden;">
        <tr><td style="padding:14px 20px;border-bottom:1px solid #fecaca;">
          <span style="font-size:11px;font-weight:600;color:#b91c1c;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Cancelled by</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${cancelledBy}</span>
        </td></tr>
        <tr><td style="padding:14px 20px;border-bottom:1px solid #fecaca;">
          <span style="font-size:11px;font-weight:600;color:#b91c1c;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Customer</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${opts.customerName}</span>
        </td></tr>
        <tr><td style="padding:14px 20px;border-bottom:1px solid #fecaca;">
          <span style="font-size:11px;font-weight:600;color:#b91c1c;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Service</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${opts.service}</span>
        </td></tr>
        <tr><td style="padding:14px 20px;border-bottom:1px solid #fecaca;">
          <span style="font-size:11px;font-weight:600;color:#b91c1c;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Date & Time</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${opts.scheduledAt || 'Not specified'}</span>
        </td></tr>
        <tr><td style="padding:14px 20px;">
          <span style="font-size:11px;font-weight:600;color:#b91c1c;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Cancellation reason</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${opts.cancellationReason}</span>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center">
          <a href="${dashUrl}" style="display:inline-block;background:#111827;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:8px;">
            View in Dashboard →
          </a>
        </td></tr>
      </table>
    </td></tr>`;
  return layout(`Booking cancelled — ${opts.service}`, body, `${opts.customerName} cancelled ${opts.service}.`);
}

export function bookingCancelledConsumerHtml(opts: {
  name: string;
  businessName: string;
  service: string;
  bookingId: string;
  scheduledAt?: string;
  cancellationReason: string;
  cancelledByLabel: string;
  refundInProgress?: boolean;
}) {
  const bookingsUrl = `${SITE_URL}/bookings`;
  const refundLine = opts.refundInProgress
    ? 'Your service amount refund is now processing and should appear back on your original payment method shortly. The $0.99 protection fee is non-refundable.'
    : 'No payment refund was required for this cancellation.';

  const body = `
    <tr><td bgcolor="#b91c1c" style="background:#b91c1c;padding:32px;text-align:center;">
      <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#ffffff;">Booking cancelled</h1>
      <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">Your ${opts.service} booking has been cancelled.</p>
    </td></tr>
    <tr><td style="padding:32px;">
      <p style="margin:0 0 20px;font-size:15px;color:#0f172a;">Hi <strong>${opts.name}</strong>, here are the details:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7f7;border-radius:10px;border:1px solid #fecaca;margin-bottom:20px;overflow:hidden;">
        <tr><td style="padding:14px 20px;border-bottom:1px solid #fecaca;">
          <span style="font-size:11px;font-weight:600;color:#b91c1c;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Cancelled by</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${opts.cancelledByLabel}</span>
        </td></tr>
        <tr><td style="padding:14px 20px;border-bottom:1px solid #fecaca;">
          <span style="font-size:11px;font-weight:600;color:#b91c1c;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Provider</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${opts.businessName}</span>
        </td></tr>
        <tr><td style="padding:14px 20px;border-bottom:1px solid #fecaca;">
          <span style="font-size:11px;font-weight:600;color:#b91c1c;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Service</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${opts.service}</span>
        </td></tr>
        <tr><td style="padding:14px 20px;border-bottom:1px solid #fecaca;">
          <span style="font-size:11px;font-weight:600;color:#b91c1c;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Date & Time</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${opts.scheduledAt || 'Not specified'}</span>
        </td></tr>
        <tr><td style="padding:14px 20px;border-bottom:1px solid #fecaca;">
          <span style="font-size:11px;font-weight:600;color:#b91c1c;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Cancellation reason</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${opts.cancellationReason || 'Not provided'}</span>
        </td></tr>
        <tr><td style="padding:14px 20px;">
          <span style="font-size:11px;font-weight:600;color:#b91c1c;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:4px;">Refund status</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${refundLine}</span>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center">
          <a href="${bookingsUrl}" style="display:inline-block;background:#111827;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:8px;">
            View my bookings →
          </a>
        </td></tr>
      </table>
    </td></tr>`;
  return layout(`Booking cancelled — ${opts.service}`, body, `Your ${opts.service} booking was cancelled.`);
}

// ─── Template: review request ─────────────────────────────────────────────────
export function reviewRequestHtml(opts: {
  name: string;
  service: string;
  bookingId: string;
}) {
  const reviewUrl = `${SITE_URL}/bookings`;
  const body = `
    <tr><td bgcolor="#ffffff" style="padding:36px 32px;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">⭐</div>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">How did it go?</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#64748b;">Hi ${opts.name}, your <strong style="color:#0f172a;">${opts.service}</strong> has been marked complete. Leave a quick review to help others find great pros.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
        <tr><td bgcolor="${EMAIL_ACCENT}" style="background:${EMAIL_ACCENT};border-radius:12px;">
          <a href="${reviewUrl}" style="display:block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
            Leave a Review →
          </a>
        </td></tr>
      </table>
      <p style="margin:0;font-size:12px;color:#94a3b8;">Takes 30 seconds. Your honest feedback matters.</p>
    </td></tr>`;
  return layout('How did your service go? Leave a review', body, `Your ${opts.service} is complete — leave a quick review.`);
}

// ─── Template: new provider signup alert ─────────────────────────────────
export function newBusinessApplicationHtml(opts: {
  name: string; ownerName: string; email: string; phone: string;
  category: string; city: string; campusProvider: boolean; schoolName?: string;
}) {
  const adminUrl = `${SITE_URL}/admin`;
  const body = `
    <tr><td bgcolor="#0f172a" style="background:#0f172a;padding:28px 32px;">
      <p style="margin:0;font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);letter-spacing:0.12em;text-transform:uppercase;">New Provider Signup</p>
      <h1 style="margin:6px 0 0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">${opts.name}</h1>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:24px;overflow:hidden;">
        ${[
          ['Owner', opts.ownerName],
          ['Email', opts.email],
          ['Phone', opts.phone],
          ['Category', opts.category],
          ['City', opts.city],
          ...(opts.campusProvider ? [['Campus', opts.schoolName || 'Yes']] : []),
        ].map(([label, value], i, arr) => `
        <tr><td style="padding:12px 20px;${i < arr.length - 1 ? 'border-bottom:1px solid #e2e8f0;' : ''}">
          <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:3px;">${label}</span>
          <span style="font-size:14px;font-weight:600;color:#0f172a;">${value}</span>
        </td></tr>`).join('')}
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center">
          <a href="${adminUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px;">
            Open in Admin Panel →
          </a>
        </td></tr>
      </table>
    </td></tr>`;
  return layout(`New provider signup: ${opts.name}`, body, `${opts.ownerName} created a new provider draft profile`);
}

// ─── Template: business change request (admin) ─────────────────────────
export function changeRequestAdminHtml(opts: {
  businessName: string; ownerName: string; ownerEmail: string; changes: Record<string, any>;
  flagged?: boolean; flagReasons?: string[];
}) {
  const adminUrl = `${SITE_URL}/admin`;
  const changesRows = Object.entries(opts.changes || {}).map(([k, v]) => (
    `<tr><td style="padding:10px 20px;border-bottom:1px solid #e2e8f0;">
      <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:3px;">${k.replace(/_/g,' ')}</span>
      <span style="font-size:14px;font-weight:600;color:#0f172a;">${String(v).slice(0, 200)}</span>
    </td></tr>`
  )).join('');

  const body = `
    <tr><td bgcolor="#0f172a" style="background:#0f172a;padding:28px 32px;">
      <p style="margin:0;font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);letter-spacing:0.12em;text-transform:uppercase;">Change Request</p>
      <h1 style="margin:6px 0 0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">${opts.businessName}</h1>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      <p style="margin:0 0 12px;font-size:14px;color:#64748b;">Requested by ${opts.ownerName} (${opts.ownerEmail})</p>
      ${opts.flagged ? `<p style="margin:0 0 12px;font-size:12px;color:#b91c1c;font-weight:700;">Flagged for review: ${(opts.flagReasons || []).join(', ')}</p>` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:20px;overflow:hidden;">
        ${changesRows || '<tr><td style="padding:14px 20px;">No changes listed</td></tr>'}
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center">
          <a href="${adminUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px;">
            Review in Admin Panel →
          </a>
        </td></tr>
      </table>
    </td></tr>`;
  return layout(`Change request: ${opts.businessName}`, body, `${opts.ownerName} requested profile changes`);
}

// ─── Template: change request received (business) ───────────────────────────
export function changeRequestReceiptHtml(opts: {
  businessName: string; ownerName: string; changes: Record<string, any>;
}) {
  const changesList = Object.keys(opts.changes || {}).map(k => `• ${k.replace(/_/g,' ')}`).join('<br/>');
  const body = `
    <tr><td bgcolor="#0f172a" style="background:#0f172a;padding:28px 32px;text-align:center;">
      <p style="margin:0;font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);letter-spacing:0.12em;text-transform:uppercase;">Request Received</p>
      <h1 style="margin:6px 0 0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Thanks, ${opts.ownerName}</h1>
      <p style="margin:10px 0 0;font-size:14px;color:rgba(255,255,255,0.75);">We received your update request for ${opts.businessName}.</p>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      <p style="margin:0 0 12px;font-size:14px;color:#64748b;">We’re reviewing the following changes:</p>
      <div style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:14px 18px;font-size:13px;color:#0f172a;line-height:1.6;">
        ${changesList || 'Your update request'}
      </div>
      <p style="margin:14px 0 0;font-size:13px;color:#94a3b8;">Most reviews are completed within 24 hours.</p>
    </td></tr>`;
  return layout(`We received your update request`, body, `We received your update request for ${opts.businessName}`);
}

// ─── Template: change request decision (business) ────────────────────────────
export function changeRequestDecisionHtml(opts: {
  businessName: string; ownerName: string; approved: boolean; notes?: string;
}) {
  const body = `
    <tr><td style="background:#ffffff;border-radius:16px;padding:36px;border:1px solid #e2e8f0;">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">
        ${opts.approved ? 'Update approved' : 'Update needs changes'}
      </h1>
      <p style="margin:0 0 16px;font-size:15px;color:#64748b;">Hi ${opts.ownerName}, your update request for <strong>${opts.businessName}</strong> was ${opts.approved ? 'approved' : 'rejected'}.</p>
      ${opts.notes ? `<p style="margin:0;font-size:13px;color:#475569;">Notes: ${opts.notes}</p>` : ''}
    </td></tr>`;
  return layout(`Update ${opts.approved ? 'approved' : 'rejected'}`, body, `Your update request was ${opts.approved ? 'approved' : 'rejected'}`);
}

// ─── Template: provider draft created (applicant) ─────────────────────
export function businessApplicationReceivedHtml(opts: {
  businessName: string; ownerName: string; category: string; city: string;
}) {
  const body = `
    <tr><td bgcolor="#0f172a" style="background:#0f172a;padding:32px 32px;text-align:center;">
      <div style="width:56px;height:56px;background:rgba(255,255,255,0.12);border-radius:50%;margin:0 auto 14px;text-align:center;line-height:56px;">
        <span style="font-size:26px;color:#ffffff;">&#10003;</span>
      </div>
      <p style="margin:0;font-size:12px;font-weight:700;color:rgba(255,255,255,0.55);letter-spacing:0.18em;text-transform:uppercase;">Draft Created</p>
      <h1 style="margin:8px 0 0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Your provider profile is ready to finish, ${opts.ownerName}</h1>
      <p style="margin:10px 0 0;font-size:14px;color:rgba(255,255,255,0.75);">Complete setup in your dashboard to publish and start receiving bookings.</p>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      <p style="margin:0 0 16px;font-size:14px;color:#64748b;">Here is what we have on file:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:22px;overflow:hidden;">
        ${[
          ['Provider', opts.businessName],
          ['Category', opts.category],
          ['City', opts.city],
        ].map(([label, value], i, arr) => `
        <tr><td style="padding:12px 20px;${i < arr.length - 1 ? 'border-bottom:1px solid #e2e8f0;' : ''}">
          <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:3px;">${label}</span>
          <span style="font-size:14px;font-weight:600;color:#0f172a;">${value}</span>
        </td></tr>`).join('')}
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;">
        <tr><td style="padding:18px 20px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">What happens next</p>
          <ol style="margin:0;padding-left:18px;color:#0f172a;font-size:14px;line-height:1.7;">
            <li>Sign in and finish your profile details.</li>
            <li>Add at least one service and upload media.</li>
            <li>Connect Stripe to receive payouts.</li>
            <li>Publish instantly once your checklist is complete.</li>
          </ol>
        </td></tr>
      </table>
      <p style="margin:18px 0 0;font-size:13px;color:#94a3b8;">Questions? Reply to this email and we will help right away.</p>
    </td></tr>
  `;
  return layout(`Your provider draft is ready`, body, `Finish setup to publish your ScheduleMe profile`);
}

// ─── Template: provider application rejected (applicant) ────────────────────
export function businessApplicationRejectedHtml(opts: {
  ownerName: string;
  businessName: string;
  reason: string;
}) {
  const safeReason = escapeHtml(opts.reason || '').replace(/\n/g, '<br/>');
  const body = `
    <tr><td bgcolor="#7f1d1d" style="background:#7f1d1d;padding:32px 32px;text-align:center;">
      <div style="width:56px;height:56px;background:rgba(255,255,255,0.12);border-radius:50%;margin:0 auto 14px;text-align:center;line-height:56px;">
        <span style="font-size:24px;color:#ffffff;">!</span>
      </div>
      <p style="margin:0;font-size:12px;font-weight:700;color:rgba(255,255,255,0.55);letter-spacing:0.18em;text-transform:uppercase;">Application Update</p>
      <h1 style="margin:8px 0 0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Action needed for ${opts.businessName}</h1>
      <p style="margin:10px 0 0;font-size:14px;color:rgba(255,255,255,0.78);">Hi ${opts.ownerName}, we could not approve your provider application yet.</p>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      <p style="margin:0 0 10px;font-size:14px;color:#64748b;">Reason from review team:</p>
      <div style="background:#fef2f2;border-radius:10px;border:1px solid #fecaca;padding:14px 18px;font-size:13px;color:#7f1d1d;line-height:1.6;">
        ${safeReason}
      </div>
      <p style="margin:14px 0 0;font-size:13px;color:#94a3b8;">You can fix this and re-apply from the provider signup page.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px auto 0;width:100%;max-width:320px;">
        <tr><td bgcolor="#111827" style="background:#111827;border-radius:12px;text-align:center;">
          <a href="${SITE_URL}/business/signup" style="display:block;padding:15px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Re-apply as provider →</a>
        </td></tr>
      </table>
    </td></tr>
  `;
  return layout('Provider application update', body, `Your provider application for ${opts.businessName} needs changes.`);
}

// ─── Template: featured on ──────────────────────────────────────────────────
export function featuredOnHtml(opts: { businessName: string; durationDays: number }) {
  const body = `
    <tr><td bgcolor="#0f766e" style="background:#0f766e;padding:36px 32px;text-align:center;">
      <div style="width:52px;height:52px;background:rgba(255,255,255,0.2);border-radius:16px;margin:0 auto 16px;text-align:center;line-height:52px;">
        <span style="font-size:22px;color:#ffffff;">★</span>
      </div>
      <h1 style="margin:0 0 8px;font-size:21px;font-weight:800;color:#ffffff;letter-spacing:-0.01em;">You&apos;re featured</h1>
      <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.8);">${opts.businessName} is now featured on your campus feed.</p>
    </td></tr>
    <tr><td style="padding:30px 32px;">
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.7;">
        Your profile is highlighted at the top of the campus marketplace for the next ${opts.durationDays} days. Keep the momentum going.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;">
        <p style="margin:0;font-size:13px;color:#64748b;">
          Tip: Refresh your photos and service list to keep your profile cinematic.
        </p>
      </div>
      <div style="margin-top:22px;text-align:center;">
        <a href="${SITE_URL}/business/dashboard" style="display:inline-block;padding:14px 34px;background:#0f766e;color:#ffffff;border-radius:999px;font-weight:700;text-decoration:none;">View Dashboard</a>
      </div>
    </td></tr>`;
  return layout(`You&apos;re featured on ScheduleMe`, body, `${opts.businessName} is now featured.`);
}

// ─── Template: featured off ─────────────────────────────────────────────────
export function featuredOffHtml(opts: { businessName: string }) {
  const body = `
    <tr><td bgcolor="#111827" style="background:#111827;padding:36px 32px;text-align:center;">
      <div style="width:52px;height:52px;background:rgba(255,255,255,0.12);border-radius:16px;margin:0 auto 16px;text-align:center;line-height:52px;">
        <span style="font-size:20px;color:#ffffff;">✦</span>
      </div>
      <h1 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.01em;">Featured window ended</h1>
      <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.75);">${opts.businessName} is no longer featured on the campus feed.</p>
    </td></tr>
    <tr><td style="padding:30px 32px;">
      <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
        Want to get featured again? Keep the momentum going — complete bookings and stay active.
      </p>
      <div style="margin-top:20px;text-align:center;">
        <a href="${SITE_URL}/business/dashboard" style="display:inline-block;padding:14px 34px;background:#111827;color:#ffffff;border-radius:999px;font-weight:700;text-decoration:none;">Stay Active</a>
      </div>
    </td></tr>`;
  return layout(`Featured window ended`, body, `${opts.businessName} is no longer featured.`);
}

// ─── Send helpers ─────────────────────────────────────────────────────────────
const FROM = 'ScheduleMe <notifications@usescheduleme.com>';

export async function sendBookingConfirmation(opts: {
  to: string; name: string; service: string; urgency: string; location: string;
  matches: Array<{ name: string; rating?: number; distance_miles?: number }>;
}) {
  const resend = getResend();
  return resend.emails.send({ from: FROM, to: opts.to, subject: `Service request confirmed — ${opts.service}`, html: bookingConfirmationHtml(opts) });
}

export async function sendStatusUpdate(opts: {
  to: string; name: string; service: string; status: string; businessName?: string;
}) {
  const resend = getResend();
  return resend.emails.send({ from: FROM, to: opts.to, subject: `Your ${opts.service} booking has been ${opts.status}`, html: statusUpdateHtml(opts) });
}

export async function sendBusinessApprovalEmail(opts: {
  to: string; ownerName: string; businessName: string; magicLink: string; passwordSetupLink?: string;
}) {
  const resend = getResend();
  const encodedEmail = encodeURIComponent(opts.to);
  const googleLoginUrl = `${SITE_URL}/business/auth/login?method=google&email=${encodedEmail}`;
  const passwordSetupUrl = opts.passwordSetupLink || `${SITE_URL}/business/auth/login?setup=password&email=${encodedEmail}`;
  const body = `
    <tr><td style="background:#ffffff;border-radius:16px;padding:40px;border:1px solid #e2e8f0;">
      <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">You&rsquo;re approved! 🎉</h1>
      <p style="margin:0 0 24px;font-size:16px;color:#64748b;">Hi ${opts.ownerName}, <strong style="color:#0f172a;">${opts.businessName}</strong> has been verified and is ready to go live on ScheduleMe.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:12px;margin-bottom:28px;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.06em;">What happens next</p>
          <table role="presentation" cellpadding="0" cellspacing="0">
            ${['Set up your account password or connect Google', 'Connect your bank via Stripe to receive payments', 'Your profile goes live — leads start arriving', 'Complete jobs and get paid (standard fee is 12%, Founder50 is 6%)'].map((step, i) => `
            <tr>
              <td style="padding:6px 0;vertical-align:top;">
                <span style="display:inline-block;width:22px;height:22px;background:${EMAIL_ACCENT_DARK};border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#fff;margin-right:12px;">${i + 1}</span>
              </td>
              <td style="padding:6px 0;font-size:14px;color:#334155;">${step}</td>
            </tr>`).join('')}
          </table>
        </td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;width:100%;max-width:360px;">
        <tr><td bgcolor="${EMAIL_ACCENT_DARK}" style="background:${EMAIL_ACCENT_DARK};border-radius:12px;text-align:center;">
          <a href="${googleLoginUrl}" style="display:block;padding:16px 40px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.01em;">
            Sign In with Google →
          </a>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr>
          <td style="border-bottom:1px solid #e2e8f0;width:40%;"></td>
          <td style="text-align:center;padding:0 12px;font-size:12px;color:#94a3b8;white-space:nowrap;">or</td>
          <td style="border-bottom:1px solid #e2e8f0;width:40%;"></td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;width:100%;max-width:360px;">
        <tr><td style="border:2px solid ${EMAIL_ACCENT_DARK};border-radius:12px;text-align:center;">
          <a href="${passwordSetupUrl}" style="display:block;padding:14px 40px;font-size:15px;font-weight:700;color:${EMAIL_ACCENT_DARK};text-decoration:none;letter-spacing:-0.01em;">
            Create a Password Instead
          </a>
        </td></tr>
      </table>
      <p style="margin:0 0 12px;font-size:12px;color:#94a3b8;text-align:center;">
        Prefer one-tap sign-in? <a href="${opts.magicLink}" style="color:${EMAIL_ACCENT_DARK};">Use this secure link</a>.
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;text-align:center;">Sign-in link expires in 24 hours. If it expires, visit <a href="${SITE_URL}/business/auth/login" style="color:${EMAIL_ACCENT_DARK};">${SITE_URL}/business/auth/login</a></p>
      <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Questions? Reply to this email or contact <a href="mailto:hello@usescheduleme.com" style="color:${EMAIL_ACCENT_DARK};">hello@usescheduleme.com</a></p>
    </td></tr>
  `;
  return resend.emails.send({
    from: FROM, to: opts.to,
    subject: `${opts.businessName} is approved on ScheduleMe`,
    html: layout(`${opts.businessName} is approved`, body, `You're approved! Set up your account and start receiving leads.`),
  });
}

export async function sendNewBusinessApplicationEmail(opts: {
  to: string; name: string; ownerName: string; email: string;
  phone: string; category: string; city: string; campusProvider: boolean; schoolName?: string;
}) {
  const resend = getResend();
  return resend.emails.send({ from: FROM, to: opts.to, subject: `New provider signup: ${opts.name}`, html: newBusinessApplicationHtml(opts) });
}

export async function sendChangeRequestAdminEmail(opts: {
  to: string; businessName: string; ownerName: string; ownerEmail: string; changes: Record<string, any>;
  flagged?: boolean; flagReasons?: string[];
}) {
  const resend = getResend();
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Change request: ${opts.businessName}`,
    html: changeRequestAdminHtml(opts),
  });
}

export async function sendChangeRequestReceiptEmail(opts: {
  to: string; businessName: string; ownerName: string; changes: Record<string, any>;
}) {
  const resend = getResend();
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `We received your update request`,
    html: changeRequestReceiptHtml(opts),
  });
}

export async function sendChangeRequestDecisionEmail(opts: {
  to: string; businessName: string; ownerName: string; approved: boolean; notes?: string;
}) {
  const resend = getResend();
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Your update was ${opts.approved ? 'approved' : 'rejected'}`,
    html: changeRequestDecisionHtml(opts),
  });
}

export async function sendBusinessApplicationReceivedEmail(opts: {
  to: string; ownerName: string; businessName: string; category: string; city: string;
}) {
  const resend = getResend();
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Your provider draft is ready, ${opts.businessName}`,
    html: businessApplicationReceivedHtml({
      businessName: opts.businessName,
      ownerName: opts.ownerName,
      category: opts.category,
      city: opts.city,
    }),
  });
}

export async function sendBusinessApplicationRejectedEmail(opts: {
  to: string; ownerName: string; businessName: string; reason: string;
}) {
  const resend = getResend();
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Provider application update: ${opts.businessName}`,
    html: businessApplicationRejectedHtml(opts),
  });
}

export async function sendFeaturedOnEmail(opts: { to: string; businessName: string; durationDays?: number }) {
  const resend = getResend();
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `You're featured on ScheduleMe`,
    html: featuredOnHtml({ businessName: opts.businessName, durationDays: opts.durationDays ?? 7 }),
  });
}

export async function sendFeaturedOffEmail(opts: { to: string; businessName: string }) {
  const resend = getResend();
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Featured window ended`,
    html: featuredOffHtml({ businessName: opts.businessName }),
  });
}

export async function sendReviewRequestEmail(opts: { to: string; name: string; service: string; bookingId: string }) {
  const resend = getResend();
  return resend.emails.send({ from: FROM, to: opts.to, subject: `How was your ${opts.service}? Leave a review`, html: reviewRequestHtml(opts) });
}

export async function sendStripeAlertEmail(opts: { to: string; subject: string; body: string }) {
  const resend = getResend();
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#0f172a;color:white;border-radius:16px;">
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">Stripe Alert</h1>
      <p style="margin:0 0 12px;font-size:14px;color:#cbd5f5;">${opts.subject}</p>
      <pre style="background:#111827;color:#e2e8f0;padding:14px;border-radius:12px;white-space:pre-wrap;font-size:12px;line-height:1.5;">${opts.body}</pre>
      <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">Sent by ScheduleMe automated monitoring.</p>
    </div>
  `;
  return resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html });
}

export async function sendNewBookingBusinessEmail(opts: {
  to: string; businessName: string; customerName: string; service: string; bookingId: string; scheduledAt?: string; note?: string; amountDollars?: string;
}) {
  const resend = getResend();
  return resend.emails.send({ from: FROM, to: opts.to, subject: `New booking request — ${opts.service}`, html: newBookingBusinessHtml(opts) });
}

export async function sendBookingCancelledBusinessEmail(opts: {
  to: string; businessName: string; customerName: string; service: string; bookingId: string; scheduledAt?: string; cancellationReason: string; cancelledByLabel?: string;
}) {
  const resend = getResend();
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Booking cancelled — ${opts.service}`,
    html: bookingCancelledBusinessHtml(opts),
  });
}

export async function sendBookingCancelledConsumerEmail(opts: {
  to: string; name: string; businessName: string; service: string; bookingId: string; scheduledAt?: string; cancellationReason: string; cancelledByLabel: string; refundInProgress?: boolean;
}) {
  const resend = getResend();
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Booking cancelled — ${opts.service}`,
    html: bookingCancelledConsumerHtml(opts),
  });
}

export async function sendWelcomeEmail(opts: { to: string; name: string }) {
  const resend = getResend();
  return resend.emails.send({ from: FROM, to: opts.to, subject: `Your ScheduleMe account is ready`, html: welcomeHtml({ name: opts.name }) });
}

export async function sendPasswordResetEmail(opts: { to: string; name: string; resetUrl: string }) {
  const resend = getResend();
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: 'Reset your ScheduleMe password',
    html: passwordResetHtml({ name: opts.name, resetUrl: opts.resetUrl }),
  });
}

// ─── Payment Receipt — Customer ──────────────────────────────────────────────
export function paymentReceiptCustomerHtml(opts: {
  name: string; service: string; businessName: string;
  amountDollars: string; scheduledAt?: string; bookingId: string;
}) {
  const body = `
    <tr><td style="background:#ffffff;border-radius:16px;padding:40px;border:1px solid #e2e8f0;">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="display:inline-block;width:60px;height:60px;background:#dcfce7;border-radius:50%;line-height:60px;font-size:28px;margin-bottom:12px;">✓</div>
        <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">Payment confirmed</h1>
        <p style="margin:0;font-size:15px;color:#64748b;">You're all set, ${opts.name}</p>
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;margin-bottom:28px;border:1px solid #e2e8f0;">
        <tr><td style="padding:24px;text-align:center;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Amount paid</p>
          <p style="margin:0;font-size:36px;font-weight:800;color:#0f172a;letter-spacing:-0.03em;">$${opts.amountDollars}</p>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        ${[
          ['Service', opts.service],
          ['Provider', opts.businessName],
          ...(opts.scheduledAt ? [['Scheduled', opts.scheduledAt]] : []),
          ['Booking ID', opts.bookingId.slice(0, 8).toUpperCase()],
        ].map(([label, value]) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;color:#64748b;width:40%;">${label}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:500;">${value}</td>
        </tr>`).join('')}
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;width:100%;max-width:320px;">
        <tr><td bgcolor="${EMAIL_ACCENT}" style="background:${EMAIL_ACCENT};border-radius:12px;text-align:center;">
          <a href="${SITE_URL}/bookings" style="display:block;padding:15px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">View Booking →</a>
        </td></tr>
      </table>
      <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Includes a $0.99 protection fee. Standard provider fee is 12% (Founder50 members are 6%).</p>
    </td></tr>
  `;
  return layout('Payment confirmed', body, `$${opts.amountDollars} payment confirmed for ${opts.service}`);
}

// ─── Payment Notification — Business ─────────────────────────────────────────
export function paymentNotificationBusinessHtml(opts: {
  businessName: string; customerName: string; service: string;
  amountDollars: string; platformFeePercent: number; payoutDollars: string; bookingId: string;
}) {
  const body = `
    <tr><td style="background:#ffffff;border-radius:16px;padding:40px;border:1px solid #e2e8f0;">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="display:inline-block;width:60px;height:60px;background:${EMAIL_ACCENT_SOFT};border-radius:50%;line-height:60px;font-size:28px;margin-bottom:12px;">💳</div>
        <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">Payment received</h1>
        <p style="margin:0;font-size:15px;color:#64748b;">A customer just paid for their booking</p>
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_ACCENT_SOFT};border-radius:12px;margin-bottom:28px;border:1px solid ${EMAIL_BORDER};">
        <tr><td style="padding:24px;text-align:center;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${EMAIL_ACCENT_DARK};text-transform:uppercase;letter-spacing:0.06em;">Your payout</p>
          <p style="margin:0;font-size:36px;font-weight:800;color:${EMAIL_ACCENT_DARK};letter-spacing:-0.03em;">$${opts.payoutDollars}</p>
          <p style="margin:4px 0 0;font-size:12px;color:${EMAIL_ACCENT};">$${opts.amountDollars} total — ${opts.platformFeePercent}% platform fee</p>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        ${[
          ['Service', opts.service],
          ['Customer', opts.customerName],
          ['Booking ID', opts.bookingId.slice(0, 8).toUpperCase()],
        ].map(([label, value]) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;color:#64748b;width:40%;">${label}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:500;">${value}</td>
        </tr>`).join('')}
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;width:100%;max-width:320px;">
        <tr><td bgcolor="${EMAIL_ACCENT}" style="background:${EMAIL_ACCENT};border-radius:12px;text-align:center;">
          <a href="${SITE_URL}/business/dashboard" style="display:block;padding:15px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">View Dashboard →</a>
        </td></tr>
      </table>
      <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Funds will be deposited to your connected bank account within 2 business days via Stripe.</p>
    </td></tr>
  `;
  return layout('Payment received', body, `$${opts.payoutDollars} payout incoming for ${opts.service}`);
}

// ─── Payment Request — Customer ───────────────────────────────────────────────
export function paymentRequestCustomerHtml(opts: {
  name: string; service: string; businessName: string; amountDollars: string; bookingId: string;
}) {
  const body = `
    <tr><td style="background:#ffffff;border-radius:16px;padding:40px;border:1px solid #e2e8f0;">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="display:inline-block;width:60px;height:60px;background:#fef3c7;border-radius:50%;line-height:60px;font-size:28px;margin-bottom:12px;">🔔</div>
        <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">Payment requested</h1>
        <p style="margin:0;font-size:15px;color:#64748b;">${opts.businessName} has set your price</p>
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-radius:12px;margin-bottom:28px;border:1px solid #fde68a;">
        <tr><td style="padding:24px;text-align:center;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.06em;">Amount due</p>
          <p style="margin:0;font-size:36px;font-weight:800;color:#92400e;letter-spacing:-0.03em;">$${opts.amountDollars}</p>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        ${[
          ['Service', opts.service],
          ['Provider', opts.businessName],
          ['Booking ID', opts.bookingId.slice(0, 8).toUpperCase()],
        ].map(([label, value]) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;color:#64748b;width:40%;">${label}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:500;">${value}</td>
        </tr>`).join('')}
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;width:100%;max-width:320px;">
        <tr><td bgcolor="${EMAIL_ACCENT}" style="background:${EMAIL_ACCENT};border-radius:12px;text-align:center;">
          <a href="${SITE_URL}/bookings" style="display:block;padding:15px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Pay Now →</a>
        </td></tr>
      </table>
      <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Payment is secured by Stripe. Your booking will be confirmed once paid.</p>
    </td></tr>
  `;
  return layout('Payment requested', body, `$${opts.amountDollars} payment requested for ${opts.service}`);
}

// ─── Customer Proposed Price — Business ──────────────────────────────────────
export function customerProposedPriceBusinessHtml(opts: {
  businessName: string; customerName: string; service: string; amountDollars: string; bookingId: string;
  scheduledAt?: string;
  note?: string;
}) {
  const body = `
    <tr><td style="background:#ffffff;border-radius:16px;padding:36px;border:1px solid #e2e8f0;">
      <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">Customer proposed a price</h1>
      <p style="margin:0 0 18px;font-size:15px;color:#64748b;">${opts.customerName} suggested a price for ${opts.service}.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf3;border-radius:12px;margin-bottom:20px;border:1px solid #bbf7d0;">
        <tr><td style="padding:20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:0.08em;">Proposed amount</p>
          <p style="margin:0;font-size:30px;font-weight:800;color:#065f46;">$${opts.amountDollars}</p>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        ${[
          ['Service', opts.service],
          ['Customer', opts.customerName],
          ['Date & Time', opts.scheduledAt || 'Not specified'],
          ['Booking Note', opts.note || 'No note provided'],
          ['Booking ID', opts.bookingId.slice(0, 8).toUpperCase()],
        ].map(([label, value]) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:600;color:#64748b;width:40%;">${label}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:500;">${value}</td>
        </tr>`).join('')}
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;width:100%;max-width:320px;">
        <tr><td bgcolor="${EMAIL_ACCENT}" style="background:${EMAIL_ACCENT};border-radius:12px;text-align:center;">
          <a href="${SITE_URL}/business/dashboard" style="display:block;padding:14px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Review booking →</a>
        </td></tr>
      </table>
    </td></tr>
  `;
  return layout('Customer proposed a price', body, `$${opts.amountDollars} proposed for ${opts.service}`);
}

// ─── Provider Accepted Customer Price — Customer ─────────────────────────────
export function providerAcceptedCustomerPriceHtml(opts: {
  name: string; service: string; businessName: string; amountDollars: string; bookingId: string;
}) {
  const body = `
    <tr><td style="background:#ffffff;border-radius:16px;padding:36px;border:1px solid #e2e8f0;">
      <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">Your price was accepted</h1>
      <p style="margin:0 0 18px;font-size:15px;color:#64748b;">${opts.businessName} accepted your proposed price.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf3;border-radius:12px;margin-bottom:20px;border:1px solid #bbf7d0;">
        <tr><td style="padding:20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:0.08em;">Accepted amount</p>
          <p style="margin:0;font-size:30px;font-weight:800;color:#065f46;">$${opts.amountDollars}</p>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        ${[
          ['Service', opts.service],
          ['Provider', opts.businessName],
          ['Booking ID', opts.bookingId.slice(0, 8).toUpperCase()],
        ].map(([label, value]) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:600;color:#64748b;width:40%;">${label}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:500;">${value}</td>
        </tr>`).join('')}
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;width:100%;max-width:320px;">
        <tr><td bgcolor="${EMAIL_ACCENT}" style="background:${EMAIL_ACCENT};border-radius:12px;text-align:center;">
          <a href="${SITE_URL}/bookings" style="display:block;padding:14px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">View booking →</a>
        </td></tr>
      </table>
    </td></tr>
  `;
  return layout('Price accepted', body, `$${opts.amountDollars} accepted for ${opts.service}`);
}

// ─── Customer Accepted Provider Price — Business ─────────────────────────────
export function customerAcceptedProviderPriceHtml(opts: {
  businessName: string; amountDollars: string; bookingId: string;
}) {
  const body = `
    <tr><td style="background:#ffffff;border-radius:16px;padding:36px;border:1px solid #e2e8f0;">
      <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">Customer accepted your price</h1>
      <p style="margin:0 0 18px;font-size:15px;color:#64748b;">The customer accepted your proposed price.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf3;border-radius:12px;margin-bottom:20px;border:1px solid #bbf7d0;">
        <tr><td style="padding:20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:0.08em;">Accepted amount</p>
          <p style="margin:0;font-size:30px;font-weight:800;color:#065f46;">$${opts.amountDollars}</p>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        ${[
          ['Booking ID', opts.bookingId.slice(0, 8).toUpperCase()],
        ].map(([label, value]) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:600;color:#64748b;width:40%;">${label}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:500;">${value}</td>
        </tr>`).join('')}
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;width:100%;max-width:320px;">
        <tr><td bgcolor="${EMAIL_ACCENT}" style="background:${EMAIL_ACCENT};border-radius:12px;text-align:center;">
          <a href="${SITE_URL}/business/dashboard" style="display:block;padding:14px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">View booking →</a>
        </td></tr>
      </table>
    </td></tr>
  `;
  return layout('Price accepted by customer', body, `$${opts.amountDollars} accepted by customer`);
}

export async function sendPaymentReceiptCustomer(opts: {
  to: string; name: string; service: string; businessName: string;
  amountDollars: string; scheduledAt?: string; bookingId: string;
}) {
  const resend = getResend();
  return resend.emails.send({ from: FROM, to: opts.to, subject: `Payment confirmed — $${opts.amountDollars} for ${opts.service}`, html: paymentReceiptCustomerHtml(opts) });
}

export async function sendPaymentNotificationBusiness(opts: {
  to: string; businessName: string; customerName: string; service: string;
  amountDollars: string; platformFeePercent: number; payoutDollars: string; bookingId: string;
}) {
  const resend = getResend();
  return resend.emails.send({ from: FROM, to: opts.to, subject: `Payment received — $${opts.payoutDollars} payout incoming`, html: paymentNotificationBusinessHtml(opts) });
}

export async function sendPaymentRequestCustomer(opts: {
  to: string; name: string; service: string; businessName: string;
  amountDollars: string; bookingId: string;
}) {
  const resend = getResend();
  return resend.emails.send({ from: FROM, to: opts.to, subject: `Payment requested — $${opts.amountDollars} due for ${opts.service}`, html: paymentRequestCustomerHtml(opts) });
}

// ─── Price Dispute Submitted — Customer ──────────────────────────────────────
export function priceDisputeSubmittedHtml(opts: {
  name: string; service: string; businessName: string; amountDollars: string; bookingId: string;
}) {
  const body = `
    <tr><td style="background:#ffffff;border-radius:16px;padding:36px;border:1px solid #e2e8f0;">
      <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">Price dispute submitted</h1>
      <p style="margin:0 0 18px;font-size:15px;color:#64748b;">We sent your proposed price to ${opts.businessName}. We’ll notify you when they respond.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border-radius:12px;margin-bottom:20px;border:1px solid #fdba74;">
        <tr><td style="padding:20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#9a3412;text-transform:uppercase;letter-spacing:0.08em;">Your proposed price</p>
          <p style="margin:0;font-size:30px;font-weight:800;color:#9a3412;">$${opts.amountDollars}</p>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        ${[
          ['Service', opts.service],
          ['Provider', opts.businessName],
          ['Booking ID', opts.bookingId.slice(0, 8).toUpperCase()],
        ].map(([label, value]) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:600;color:#64748b;width:40%;">${label}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:500;">${value}</td>
        </tr>`).join('')}
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;width:100%;max-width:320px;">
        <tr><td bgcolor="${EMAIL_ACCENT}" style="background:${EMAIL_ACCENT};border-radius:12px;text-align:center;">
          <a href="${SITE_URL}/bookings" style="display:block;padding:14px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">View booking →</a>
        </td></tr>
      </table>
    </td></tr>
  `;
  return layout('Price dispute submitted', body, `$${opts.amountDollars} proposed for ${opts.service}`);
}

export async function sendPriceDisputeSubmitted(opts: {
  to: string; name: string; service: string; businessName: string; amountDollars: string; bookingId: string;
}) {
  const resend = getResend();
  return resend.emails.send({ from: FROM, to: opts.to, subject: `Price dispute submitted — $${opts.amountDollars} proposed`, html: priceDisputeSubmittedHtml(opts) });
}

export async function sendCustomerProposedPriceBusiness(opts: {
  to: string; businessName: string; customerName: string; service: string; amountDollars: string; bookingId: string;
  scheduledAt?: string;
  note?: string;
}) {
  const resend = getResend();
  return resend.emails.send({ from: FROM, to: opts.to, subject: `Customer proposed $${opts.amountDollars} for ${opts.service}`, html: customerProposedPriceBusinessHtml(opts) });
}

export async function sendProviderAcceptedCustomerPrice(opts: {
  to: string; name: string; service: string; businessName: string; amountDollars: string; bookingId: string;
}) {
  const resend = getResend();
  return resend.emails.send({ from: FROM, to: opts.to, subject: `Your price was accepted — $${opts.amountDollars} for ${opts.service}`, html: providerAcceptedCustomerPriceHtml(opts) });
}

export async function sendCustomerAcceptedProviderPrice(opts: {
  to: string; businessName: string; amountDollars: string; bookingId: string;
}) {
  const resend = getResend();
  return resend.emails.send({ from: FROM, to: opts.to, subject: `Customer accepted your price — $${opts.amountDollars}`, html: customerAcceptedProviderPriceHtml(opts) });
}
