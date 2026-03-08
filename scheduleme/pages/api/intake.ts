// pages/api/intake.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import { triageUserInput } from '../../lib/claude';
import { matchProviders } from '../../lib/mockProviders';

// ── Types ──────────────────────────────────────────────────────────────────────
interface IntakeRequestBody {
  message: string;
  location: string;
  name: string;
  phone: string;
}

interface IntakeSuccessResponse {
  leadId: string;
  triage: Awaited<ReturnType<typeof triageUserInput>>;
  matches: ReturnType<typeof matchProviders>;
}

interface ErrorResponse {
  error: string;
  details?: Record<string, string>;
}

// ── Validation ─────────────────────────────────────────────────────────────────
function validateBody(body: unknown): { valid: true; data: IntakeRequestBody } | { valid: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: { body: 'Request body must be a JSON object.' } };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.message !== 'string' || b.message.trim().length < 5) {
    errors.message = 'message must be a string of at least 5 characters.';
  }
  if (typeof b.location !== 'string' || b.location.trim().length < 2) {
    errors.location = 'location must be a non-empty string.';
  }
  if (typeof b.name !== 'string' || b.name.trim().length < 1) {
    errors.name = 'name must be a non-empty string.';
  }
  if (typeof b.phone !== 'string' || !/^[\d\s\-().+]{7,20}$/.test(b.phone.trim())) {
    errors.phone = 'phone must be a valid phone number (7–20 digits/symbols).';
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      message: (b.message as string).trim(),
      location: (b.location as string).trim(),
      name: (b.name as string).trim(),
      phone: (b.phone as string).trim(),
    },
  };
}

// ── Handler ────────────────────────────────────────────────────────────────────
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IntakeSuccessResponse | ErrorResponse>,
) {
  // Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed.' });
  }

  // Validate body
  const validation = validateBody(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      error: 'Invalid request body.',
      details: validation.errors,
    });
  }

  const { message, location, name, phone } = validation.data;

  try {
    // 1. Triage with Claude
    console.log(`[intake] Triaging lead from ${name} (${location})`);
    const triage = await triageUserInput(message);
    console.log(`[intake] Triage result: ${triage.service_category} / ${triage.urgency}`);

    // 2. Match providers
    // 🔁 Swap matchProviders() here for a DB query + Pinecone vector search in production
    const matches = matchProviders(triage.service_category, message, location, 3);

    // 3. Assemble response
    const leadId = uuidv4();

    // Optional: persist lead to DB/file here
    // await saveLead({ leadId, name, phone, location, message, triage, matches });

    return res.status(200).json({
      leadId,
      triage,
      matches,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error.';
    console.error('[intake] Error:', err);
    return res.status(500).json({ error: message });
  }
}
