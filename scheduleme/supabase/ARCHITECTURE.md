# ScheduleMe — Architecture & Integration Guide

## Step 1 — Install Supabase client

```bash
cd scheduleme
npm install @supabase/supabase-js
```

---

## Step 2 — Run the SQL schema

1. Go to **Supabase Dashboard → SQL Editor**
2. Open `supabase/schema.sql` from this repo
3. Paste the entire file and click **Run**

This creates:
- `businesses`, `users`, `bookings` tables
- PostGIS `geog` column with auto-populate trigger
- `updated_at` auto-trigger on all tables
- `search_businesses_geo` RPC function
- Row Level Security policies

---

## Step 3 — Environment variables

### Local development

```bash
cp .env.local.example .env.local
# Fill in your values from Supabase Dashboard → Project Settings → API
```

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role key |

### Vercel

Go to **Vercel → Project → Settings → Environment Variables** and add all three.
Redeploy after saving.

---

## Step 4 — Test the search

Visit `/search-test` on your local or deployed site to test geo search visually.

Or test directly with curl:

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 30.2672,
    "lng": -97.7431,
    "service": "plumbing",
    "radius": 25
  }'
```

---

## Architecture Decisions

### Why service_role key is server-only

The `service_role` key bypasses Row Level Security entirely — it has full read/write
access to every table. If it leaked to the browser, anyone could read all user data,
modify bookings, or wipe the database.

`NEXT_PUBLIC_` variables are bundled into the JavaScript sent to every browser.
`SUPABASE_SERVICE_ROLE_KEY` has no `NEXT_PUBLIC_` prefix, so Next.js keeps it
server-side only. It only ever runs in `pages/api/*` routes on Vercel's servers.

### Why RPC instead of direct client query

The `search_businesses_geo` function runs entirely inside Postgres, which means:
- One round-trip instead of many
- PostGIS spatial index is used automatically
- Business logic stays in the database, not scattered across clients
- The anon key can call the function without needing direct table access

### Why PostGIS instead of Haversine in JavaScript

| | Haversine (JS) | PostGIS |
|---|---|---|
| Runs in | Node.js | Postgres (C extension) |
| Uses index | No — full table scan | Yes — GIST spatial index |
| At 10k rows | ~50ms | ~2ms |
| At 1M rows | 5000ms+ | ~5ms |

PostGIS uses a spatial index (GIST) that narrows candidates to a bounding box first,
then applies the precise distance check only to ~50 candidates instead of all rows.

---

## Future Integration Plan

### Google OAuth (business calendar)

1. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars
2. Create `pages/api/auth/google/callback.ts` — exchanges code for tokens
3. Store `google_refresh_token` + `google_access_token` in the `businesses` table
4. Create `pages/api/calendar/slots.ts` — uses refresh token to fetch available slots
5. n8n calls `/api/calendar/slots?business_id=xxx` — never touches tokens directly

### n8n automation

n8n should call your Next.js API endpoints, not Supabase directly. This keeps
your service_role key out of n8n entirely.

Example n8n workflow for a new booking:
```
Webhook (new lead) 
  → POST /api/search (find nearby businesses)
  → POST /api/bookings/create (create pending booking)
  → POST /api/notify (send SMS via Twilio)
  → POST /api/calendar/check (verify availability)
```

### Stripe (capture_method: manual)

Use `capture_method: 'manual'` on PaymentIntent creation so funds are authorized
but not captured until the job is confirmed complete.

```typescript
// pages/api/bookings/payment-intent.ts
const intent = await stripe.paymentIntents.create({
  amount: priceInCents,
  currency: 'usd',
  capture_method: 'manual',   // authorize now, capture on completion
  metadata: { booking_id, business_id },
});
// Store intent.id in bookings.stripe_payment_intent_id
```

Then capture when the business marks the job complete:
```typescript
await stripe.paymentIntents.capture(paymentIntentId);
```

This protects users (no charge until work is done) and businesses (funds guaranteed).
