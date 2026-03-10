// lib/sendWelcome.ts — Call once after a user's first sign-in to send welcome email
// Tracks with localStorage so we only send it once per browser

export async function maybeSendWelcomeEmail(email: string, name: string) {
  const key = `welcome_sent_${email}`;
  if (typeof window !== 'undefined' && localStorage.getItem(key)) return;

  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'welcome', to: email, name }),
    });
    if (typeof window !== 'undefined') localStorage.setItem(key, '1');
  } catch {
    // Non-fatal
  }
}
