# Alex.ai — Setup Guide ($0/month)

Every provider below has a free tier. The in-app **Quota Guardian** hard-stops all jobs at 90% of each free limit, so a bill is impossible even if you forget about it.

## 1. Database — Neon (free)

1. Create a free account at [neon.tech](https://neon.tech) → create a project.
2. Copy the connection string into `.env` as `DATABASE_URL`.

## 2. Google Places API (New) — free tier

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project (e.g. `alex-ai`).
2. Enable **Places API (New)** (APIs & Services → Library).
3. Billing: Google requires a card even for free usage — add it, then **immediately do the two safety steps below**:
   - **Quota caps**: APIs & Services → Places API (New) → Quotas → set every "requests per day" cap to **35/day** (≈1,000/month, the free Enterprise tier). This makes overspend impossible on Google's side too.
   - **Budget alert**: Billing → Budgets & alerts → create a **$1** budget with email alerts.
4. Create an API key (Credentials → Create credentials → API key), restrict it to Places API (New), put it in `.env` as `GOOGLE_PLACES_API_KEY`.

## 3. Gemini (free tier)

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → create a key (no billing needed).
2. Put it in `.env` as `GOOGLE_GENERATIVE_AI_API_KEY`.
3. The model is `gemini-3.1-flash-lite` (highest free daily limit). If Google renames it, set `GEMINI_MODEL` in `.env`.

## 4. Brave Search API (free tier)

1. Go to [api-dashboard.search.brave.com](https://api-dashboard.search.brave.com) → sign up → choose the **Free** plan (2,000 queries/month).
2. Put the key in `.env` as `BRAVE_SEARCH_API_KEY`.

## 5. App secrets + database tables

```bash
cp .env.example .env        # then fill in every value
npm install
npm run db:push             # creates all tables in Neon
npm run dev                 # → http://localhost:3000
```

Log in with your `ALEX_PASSWORD`.

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
