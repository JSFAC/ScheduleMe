// lib/openaiModeration.ts
// OpenAI moderation helpers for text + image safety checks.

type ModerationCategoryMap = Record<string, boolean>;

type OpenAIModerationResponse = {
  results?: Array<{
    flagged?: boolean;
    categories?: ModerationCategoryMap;
  }>;
};

type ModerationResult = {
  ok: boolean;
  reason?: string;
  flaggedCategories?: string[];
};

const MODERATION_URL = 'https://api.openai.com/v1/moderations';
const MODERATION_MODEL = 'omni-moderation-latest';

function shouldFailOpen(): boolean {
  return process.env.OPENAI_MODERATION_FAIL_OPEN === 'true';
}

function getApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

function summarizeFlagged(categories?: ModerationCategoryMap): string[] {
  if (!categories) return [];
  return Object.entries(categories)
    .filter(([, value]) => value === true)
    .map(([name]) => name)
    .slice(0, 5);
}

async function callModeration(input: unknown): Promise<ModerationResult> {
  const failOpen = shouldFailOpen();
  const apiKey = getApiKey();
  if (!apiKey) {
    if (failOpen) return { ok: true };
    return { ok: false, reason: 'Moderation not configured' };
  }

  let timeout: NodeJS.Timeout | null = null;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(MODERATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODERATION_MODEL,
        input,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (failOpen && (response.status === 429 || response.status >= 500)) {
        return { ok: true };
      }
      return { ok: false, reason: 'Moderation service unavailable' };
    }

    const payload = (await response.json()) as OpenAIModerationResponse;
    const first = payload.results?.[0];
    const flagged = first?.flagged === true;
    if (!flagged) return { ok: true };

    const flaggedCategories = summarizeFlagged(first?.categories);
    return {
      ok: false,
      reason: flaggedCategories.length
        ? `Content blocked by safety filter: ${flaggedCategories.join(', ')}`
        : 'Content blocked by safety filter.',
      flaggedCategories,
    };
  } catch {
    if (failOpen) return { ok: true };
    return { ok: false, reason: 'Moderation service unavailable' };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function moderateUserText(text: string): Promise<ModerationResult> {
  return callModeration(text);
}

export async function moderateUserImageDataUrl(dataUrl: string): Promise<ModerationResult> {
  return callModeration([
    {
      type: 'image_url',
      image_url: { url: dataUrl },
    },
  ]);
}

