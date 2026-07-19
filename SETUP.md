# Alex.ai — Setup Guide ($0/month)

**Card-free mode (default):** Alex.ai runs fully with just steps 1–2 — no credit card anywhere. Discovery uses OpenStreetMap (free, unlimited, no key at all) and AI analysis uses Gemini's free tier. Steps 3–4 are **optional upgrades** that unfortunately require a card on file (still $0 with the caps below); the app detects missing keys and simply hides those features.

The in-app **Quota Guardian** hard-stops all jobs at 90% of each free limit, so a bill is impossible even if you forget about it.

## 1. Database — Neon (free, no card)

1. Create a free account at [neon.tech](https://neon.tech) → create a project.
2. Copy the **exact** connection string (use the "Copy snippet" button — don't retype it) into `.env` as `DATABASE_URL`.

## 2. Gemini (free, no card)

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → create a key (no billing needed).
2. Put it in `.env` as `GOOGLE_GENERATIVE_AI_API_KEY`.
3. The model is `gemini-3.1-flash-lite` (highest free daily limit). If Google renames it, set `GEMINI_MODEL` in `.env`.

**That's it — card-free Alex.ai is fully working.** Sweeps run on OpenStreetMap; every lead still gets full AI analysis, outreach drafts, CRM, CSV export.

## 3. OPTIONAL — Google Places API (New) · richer data, needs a card

Adds Google Maps data: ratings, review counts, review text for the AI, opening hours, better phone coverage. Skip this entirely if you don't want a card on file.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project (e.g. `alex-ai`).
2. Enable **Places API (New)** (APIs & Services → Library — search for "Places API (New)"; the plain "Places API" card is the legacy one, don't use it).
3. Billing: Google requires a card even for free usage — add it, then **immediately do the two safety steps below**:
   - **Quota caps**: APIs & Services → Places API (New) → Quotas → set every "requests per day" cap to **35/day** (≈1,000/month, the free Enterprise tier). This makes overspend impossible on Google's side too.
   - **Budget alert**: Billing → Budgets & alerts → create a **$1** budget with email alerts.
4. Create an API key (Credentials → Create credentials → API key), restrict it to Places API (New), put it in `.env` as `GOOGLE_PLACES_API_KEY`.

## 4. OPTIONAL — Brave Search API · web verification · ⚠️ NOT recommended anymore

Powers the "VERIFY ON WEB" button (confirms a lead has no website anywhere + finds their socials). **As of 2026 Brave has no true free tier**: signup requires a card, you get a $5/month credit (~1,000 queries), and usage past the credit **auto-bills the card**. If staying card-free / risk-free, skip this — Alex.ai works fully without it (the verify button simply reports the key is missing).

If you ever accept the risk: sign up at [api-dashboard.search.brave.com](https://api-dashboard.search.brave.com), put the key in `.env` as `BRAVE_SEARCH_API_KEY` — the in-app guardian caps usage at 90% of 1,000/month to stay inside the credit.

## 5. App secrets + database tables

```bash
cp .env.example .env        # then fill in every value
npm install
npm run db:push             # creates all tables in Neon
npm run dev                 # → http://localhost:3000
```

Log in with your `ALEX_PASSWORD`.

## Free-tier limits (what the Quota Guardian watches)

| Provider | Card needed? | Free limit | Guardian hard-stop (default 90%) |
| --- | --- | --- | --- |
| OpenStreetMap / Nominatim | no | unlimited | polite 1 req/s rate limit |
| Gemini Flash Lite | no | ~1,000 / day | 900 |
| Google Places (optional, all calls pooled) | yes (UPI works in India) | 1,000 / month | 900 |
| Brave Search (optional, ⚠️ bills past $5 credit) | yes | ~1,000 / month credit | 900 |

## Deploy (Vercel Hobby, free)

Push this repo to GitHub, then at [vercel.com/new](https://vercel.com/new) import the repo and add the same env vars from `.env` (Project → Settings → Environment Variables). Or with the CLI: `npm i -g vercel && vercel`.

> Google's terms: `place_id` may be stored forever, other place fields ~30 days — use the **⟳ REFRESH** button on stale leads (the DATA tab shows a reminder).
