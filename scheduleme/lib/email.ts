// lib/email.ts — Resend email sender with ScheduleMe branded templates
import { Resend } from 'resend';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set.');
  return new Resend(key);
}

// ─── Shared layout ──────────────────────────────────────────────────────────
function layout(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Logo -->
        <tr><td style="padding-bottom:24px;text-align:center;">
          <span style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.03em;">ScheduleMe</span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            © ${new Date().getFullYear()} ScheduleMe · You're receiving this because you have an account.<br/>
            <a href="https://usescheduleme.vercel.app/account?tab=notifications" style="color:#9ca3af;">Manage notifications</a>
          </p>
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
  const matchRows = opts.matches.slice(0, 3).map(m => `
    <tr>
      <td style="padding:12px 24px;border-bottom:1px solid #f3f4f6;">
        <span style="font-size:14px;font-weight:600;color:#111827;">${m.name}</span>
        ${m.rating ? `<span style="font-size:12px;color:#6b7280;margin-left:8px;">⭐ ${m.rating}</span>` : ''}
        ${m.distance_miles ? `<span style="font-size:12px;color:#6b7280;margin-left:8px;">· ${m.distance_miles.toFixed(1)} mi</span>` : ''}
      </td>
    </tr>`).join('');

  const body = `
    <!-- Header band -->
    <tr><td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px 24px;text-align:center;">
      <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
        <span style="font-size:28px;">✅</span>
      </div>
      <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Request Received!</h1>
      <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">We're matching you with the best local pros</p>
    </td></tr>

    <!-- Body -->
    <tr><td style="padding:28px 24px;">
      <p style="margin:0 0 20px;font-size:15px;color:#374151;">Hi <strong>${opts.name}</strong>,</p>
      <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
        Your service request has been submitted. Here's a summary:
      </p>

      <!-- Summary box -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:24px;">
        <tr><td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
          <span style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Service</span><br/>
          <span style="font-size:15px;font-weight:600;color:#111827;margin-top:2px;display:block;">${opts.service}</span>
        </td></tr>
        <tr><td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
          <span style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Urgency</span><br/>
          <span style="font-size:15px;font-weight:600;color:#111827;margin-top:2px;display:block;">${opts.urgency}</span>
        </td></tr>
        <tr><td style="padding:16px 20px;">
          <span style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Location</span><br/>
          <span style="font-size:15px;font-weight:600;color:#111827;margin-top:2px;display:block;">${opts.location}</span>
        </td></tr>
      </table>

      ${opts.matches.length > 0 ? `
      <!-- Matches -->
      <p style="font-size:13px;font-weight:700;color:#111827;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;">Matched Pros</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:24px;">
        ${matchRows}
      </table>` : ''}

      <!-- CTA -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center" style="padding-top:8px;">
          <a href="https://usescheduleme.vercel.app/account" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;">
            View My Bookings →
          </a>
        </td></tr>
      </table>

      <p style="margin:24px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
        Pros in your area have been notified. You can expect to hear back shortly. If you have any questions, reply to this email.
      </p>
    </td></tr>`;

  return layout('Your ScheduleMe Request — Confirmation', body);
}

// ─── Template: status update ─────────────────────────────────────────────────
export function statusUpdateHtml(opts: {
  name: string;
  service: string;
  status: string;
  businessName?: string;
}) {
  const statusConfig: Record<string, { color: string; bg: string; emoji: string; message: string }> = {
    confirmed: { color: '#1d4ed8', bg: '#eff6ff', emoji: '🎉', message: 'Great news — a pro has confirmed your request!' },
    completed: { color: '#15803d', bg: '#f0fdf4', emoji: '✅', message: 'Your service has been marked as completed.' },
    cancelled: { color: '#b91c1c', bg: '#fef2f2', emoji: '❌', message: 'Your booking has been cancelled.' },
  };
  const cfg = statusConfig[opts.status] || { color: '#92400e', bg: '#fffbeb', emoji: '🔔', message: 'Your booking status has been updated.' };

  const body = `
    <tr><td style="background:${cfg.bg};padding:28px 24px;text-align:center;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:40px;margin-bottom:12px;">${cfg.emoji}</div>
      <h1 style="margin:0;font-size:20px;font-weight:800;color:${cfg.color};">${cfg.message}</h1>
    </td></tr>
    <tr><td style="padding:28px 24px;">
      <p style="margin:0 0 16px;font-size:15px;color:#374151;">Hi <strong>${opts.name}</strong>,</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:24px;">
        <tr><td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
          <span style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Service</span><br/>
          <span style="font-size:15px;font-weight:600;color:#111827;">${opts.service}</span>
        </td></tr>
        ${opts.businessName ? `<tr><td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
          <span style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Business</span><br/>
          <span style="font-size:15px;font-weight:600;color:#111827;">${opts.businessName}</span>
        </td></tr>` : ''}
        <tr><td style="padding:16px 20px;">
          <span style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Status</span><br/>
          <span style="font-size:15px;font-weight:700;color:${cfg.color};text-transform:capitalize;">${opts.status}</span>
        </td></tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center">
          <a href="https://usescheduleme.vercel.app/account" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;">
            View My Account →
          </a>
        </td></tr>
      </table>
    </td></tr>`;

  return layout(`Booking Update — ${opts.status}`, body);
}

// ─── Template: welcome email ──────────────────────────────────────────────────
export function welcomeHtml(opts: { name: string }) {
  const body = `
    <tr><td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:40px 24px;text-align:center;">
      <h1 style="margin:0;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.03em;">Welcome to ScheduleMe 👋</h1>
      <p style="margin:10px 0 0;font-size:15px;color:rgba(255,255,255,0.8);">You're all set, ${opts.name}.</p>
    </td></tr>
    <tr><td style="padding:32px 24px;">
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
        ScheduleMe connects you with vetted local service professionals in seconds — just describe your issue in plain language and we'll match you with the right pro.
      </p>
      <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.7;">Here's how it works:</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        ${[
          ['1', 'Describe your issue', 'Tell us what&apos;s wrong in plain language.'],
          ['2', 'We match you', 'Our AI identifies the service type and finds local pros.'],
          ['3', 'Get contacted', 'Matched pros reach out to schedule and quote.'],
        ].map(([num, title, desc]) => `
          <tr><td style="padding:12px 0;border-bottom:1px solid #f3f4f6;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="width:36px;height:36px;background:#eff6ff;border-radius:50%;text-align:center;vertical-align:middle;">
                <span style="font-size:14px;font-weight:800;color:#2563eb;">${num}</span>
              </td>
              <td style="padding-left:14px;">
                <strong style="font-size:14px;color:#111827;">${title}</strong><br/>
                <span style="font-size:13px;color:#6b7280;">${desc}</span>
              </td>
            </tr></table>
          </td></tr>`).join('')}
      </table>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center">
          <a href="https://usescheduleme.vercel.app/bookings" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;">
            Find Your First Pro →
          </a>
        </td></tr>
      </table>
    </td></tr>`;

  return layout('Welcome to ScheduleMe!', body);
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
    subject: `✅ Your request is in — we're finding you a pro`,
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
    subject: `🔔 Booking update: ${opts.status} — ${opts.service}`,
    html: statusUpdateHtml(opts),
  });
}

export async function sendWelcomeEmail(opts: { to: string; name: string }) {
  const resend = getResend();
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Welcome to ScheduleMe, ${opts.name}! 👋`,
    html: welcomeHtml({ name: opts.name }),
  });
}