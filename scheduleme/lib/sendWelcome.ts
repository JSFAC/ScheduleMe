// lib/sendWelcome.ts — Sends welcome email once per user
// Gating is handled upstream via has_seen_welcome in Supabase — this just fires the email

export async function maybeSendWelcomeEmail(email: string, name: string) {
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'welcome', to: email, name }),
    });
  } catch {
    // Non-fatal
  }
}
