// lib/sendWelcome.ts — Sends welcome email once per user
// Uses a dedicated endpoint that validates server-side instead of exposing NOTIFY_SECRET

export async function maybeSendWelcomeEmail(email: string, name: string, userId?: string, accessToken?: string) {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    await fetch('/api/send-welcome', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, name, userId }),
    });
  } catch {
    // Non-fatal
  }
}
