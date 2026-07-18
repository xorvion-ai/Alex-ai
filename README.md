# Alex.ai — A Xorvion Product

Agentic lead-gen for one operator: sweep **any city on Earth** (Google Maps + OpenStreetMap) for small businesses with **no website**, verify across the whole web (Brave Search), deep-analyze each lead with AI (Gemini Flash Lite — score, business profile, website plan, outreach drafts in English + the lead's local language), then manage the pipeline: call/WhatsApp → contacted → auto-archived to CSV and deleted.

**Total running cost: $0/month.** Every provider is on a free tier and the built-in **Quota Guardian** hard-stops all jobs at 90% of each free limit, so a bill is impossible even if you forget about it.

Full product spec: [ALEX-AI-PLAN.md](./ALEX-AI-PLAN.md)

## Stack

Next.js (App Router, TS) · Neon Postgres + Drizzle · Vercel AI SDK + Gemini Flash Lite · Google Places API (New) · OpenStreetMap Overpass · Brave Search · single-password auth (signed cookie).

---

## Setup (once, ~20 minutes)

### 1. Database — Neon (free)

1. Create a free account at [neon.tech](https://neon.tech) → create a project.
2. Copy the connection string into `.env` as `DATABASE_URL`.

### 2. Google Places API (New) — free tier

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project (e.g. `alex-ai`).
2. Enable **Places API (New)** (APIs & Services → Library).
3. Billing: Google requires a card even for free usage — add it, then **immediately do the two safety steps below**:
   - **Quota caps**: APIs & Services → Places API (New) → Quotas → set every "requests per day" cap to **35/day** (≈1,000/month, the free Enterprise tier). This makes overspend impossible on Google's side too.
   - **Budget alert**: Billing → Budgets & alerts → create a **$1** budget with email alerts.
4. Create an API key (Credentials → Create credentials → API key), restrict it to Places API (New), put it in `.env` as `GOOGLE_PLACES_API_KEY`.

### 3. Gemini (free tier)

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → create a key (no billing needed).
2. Put it in `.env` as `GOOGLE_GENERATIVE_AI_API_KEY`.
3. The model is `gemini-3.1-flash-lite` (highest free daily limit). If Google renames it, set `GEMINI_MODEL` in `.env`.

### 4. Brave Search API (free tier)

1. Go to [api-dashboard.search.brave.com](https://api-dashboard.search.brave.com) → sign up → choose the **Free** plan (2,000 queries/month).
2. Put the key in `.env` as `BRAVE_SEARCH_API_KEY`.

### 5. App secrets + database tables

```bash
cp .env.example .env        # then fill in every value
npm install
npm run db:push             # creates all tables in Neon
npm run dev                 # → http://localhost:3000
```

Log in with your `ALEX_PASSWORD`.

---

## How to use

1. **Discover** — pick country ("🌍 Global" works), type a city, choose business types + sources (Google / OSM / both), hit **START SWEEP**. Businesses with no real website stream in live (a Facebook-page-only "website" counts as a lead — often the best ones).
2. **Dashboard → ANALYZE N NEW LEADS** — batch-runs the AI over every new lead (rate-limited to the free tier, pause/resume anytime).
3. **Leads** — filter by score/city/source, open a lead: analysis, raw data, site plan (**COPY PLAN FOR CLAUDE** → paste into Claude to build their website), activity log with follow-up reminders, and ready-to-send outreach drafts (EN + local language). Call or WhatsApp in one click.
4. When you've contacted them: **✓ CONTACTED → ARCHIVE** — the lead is appended to `history.csv` (downloadable from the Dashboard) and deleted from the app.
5. **VERIFY ON WEB** on any promising lead — Brave-searches the entire internet to confirm they truly have no website and grabs their social links.

## Free-tier limits (what the Quota Guardian watches)

| Provider | Free limit | Guardian hard-stop (default 90%) |
| --- | --- | --- |
| Google Places (all calls pooled) | 1,000 / month | 900 |
| Gemini Flash Lite | ~1,000 / day | 900 |
| Brave Search | 2,000 / month | 1,800 |
| OpenStreetMap / Nominatim | unlimited | polite 1 req/s rate limit |

## Deploy (Vercel Hobby, free)

Push this repo to GitHub, then at [vercel.com/new](https://vercel.com/new) import the repo and add the same env vars from `.env` (Project → Settings → Environment Variables). Or with the CLI: `npm i -g vercel && vercel`.

> Google's terms: `place_id` may be stored forever, other place fields ~30 days — use the **⟳ REFRESH** button on stale leads (the DATA tab shows a reminder).
