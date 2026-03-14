# ScheduleMe — Project Context for Claude Code

## Repo & Live Site
- **Repo:** https://github.com/JSFAC/ScheduleMe.git (branch: master)
- **Live:** https://usescheduleme.com
- **Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase, Resend, Stripe

## Business Model
Pure commission: 12% on completed jobs. No monthly fees.

---

## Environment Variables (Vercel)
```
RESEND_API_KEY
NOTIFY_SECRET
NEXT_PUBLIC_SITE_URL=https://usescheduleme.com
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
CLAUDE_API_KEY (stored as jsfschedulemeapikey)
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
```

---

## Color System (tailwind.config.js)
```js
accent: '#0A84FF'
'accent-dark': '#0066CC'
'accent-light': '#E8F3FF'
'accent-wash': '#EDF5FF'
'accent-wash-deep': '#DCF0FF'
```

- Page backgrounds: `var(--page-bg, #EDF5FF)` or `dm ? '#0f1117' : '#EDF5FF'`
- Hero headers: flat `#3b82f6`
- Open badge: emerald green, dark mode: white text
- Unavailable: "Fully Booked"
- Category pills light: `{ background: '#EBF4FF', color: '#1A6FD4' }`
- Category pills dark: `{ background: 'rgba(59,130,246,0.25)', color: '#93c5fd' }`

---

## Dark Mode Architecture

