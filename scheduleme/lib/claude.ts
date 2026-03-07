// lib/claude.ts
// ─────────────────────────────────────────────────────────────────────────────
// Claude helper for ScheduleMe
//
// Env vars required:
//   CLAUDE_API_KEY  — your Anthropic API key (sk-ant-...)
//
// To swap to a proxy/different endpoint, change CLAUDE_API_URL below.
// ─────────────────────────────────────────────────────────────────────────────

export interface TriageResult {
  service_category: string;          // e.g. "Plumbing", "HVAC", "Automotive"
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  estimated_cost_range: string;      // e.g. "$80–$150"
  suggested_next_step: string;       // human-readable next action
  keywords: string[];                // 2–5 relevant tags
  confidence: number;                // 0.0–1.0
}

// ── Config ────────────────────────────────────────────────────────────────────
// 🔁 Swap this URL to point at a proxy, a different region, or an LLM gateway
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// 🔁 Model — update to latest stable as needed
const CLAUDE_MODEL = 'claude-opus-4-6';

// Temperature: keep low for deterministic JSON extraction
const TEMPERATURE = 0.1;

// ── Triage Prompt ─────────────────────────────────────────────────────────────
// Instructs Claude to return ONLY valid JSON. Includes 12 labeled examples.
const TRIAGE_SYSTEM_PROMPT = `You are an expert service triage assistant for a local services booking platform called ScheduleMe.

Your task: analyze a user's description of a service issue and return ONLY a valid JSON object — no prose, no markdown, no code fences.

The JSON object MUST have exactly these keys:
{
  "service_category": string,        // e.g. "Plumbing", "HVAC", "Automotive", "Salon", "Home Repair", "Electrical", "Cleaning", "Pest Control", "Landscaping", "Other"
  "urgency": "low" | "medium" | "high" | "emergency",
  "estimated_cost_range": string,    // e.g. "$80–$200" — give a realistic range based on the issue
  "suggested_next_step": string,     // 1 concise sentence of advice for the user
  "keywords": string[],              // 2–5 short lowercase tags relevant to the issue
  "confidence": number               // 0.0–1.0, your confidence in the categorization
}

Urgency rules:
- "emergency"  = immediate safety risk, flooding, gas smell, no heat in extreme cold, brake failure
- "high"       = significant inconvenience, getting worse rapidly, potential property damage
- "medium"     = annoying but stable, can wait 1–3 days
- "low"        = minor, cosmetic, or just-planning

Return ONLY the JSON. No explanation. No wrapping text.

--- EXAMPLES ---

User: "My kitchen faucet has been dripping for two days and it's getting worse, water is pooling under the sink."
{"service_category":"Plumbing","urgency":"high","estimated_cost_range":"$120–$250","suggested_next_step":"Shut off the water valve under the sink and call a plumber today to prevent cabinet damage.","keywords":["faucet","leak","drip","sink","plumbing"],"confidence":0.97}

User: "The AC stopped blowing cold air and it's 95°F outside. I have a baby at home."
{"service_category":"HVAC","urgency":"emergency","estimated_cost_range":"$150–$400","suggested_next_step":"Contact an emergency HVAC technician immediately — prioritize companies with same-day service.","keywords":["ac","air conditioning","no cool air","hvac","emergency"],"confidence":0.98}

User: "My car makes a grinding noise every time I brake, especially at highway speeds."
{"service_category":"Automotive","urgency":"high","estimated_cost_range":"$200–$500","suggested_next_step":"Stop driving and have the vehicle towed or driven carefully to a brake specialist today.","keywords":["brake","grinding","car","mechanic","safety"],"confidence":0.96}

User: "I want to get a trim and maybe some highlights before my sister's wedding next weekend."
{"service_category":"Salon","urgency":"low","estimated_cost_range":"$80–$200","suggested_next_step":"Book a salon appointment at least 2–3 days ahead to secure your preferred stylist.","keywords":["hair","highlights","trim","salon","wedding"],"confidence":0.99}

User: "There's a small crack in my bedroom drywall from a doorknob, about 3 inches. Not urgent."
{"service_category":"Home Repair","urgency":"low","estimated_cost_range":"$60–$120","suggested_next_step":"Schedule a handyman for a patch-and-paint job — this is a quick fix typically done in under an hour.","keywords":["drywall","crack","patch","repair","handyman"],"confidence":0.97}

User: "The circuit breaker keeps tripping whenever I run the microwave and the toaster at the same time."
{"service_category":"Electrical","urgency":"medium","estimated_cost_range":"$100–$300","suggested_next_step":"Avoid running both appliances simultaneously and have an electrician inspect your panel capacity.","keywords":["breaker","circuit","electrical","microwave","panel"],"confidence":0.95}

User: "I smell gas near my stove. It started about 20 minutes ago."
{"service_category":"HVAC","urgency":"emergency","estimated_cost_range":"$150–$600","suggested_next_step":"Leave the building immediately, do not operate switches, and call 911 and your gas utility from outside.","keywords":["gas leak","smell","stove","emergency","safety"],"confidence":0.99}

User: "My furnace turns on but the house won't get above 58°F. It's winter."
{"service_category":"HVAC","urgency":"high","estimated_cost_range":"$150–$500","suggested_next_step":"Call an HVAC technician today — a failing furnace in cold weather can become an emergency quickly.","keywords":["furnace","heating","hvac","cold","winter"],"confidence":0.96}

User: "I need my house cleaned before I list it for sale. Probably need a deep clean of the whole place."
{"service_category":"Cleaning","urgency":"medium","estimated_cost_range":"$200–$450","suggested_next_step":"Book a move-out or deep cleaning service at least 3–4 days before your listing photos.","keywords":["cleaning","deep clean","maid","move-out","home"],"confidence":0.98}

User: "The toilet is running constantly and my water bill is sky high."
{"service_category":"Plumbing","urgency":"medium","estimated_cost_range":"$80–$200","suggested_next_step":"A running toilet is usually a flapper or fill-valve replacement — schedule a plumber this week.","keywords":["toilet","running","plumbing","water","flapper"],"confidence":0.97}

User: "I think my car battery is dead — it clicks when I turn the key but won't start."
{"service_category":"Automotive","urgency":"high","estimated_cost_range":"$100–$250","suggested_next_step":"Call a mobile mechanic or roadside assistance for a jump-start and battery test at your location.","keywords":["battery","car","dead","click","mechanic"],"confidence":0.97}

User: "Not sure if I need a plumber or electrician — the outlet near my bathroom sink stopped working after I noticed some water dripping nearby."
{"service_category":"Electrical","urgency":"high","estimated_cost_range":"$120–$350","suggested_next_step":"Do not use the outlet and call an electrician first — water near electrical outlets is a safety hazard.","keywords":["outlet","water","bathroom","electrical","safety"],"confidence":0.88}

--- END EXAMPLES ---
`;

