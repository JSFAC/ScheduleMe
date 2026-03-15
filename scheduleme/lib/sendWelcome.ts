// lib/sendWelcome.ts — Sends welcome email once per user
// Uses a dedicated endpoint that validates server-side instead of exposing NOTIFY_SECRET

export async function maybeSendWelcomeEmail(email: string, name: string) {
  try {
    await fetch('/api/send-welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
  } catch {
    // Non-fatal
  }
}
