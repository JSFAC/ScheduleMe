# ScheduleMe — Prototype

AI-assisted scheduling/booking for local service businesses. Describe your issue → AI triages → book a matched pro.

---

## Tech Stack

- **Next.js 14** (Pages Router) + **TypeScript**
- **Tailwind CSS** for styling
- **Claude** (Anthropic) for AI triage via server-side API route
- Mock provider matching (rule-based) — swap for DB + Pinecone later

---

## Project Structure

```
scheduleme/
├── cms_content.json          # All CMS copy (nav, hero, features, steps)
├── data/
│   └── mockLeads.json        # Mock dashboard leads
├── lib/
│   ├── claude.ts             # Claude API helper + triage prompt (12 examples)
│   └── mockProviders.ts      # Mock provider data + matching logic
├── pages/
│   ├── _app.tsx
│   ├── index.tsx             # Landing page
│   ├── demo.tsx              # Intake flow
│   ├── dashboard.tsx         # Business dashboard
│   └── api/
│       └── intake.ts         # POST /api/intake
├── components/
│   ├── Hero.tsx
│   └── IntakeForm.tsx
├── styles/
│   └── globals.css
├── tailwind.config.js
├── postcss.config.js
├── next.config.js
└── tsconfig.json
```

---

## Setup

### 1. Prerequisites

- Node.js 18+ (`node --version`)
- An [Anthropic API key](https://console.anthropic.com)

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
CLAUDE_API_KEY=sk-ant-your-key-here
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

| Page | URL |
|------|-----|
| Landing | http://localhost:3000 |
| Demo (intake) | http://localhost:3000/demo |
| Dashboard | http://localhost:3000/dashboard |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CLAUDE_API_KEY` | ✅ Yes | Anthropic API key (sk-ant-...) |

---

## API Route: `POST /api/intake`

### Request

```json
{
  "message": "My kitchen faucet is leaking badly under the sink.",
  "location": "Austin, TX",
  "name": "Jane Smith",
  "phone": "5125550001"
}
```

### Response

```json
{
  "leadId": "uuid-v4-here",
  "triage": {
    "service_category": "Plumbing",
    "urgency": "high",
    "estimated_cost_range": "$120–$250",
    "suggested_next_step": "Shut off the water valve under the sink and call a plumber today.",
    "keywords": ["faucet", "leak", "sink", "plumbing"],
    "confidence": 0.97
  },
  "matches": [
    {
      "id": "p-001",
      "name": "Mike R. Plumbing",
      "service": "plumbing",
      "location": "Austin",
      "rating": 4.9,
      "reviewCount": 312,
      "phone": "5125550101",
      "badge": "Top Rated",
      "available": true
    }
  ]
}
```

---

## Test with curl

```bash
curl -X POST http://localhost:3000/api/intake \
  -H "Content-Type: application/json" \
  -d '{
    "message": "My kitchen faucet is dripping constantly and water is pooling under the sink.",
    "location": "Austin, TX",
    "name": "Jane Smith",
    "phone": "5125550001"
  }'
```

**HVAC emergency example:**

```bash
curl -X POST http://localhost:3000/api/intake \
  -H "Content-Type: application/json" \
  -d '{
    "message": "AC stopped blowing cold air, it is 95 degrees outside and I have a baby.",
    "location": "Austin",
    "name": "Bob Jones",
    "phone": "5125550002"
  }'
```

**Automotive example:**

```bash
curl -X POST http://localhost:3000/api/intake \
  -H "Content-Type: application/json" \
  -d '{
    "message": "My car makes a loud grinding noise when I brake at highway speed.",
    "location": "Austin TX",
    "name": "Carol White",
    "phone": "5125550003"
  }'
```

---

## Inspecting logs

```bash
# Watch server logs in dev
npm run dev
# All [intake] log lines appear in the terminal that runs next dev
```

---

## Changing Claude temperature

In `lib/claude.ts`, find:

```ts
const TEMPERATURE = 0.1;
```

Change to any value 0.0–1.0. Keep low (0.0–0.2) for deterministic JSON extraction.

---

## Swapping mock matching for a real DB + Pinecone

**Current:** `matchProviders()` in `lib/mockProviders.ts` is rule-based scoring over an in-memory array.

**Production path:**

1. **Store providers in a database** (Postgres via Prisma or Supabase):
   ```ts
   // Replace matchProviders() call in pages/api/intake.ts with:
   const matches = await db.provider.findMany({
     where: { service: triage.service_category, location: { contains: userLocation } },
     orderBy: { rating: 'desc' },
     take: 3,
   });
   ```

2. **Add vector search with Pinecone** for semantic matching (e.g., user says "dripping pipe" → matches "plumbing"):
   ```ts
   // Embed the triage keywords with OpenAI/Cohere embeddings
   const queryVector = await embed(triage.keywords.join(' '));
   // Query Pinecone index of provider embeddings
   const results = await pineconeIndex.query({ vector: queryVector, topK: 3 });
   ```

3. **Persist leads** by replacing the comment in `pages/api/intake.ts`:
   ```ts
   // await saveLead({ leadId, name, phone, location, message, triage, matches });
   ```
   with a real DB insert.

4. **Dashboard**: Replace `getStaticProps` with `getServerSideProps` + DB query.

---

## Build for production

```bash
npm run build
npm start
```

---

## Next Steps

- [ ] Add authentication (NextAuth.js) for dashboard
- [ ] Connect real DB (Supabase recommended for quick start)
- [ ] Add Pinecone semantic provider matching
- [ ] SMS/email notifications on new lead (Twilio / Resend)
- [ ] Real-time dashboard updates via WebSocket or polling
- [ ] Provider availability calendar integration (Cal.com API)
- [ ] Stripe payments for booking deposits