// ── Core API caller ───────────────────────────────────────────────────────────
/**
 * callClaude
 *
 * Sends a single-turn message to Claude and returns the raw text response.
 * Throws on non-2xx status.
 *
 * @param userPrompt  The user-turn content (the issue description).
 */
export async function callClaude(userPrompt: string): Promise<string> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing CLAUDE_API_KEY environment variable.');
  }

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 512,
    temperature: TEMPERATURE,
    system: TRIAGE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  };

  // 🔁 To swap to a proxy, change CLAUDE_API_URL at the top of this file
  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'unknown error');
    throw new Error(`Claude API error ${res.status}: ${errorText}`);
  }

  const data = await res.json();

  // Extract text from content blocks
  const textBlock = data?.content?.find?.(
    (block: { type: string; text?: string }) => block.type === 'text',
  );

  if (!textBlock?.text) {
    throw new Error('Claude returned no text content.');
  }

  return textBlock.text.trim();
}

// ── JSON parser with fallback ──────────────────────────────────────────────────
/**
 * parseTriageJSON
 *
 * Defensively parses Claude's raw text output into a TriageResult.
 * Strategy:
 *   1. Try direct JSON.parse.
 *   2. Strip markdown fences and retry.
 *   3. Extract the first {...} block via regex and retry.
 *   4. Return a safe fallback if all attempts fail.
 */
export function parseTriageJSON(raw: string): TriageResult {
  const FALLBACK: TriageResult = {
    service_category: 'General',
    urgency: 'medium',
    estimated_cost_range: 'Contact provider for estimate',
    suggested_next_step: 'Please describe your issue to a service professional for an accurate assessment.',
    keywords: [],
    confidence: 0,
  };

  if (!raw || typeof raw !== 'string') return FALLBACK;

  // Attempt 1: direct parse
  try {
    return validateTriage(JSON.parse(raw));
  } catch (_) { /* continue */ }

  // Attempt 2: strip markdown fences
  const stripped = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  try {
    return validateTriage(JSON.parse(stripped));
  } catch (_) { /* continue */ }

  // Attempt 3: extract first JSON object via regex
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return validateTriage(JSON.parse(match[0]));
    } catch (_) { /* continue */ }
  }

  console.warn('[ScheduleMe] Claude triage parse failed. Raw:', raw.slice(0, 300));
  return FALLBACK;
}

// ── Validation ────────────────────────────────────────────────────────────────
const VALID_URGENCIES = new Set(['low', 'medium', 'high', 'emergency']);

function validateTriage(obj: unknown): TriageResult {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Not an object');
  }

  const o = obj as Record<string, unknown>;

  return {
    service_category: typeof o.service_category === 'string' ? o.service_category : 'General',
    urgency: VALID_URGENCIES.has(o.urgency as string)
      ? (o.urgency as TriageResult['urgency'])
      : 'medium',
    estimated_cost_range:
      typeof o.estimated_cost_range === 'string' ? o.estimated_cost_range : 'Contact for estimate',
    suggested_next_step:
      typeof o.suggested_next_step === 'string' ? o.suggested_next_step : '',
    keywords: Array.isArray(o.keywords)
      ? (o.keywords as unknown[]).filter((k) => typeof k === 'string').slice(0, 5) as string[]
      : [],
    confidence:
      typeof o.confidence === 'number' ? Math.max(0, Math.min(1, o.confidence)) : 0,
  };
}

// ── Public triage entry point ─────────────────────────────────────────────────
/**
 * triageUserInput
 *
 * High-level function used by the API route:
 *   1. Calls Claude with the user's message.
 *   2. Parses and validates the JSON response.
 *   3. Returns a TriageResult (never throws — uses fallback on error).
 */
export async function triageUserInput(userMessage: string): Promise<TriageResult> {
  try {
    const raw = await callClaude(userMessage);
    return parseTriageJSON(raw);
  } catch (err) {
    console.error('[ScheduleMe] triageUserInput error:', err);
    // Return fallback so the intake flow still returns results
    return {
      service_category: 'General',
      urgency: 'medium',
      estimated_cost_range: 'Contact provider for estimate',
      suggested_next_step:
        'Our AI was unable to classify your request — a service professional will review it shortly.',
      keywords: [],
      confidence: 0,
    };
  }
}
