// lib/moderation.ts — image moderation helper (adult content block)
type ModerationResult = { ok: boolean; reason?: string };

const MODERATION_URL = 'https://api.openai.com/v1/moderations';
const MODERATION_MODEL = 'omni-moderation-latest';

export async function moderateImageDataUrl(dataUrl: string): Promise<ModerationResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, reason: 'Image moderation not configured' };
  if (!dataUrl?.startsWith('data:image/')) return { ok: false, reason: 'Invalid image data' };
  try {
    const res = await fetch(MODERATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODERATION_MODEL,
        input: [{ type: 'image_url', image_url: { url: dataUrl } }],
      }),
    });
    const data: any = await res.json();
    if (!res.ok) return { ok: false, reason: data?.error?.message || 'Moderation failed' };
    const r = data?.results?.[0];
    if (!r) return { ok: false, reason: 'Moderation failed' };
    if (r.flagged) return { ok: false, reason: 'Image violates content policy' };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'Moderation failed' };
  }
}

export async function moderateText(text: string): Promise<ModerationResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, reason: 'Text moderation not configured' };
  const trimmed = (text || '').trim();
  if (!trimmed) return { ok: true };
  try {
    const res = await fetch(MODERATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODERATION_MODEL,
        input: trimmed,
      }),
    });
    const data: any = await res.json();
    if (!res.ok) return { ok: false, reason: data?.error?.message || 'Moderation failed' };
    const r = data?.results?.[0];
    if (!r) return { ok: false, reason: 'Moderation failed' };
    if (r.flagged) return { ok: false, reason: 'Text violates content policy' };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'Moderation failed' };
  }
}
