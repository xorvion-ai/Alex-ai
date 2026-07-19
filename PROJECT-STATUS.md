# Alex.ai — Project Status & Full Context

> **Purpose of this file:** complete project context in one place. If you are Claude (or any developer) starting fresh on this repo — read this file first; it tells you what the product is, what's built, how it works, what's decided, and what's left.

Last updated: **2026-07-19 (evening)** · Status: **v1 complete + card-free mode — built, linted, auth smoke-tested, pushed to both GitHub accounts**

> **Standing rules from Sumit:** (1) keep THIS file updated after every working session; (2) **never add a Claude co-author line to commits** (history was rewritten once to remove them).

---

## 1. What Alex.ai is

A **single-user agentic web app** owned by Sumit Kumar (Xorvion). It finds small businesses **anywhere in the world** that have **no website**, stores them as leads with full contact details, deep-analyzes each with AI, and manages the pipeline so Sumit can call/WhatsApp the owner, build them a website with Claude (outside this app), and sell it.

**Business model:** find business with no website → AI writes the pitch + website plan → Sumit contacts via phone/WhatsApp → builds site with Claude → sells it.

## 2. Hard constraints (decided by Sumit — do not change without asking)

1. **$0/month forever — and CARD-FREE.** Sumit will not put a card on file anywhere. Default mode: OpenStreetMap discovery (no key) + Gemini free tier (no card). Google Places and Brave are OPTIONAL (both require a card even for free tiers); the app detects missing keys — Discover shows "GOOGLE · NO KEY" and defaults to OSM-only. The Quota Guardian still hard-stops every keyed provider at 90% of its free limit.
2. **Official APIs only, no scraping.** Phone numbers yes; emails are NOT available (no free source) — outreach is call/WhatsApp/visit.
3. **Global** — any city, any country, any language.
4. **Lead-gen only** — no website-builder inside the app (sites are built separately with Claude via the "COPY PLAN FOR CLAUDE" button).
5. **Delete on contact** — marking a lead ✓ CONTACTED archives a snapshot to the contacted-history CSV (DB table `contacted_archive`, downloadable at `/api/archive`) and permanently deletes the lead.
6. **AI model:** `gemini-3.1-flash-lite` (Sumit's pick — highest free daily limit). Override with `GEMINI_MODEL` env var.
7. **Design is fixed** — pixel-perfect implementation of the handoff in `Agentic AI web app design/design_handoff_alex_ai/` (dark "operator console", Space Grotesk + JetBrains Mono, green `#4ade80`). Don't redesign; follow `README.md` in that folder for tokens.
8. Exactly **one demo lead** ("Annapurna Bhojanalay", marked DEMO) is auto-seeded on first run so every feature is visible — everything else starts empty. All features are real (live APIs), nothing is simulated.

## 3. Stack

Next.js 16 (App Router, TS, Turbopack) · React 19 · Neon Postgres + Drizzle ORM (`pg` driver) · Vercel AI SDK (`ai` + `@ai-sdk/google`) · zod · single-password auth (HMAC-signed cookie, `src/proxy.ts` gate) · plain global CSS (`src/app/globals.css` holds all design tokens — no Tailwind).

## 4. How the system works

- **Discovery** (`src/lib/sweep.ts`): a sweep = country + city + categories + sources. Builds one query unit per category×source. The client polls `POST /api/sweep/step` — each step processes ONE unit (Google: up to 3 pages of Text Search; OSM: one Overpass query) and returns new leads for the live feed. Resumable, stoppable, quota-guarded.
- **Lead sources** (`src/lib/leadsource/`): `google.ts` (Places API (New) with Enterprise field mask incl. `websiteUri`, `googleMapsUri`, phones), `osm.ts` (Nominatim geocode → Overpass by category tag selectors; free/unlimited, polite 1 req/s). Both normalize to one shape (`types.ts`). A business whose "website" is Facebook/Instagram/WhatsApp/linktree/directory page = `social_only` (still a lead, often the best kind). Real website = skipped.
- **Dedup** (`src/lib/dedupe.ts` + `insertLead` in sweep.ts): unique per (source, source_id); cross-source = similar normalized name within ~150 m.
- **AI analysis** (`src/lib/analyze.ts`): one `generateObject` call per lead → score 0-100 + reasoning, business profile, site plan (content angle, selling points, suggested pages), outreach (WhatsApp EN + local language, 5-step call script, best call window). Google leads also pull up to 5 reviews first (only while Places usage < 70%). Batch mode = client loop on `POST /api/analyze/step` (one lead per call, 5 s apart for the free-tier rate limit, pause/resume).
- **Web verification** (`src/lib/verify.ts`): Brave Search "name + city" → confirms no real website exists anywhere (sets `verified_no_website`), harvests FB/IG/WhatsApp links into `socials`.
- **Quota Guardian** (`src/lib/quota.ts`): every Google/Gemini/Brave call goes through `guard()` (throws `QuotaExceededError` → HTTP 429 → UI toast) and `spend()` (logs to `quota_usage`). Limits in `src/lib/config.ts`: google_places 1,000/mo (all SKUs pooled, conservative), gemini 1,000/day, brave 2,000/mo.

## 5. Database (Drizzle schema: `src/lib/db/schema.ts`)

`leads` (unique source+source_id, website_status none|social_only, verified_no_website, score, status new|analyzed, is_demo) · `analyses` (site_plan + outreach as jsonb) · `searches` (sweep runs with queries/cursor/counters) · `activities` (notes + follow-ups via due_at) · `quota_usage` (provider+period) · `contacted_archive` (snapshot jsonb) · `settings` (key/value: hardStop, defaultCountry, defaultCategories, fallbackLanguage, seeded).

Create tables with `npm run db:push` (drizzle-kit, needs DATABASE_URL in `.env`).

## 6. Pages & API map

Pages: `/login` (intro splash 3 s → password), `/` Dashboard (stats, follow-ups due, recent sweeps, batch analysis runner, quota), `/discover` (sweep form + live feed + radar), `/leads` (split view; tabs ANALYSIS · DATA · SITE_PLAN · LOG·n · OUTREACH; actions CALL/WHATSAPP/VERIFY/REFRESH/CONTACTED→ARCHIVE), `/settings`.

API: `auth/login|logout` · `sweep` (start) + `sweep/step` + `sweep/stop` · `leads` (list/filters/countOnly) + `leads/export` (CSV) + `leads/[id]` + `[id]/analyze|verify|refresh|contacted|activities` · `analyze/step` (batch) · `dashboard` · `quota` · `settings` · `archive` (contacted-history CSV). All JSON errors: `{error}`; quota blocks add `{quotaBlocked:true}` with HTTP 429.

## 7. Environment (`.env`, template in `.env.example`)

`DATABASE_URL` (Neon) · `ALEX_PASSWORD` · `SESSION_SECRET` · `GOOGLE_PLACES_API_KEY` · `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini) · `BRAVE_SEARCH_API_KEY` · optional `GEMINI_MODEL`. Setup walkthrough with the Google-console safety steps (quota caps + $1 budget alert): **SETUP.md**.

## 8. Verification done / how to verify

- `npm run build` ✓ (Next 16, all 20 routes) · `npm run lint` ✓
- Auth smoke-tested end-to-end with curl: `/` → 307 `/login`; wrong password → 401; correct → HttpOnly signed cookie; API without cookie → 401; authed `/` renders Dashboard + Quota Guardian sidebar.
- NOT yet verified (needs Sumit's API keys): live Google sweep, OSM sweep, Gemini analysis, Brave verify, Neon db:push. Follow `ALEX-AI-PLAN.md` §Verification once keys exist.

## 9. Repos & deployment

- GitHub targets: `Sumitkr28/Alex-ai` (personal-branded README, local branch `main`) and `xorvion-ai/Alex-ai` (Xorvion-branded README, local branch `xorvion-main` — push it as that repo's `main`). Remotes `sumit` and `xorvion` are configured; repos must exist on GitHub first (the provided PATs cannot create repos).
- Deploy target: **Vercel Hobby via the sumitkr28 account** — import repo at vercel.com/new, add all `.env` vars, deploy. Not yet deployed.
- Local `.env` exists with Sumit's chosen login password and a random SESSION_SECRET (never committed — `.env` is git-ignored); all API keys still empty.

## 10. Open TODOs (state on 2026-07-19 evening)

1. **Neon DATABASE_URL is wrong** — the password read from a screenshot failed auth (`password authentication failed for user 'neondb_owner'`). Sumit must copy the EXACT connection string from Neon console ("Copy snippet") or reset the role password, put it in `.env`, then run `npm run db:push` (tables not created yet).
2. ✅ Gemini key: set in `.env` and validated live (HTTP 200). Model `gemini-3.1-flash-lite` confirmed to exist via the models API — no override needed.
3. Card-free mode: Google Places + Brave keys intentionally skipped (need a card). Add later only if Sumit chooses.
4. After DB works: verify end-to-end — demo lead seeds on first dashboard load, OSM sweep on a small city, batch analysis on real leads, archive flow.
5. Vercel deploy (sumitkr28 account): import `Sumitkr28/Alex-ai` at vercel.com/new + add env vars from `.env`.
6. Sumit: **rotate the two GitHub PATs** shared in chat (they were used for pushes; treat as exposed).
7. Future ideas (out of scope for v1): demo-site generator per lead, paid email enrichment, multi-user.

## 11. Key documents

- `ALEX-AI-PLAN.md` — approved product plan (source of truth for behavior)
- `Agentic AI web app design/design_handoff_alex_ai/README.md` — design tokens & screen specs (source of truth for looks)
- `SETUP.md` — free-tier setup guide · `README.md` — public repo readme