### Key Files
- `lib/DarkModeContext.tsx` — React context with single shared `dm` state
- `lib/useDarkMode.ts` — old hook, kept but unused (don't delete)
- `styles/globals.css` — CSS class overrides for `html.dark`
- `tailwind.config.js` — has `darkMode: 'class'`

### How it works
`DarkModeContext` provides `{ dm, toggle }` to the entire app via `_app.tsx`.
Every page/component calls `const { dm } = useDm()` from `'../lib/DarkModeContext'`.
Toggle sets `localStorage('sm_dark_mode')` and adds/removes `class="dark"` on `<html>`.

### Dark mode color palette
```
page bg:    dm ? '#0f1117' : '#EDF5FF'
card bg:    dm ? '#1a1d27' : 'white'
input bg:   dm ? '#1e2130' : 'white'
deep bg:    dm ? '#13161f' : '#f8fafc'
border:     dm ? '#2a2d3a' : '#e5e5e5'
text-1:     dm ? '#f3f4f6' : '#171717'
text-2:     dm ? '#d1d5db' : '#404040'
text-3:     dm ? '#9ca3af' : '#737373'
text-muted: dm ? 'rgba(255,255,255,0.4)' : '#a3a3a3'
```

### IMPORTANT: Use inline dm-conditional styles, NOT CSS class overrides
Since many elements use inline `style=` attributes, CSS selectors can't override them.
Always use: `style={{ background: dm ? '#1a1d27' : 'white' }}`
NOT: relying on `html.dark .bg-white` CSS (only works for Tailwind class elements)

---

## Key File Paths

### Consumer Pages
```
pages/home.tsx        — AI search hero, business card scroll sections
pages/browse.tsx      — filter/search, grid/list/map views, pagination
pages/bookings.tsx    — booking history, nearby pros
pages/messages.tsx    — consumer ↔ business messaging
pages/account.tsx     — profile, addresses, notifications, security
pages/signin.tsx      — auth
pages/index.tsx       — marketing landing page
pages/pricing.tsx     — pricing page
```

### Business Pages
```
pages/business/dashboard.tsx  — full business dashboard (overview/bookings/messages/clients/calendar/settings)
pages/business/auth/login.tsx — business login
pages/business/index.tsx      — business landing
```

### API Routes
```
pages/api/bookings.ts        — GET (user_id or business_id), POST create booking
pages/api/messages.ts        — GET threads/messages, POST send, PATCH mark read
pages/api/business-signup.ts — business registration
pages/api/stripe-connect.ts  — Stripe Connect onboarding
pages/api/stripe-webhook.ts  — Stripe webhook handler
pages/api/checkout.ts        — Stripe checkout session
pages/api/notify.ts          — Resend email notifications
pages/api/approve-business.ts
pages/api/admin-businesses.ts
pages/api/delete-account.ts
pages/api/intake.ts          — AI job intake (uses Claude API)
pages/api/search.ts          — business search
pages/api/cleanup-auth-user.ts
```

### Components
```
components/Nav.tsx             — consumer nav with dark mode toggle switch
components/BusinessProfile.tsx — business detail modal + booking form (fully dark-mode aware)
components/BusinessNav.tsx     — business dashboard nav
```

### Lib
```
lib/DarkModeContext.tsx  — shared dark mode React context
lib/useDarkMode.ts       — old hook (unused, keep)
lib/mockBusinesses.ts    — mock business data with topReview + reviewer fields
lib/claude.ts            — Claude API wrapper
lib/mockProviders.ts
lib/rateLimit.ts
```

---

## Consumer Pages — Design Details

### Nav (components/Nav.tsx)
- Fixed top, `h-[72px]`, white/dark bg
- Auth cache: `sessionStorage` key `sm_nav_user`
- Links: Home, Browse, Bookings, Messages (only shown when logged in)
- Dark mode toggle: sun/moon icon + switch pill, `cubic-bezier(0.34,1.56,0.64,1)` spring animation
- Active link: `bg-accent text-white` (dark) or `bg-blue-50 text-accent` (light)
- Unselected: `text-white/80` (dark) or `text-neutral-600` (light)
- Dropdown menu: `position: fixed` at `top: 72px`

### Home (pages/home.tsx)
- Hero: flat `#3b82f6`, `max-w-4xl mx-auto flex items-center gap-10`
- Left: `AISearchBar` component (calls `useDm()` internally)
- Right: 2×2 grid of nav tiles (My Bookings, Browse Pros, How It Works, Refer a Pro)
- Nav tiles dark: `background: '#1e2130', border: '1px solid #2a2d3a'`
- Category quick-links bar: `bg-white` (light) / `#1a1d27` (dark), pills use brighter blue in dark
- ScrollSection: `edgePad = 'max(24px, calc((100vw - 1400px) / 2))'`, drag-to-scroll, non-passive wheel
- Curtains: solid color matching page bg (no fade gradient)
- BizCard: `width: clamp(220px, 18vw, 290px)`, image `clamp(175px, 14vw, 220px)` tall
- BizCard body has `style={{ background: dm ? '#1a1d27' : 'white' }}` — MUST be inline
- Suggestion chips: white on blue hero (correct, don't change)

### Browse (pages/browse.tsx)
- Hero: flat `#3b82f6`, search input + sort dropdown + view toggle (List/Grid/Map)
- Search/sort dark: `background: '#1e2130', border: '1px solid #2a2d3a'`
- View toggle selected dark: accent blue bg
- BizCard (grid): `flex flex-col`, image `210px`, body `flex-1 minHeight:118`
- List view: photo `w-40 sm:w-48 height:148`
- Map view: `MapPlaceholder` component — dark map with dark streets/buildings
- Pagination: `ITEMS_PER_PAGE=12`, dm-aware button styles
- ReferInline: dm-aware card bg

### Bookings (pages/bookings.tsx)
- Booking cards: `.booking-card` class + inline `style={{ background: dm ? '#1a1d27' : 'white' }}`
- Stats tiles on blue header: `dm ? 'rgba(255,255,255,0.14)' : 'white'`
- Nearby pros: dm-aware inline styles
- All text uses inline dm-conditional colors (NOT Tailwind classes)

### Messages (pages/messages.tsx)
- Thread list: inline dm bg
- Message bubbles: business messages use `bg-neutral-800` in dark mode
- All containers, inputs, borders: inline dm-conditional
- Input textarea: `style={{ background: dm ? '#13161f' : 'white', ... }}`

### Account (pages/account.tsx)
- Uses `darkMode` alias for `dm`: `const { dm, toggle: toggleDark } = useDm(); const darkMode = dm;`
- sm-panel header: `dm ? 'bg-[#13161f]' : 'sm-panel'`
- Google auth box: `dm ? '#0d1f35' : '#eff6ff'`
- Dark mode toggle in Manage section: iOS-style switch

---

## Business Dashboard (pages/business/dashboard.tsx)

### Layout
- Fixed left sidebar `w-60` on desktop, mobile hamburger
- White/light theme: `background: var(--section-bg, #f8fafc)`
- Dark mode toggle in sidebar bottom

### Tabs
1. **Overview** — 4 stat cards, RevenueChart (CSS bars), recent bookings, Stripe status
2. **Bookings** — filter pills, booking cards with customer info, action buttons → Supabase
3. **Messages** — thread list + chat panel, polls every 5s, sends via `/api/messages`
4. **Clients** — sorted by total spend, booking history snippets
5. **Calendar** — side-by-side: compact month grid (left, 300px) + scrollable booking list (right)
6. **Settings** — editable form writing to `businesses` table

### Auth
Redirects to `/business/auth/login` if no session or no business record.
Business identified by `session.user.email` matching `businesses.owner_email`.

---

## Supabase Schema (key tables)

### `bookings`
```sql
id, business_id (→businesses), user_id (→users), service, status, 
created_at, amount_cents, paid_at, scheduled_at, notes, address
```
Status values: `pending | confirmed | completed | cancelled | paid | payment_pending | payment_failed`

### `businesses`
```sql
id, name, slug, owner_name, owner_email, phone, address, description,
service_tags (text[]), is_onboarded, stripe_account_id, stripe_onboarded,
rating, lat, lng, website, instagram
```

### `messages`
```sql
id, booking_id (→bookings), sender_type ('user'|'business'), 
sender_id, content, read (bool), created_at
```

### `users` (app users, separate from auth.users)
```sql
id (= auth.users.id), email, name, phone, created_at
```
**Important:** user must complete welcome flow to get a row in `users`. 
Foreign key: `bookings.user_id → users.id`

### `profiles`
```sql
id (= auth.users.id), has_seen_welcome
```

---

## Creating a Test Booking (for messaging tests)
```sql
-- 1. Get friend's user ID (must have completed welcome flow first)
SELECT id FROM auth.users WHERE email = 'friend@example.com';

-- 2. Get business ID
SELECT id FROM businesses WHERE owner_email = 'you@example.com';

-- 3. Insert booking
INSERT INTO bookings (business_id, user_id, service, status, created_at)
VALUES ('BIZ_UUID', 'USER_UUID', 'Test service description', 'confirmed', now())
RETURNING id;
```

---

## Mock Data (lib/mockBusinesses.ts)
- Interface: `id, name, slug, category, coverUrl, allImages[], tagline, description, rating, reviews, distance, available, badge?, services[], price_tier, address, lat, lng, topReview?, reviewer?`
- 13 businesses total: `SPONSORED` (4), `INDEPENDENT`, `NEARBY`
- All have `topReview` and `reviewer: { name, avatarUrl }` populated

---

## Pending / TODO
- [ ] Connect real Supabase business data to home/browse (currently uses mockBusinesses)
- [ ] Test Stripe end-to-end
- [ ] Real map tiles (currently SVG placeholder)
- [ ] N8N_WEBHOOK_URL env var (once n8n deployed on Google Cloud Run)
- [ ] Supabase custom domain for Google OAuth
- [ ] College/EDU tab feature (`.edu` email verification, campus-filtered browse)
- [ ] `git rm -r --cached .next` to fix Vercel .next cache warning

---

## College/EDU Feature (planned)
**Concept:** Users verify a `.edu` email to access a "Campus" tab showing only student-run businesses at their school.
- Add `school_email`, `school_name`, `edu_verified` to `profiles` table
- New `/campus` page filtered by matching `school_name`  
- New `/api/verify-edu` route: send code to `.edu` email, confirm → set `edu_verified = true`
- Business owners can also verify `.edu` to appear in campus tab

---

## CSS Classes of Note
```css
.biz-card        — card base: white bg, border-radius 16px, border, shadow, overflow-hidden
.booking-card    — booking card base
.sm-panel        — hero header with grid bg pattern (light mode)
.sm-glow         — radial glow element inside sm-panel
.sm-eyebrow      — small uppercase label
.btn-primary     — accent blue CTA button
.btn-secondary   — white bordered button
.form-input      — standard form input
```

## Auth Flow
- Single `/auth/callback` for all OAuth
- `auth_source` in localStorage distinguishes consumer vs business login
- Welcome animation on first login (checks `profiles.has_seen_welcome`)
- Business login: `/business/auth/login`
