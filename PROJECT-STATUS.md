# Alex.ai — Project Status & Full Context

> **Purpose of this file:** complete project context in one place. If you are Claude (or any developer) starting fresh on this repo — read this file first; it tells you what the product is, what's built, how it works, what's decided, and what's left.

Last updated: **2026-07-20** · Status: **v1.1 — THREE lead sources (Google + OSM + TomTom) + Tavily verification, fully E2E-verified with live APIs — production-ready, pending Tavily key + Vercel import**

> **Standing rules from Sumit:** (1) keep THIS file updated after every working session; (2) **never add a Claude co-author line to commits**; (3) **per-repo commit identity**: commits on `main` are authored `Sumitkr28 <Sumitkr28@users.noreply.github.com>` (repo-local git config is set), and the `xorvion-main` branch must contain ONLY `xorvion-ai <xorvion-ai@users.noreply.github.com>` commits — to sync it: `git checkout -B xorvion-main main` → restore its README (`git checkout <old-tip> -- README.md` + commit) → `git filter-branch -f --env-filter '<export xorvion-ai identity>' -- xorvion-main` → force-push to xorvion remote.

---

## 1. What Alex.ai is

A **single-user agentic web app** owned by Sumit Kumar (Xorvion). It finds small businesses **anywhere in the world** that have **no website**, stores them as leads with full contact details, deep-analyzes each with AI, and manages the pipeline so Sumit can call/WhatsApp the owner, build them a website with Claude (outside this app), and sell it.

**Business model:** find business with no website → AI writes the pitch + website plan → Sumit contacts via phone/WhatsApp → builds site with Claude → sells it.

## 2. Hard constraints (decided by Sumit — do not change without asking)

1. **$0/month forever — and CARD-FREE.** Sumit will not put a card on file anywhere. Card-free stack: OpenStreetMap (no key) + **TomTom Search (2,500/day free, no card)** for discovery, Gemini free tier for AI, **Tavily (1,000/mo free, no card)** for web verification. Google Places is the only card-adjacent provider (Sumit verified via UPI — trial mode, unbillable; after the 90-day trial it pauses and the other sources continue). Brave was evaluated and REJECTED (2026: card required, auto-bills past $5 credit). The app detects missing keys per source — chips show "· NO KEY". The Quota Guardian hard-stops every keyed provider at 90% of its free limit (tomtom 2,250/day, tavily 900/mo).
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
- **Lead sources** (`src/lib/leadsource/`): `google.ts` (Places API (New) with Enterprise field mask incl. `websiteUri`, `googleMapsUri`, phones), `osm.ts` (Nominatim geocode → Overpass by category tag selectors; free/unlimited, polite 1 req/s), `tomtom.ts` (poiSearch by category text around the Nominatim bbox center, 1 request/category, up to 100 POIs; `poi.url` absent → lead). All normalize to one shape (`types.ts`). A business whose "website" is Facebook/Instagram/WhatsApp/linktree/directory page = `social_only` (still a lead, often the best kind). Real website = skipped.
- **Dedup** (`src/lib/dedupe.ts` + `insertLead` in sweep.ts): unique per (source, source_id); cross-source = similar normalized name within ~150 m.
- **AI analysis** (`src/lib/analyze.ts`): one `generateObject` call per lead → score 0-100 + reasoning, business profile, site plan (content angle, selling points, suggested pages), outreach (WhatsApp EN + local language, 5-step call script, best call window). Google leads also pull up to 5 reviews first (only while Places usage < 70%). Batch mode = client loop on `POST /api/analyze/step` (one lead per call, 5 s apart for the free-tier rate limit, pause/resume).
- **Web verification** (`src/lib/verify.ts`): Tavily search "name + city" → confirms no real website exists anywhere (sets `verified_no_website`), harvests FB/IG/WhatsApp links into `socials`.
- **Quota Guardian** (`src/lib/quota.ts`): every Google/Gemini/Brave call goes through `guard()` (throws `QuotaExceededError` → HTTP 429 → UI toast) and `spend()` (logs to `quota_usage`). Limits in `src/lib/config.ts`: google_places 1,000/mo (all SKUs pooled, conservative), gemini 1,000/day, brave 2,000/mo.

## 5. Database (Drizzle schema: `src/lib/db/schema.ts`)

`leads` (unique source+source_id, website_status none|social_only, verified_no_website, score, status new|analyzed, is_demo) · `analyses` (site_plan + outreach as jsonb) · `searches` (sweep runs with queries/cursor/counters) · `activities` (notes + follow-ups via due_at) · `quota_usage` (provider+period) · `contacted_archive` (snapshot jsonb) · `settings` (key/value: hardStop, defaultCountry, defaultCategories, fallbackLanguage, seeded).

Create tables with `npm run db:push` (drizzle-kit, needs DATABASE_URL in `.env`).

## 6. Pages & API map

Pages: `/login` (intro splash 3 s → password), `/` Dashboard (stats, follow-ups due, recent sweeps, batch analysis runner, quota), `/discover` (sweep form + live feed + radar), `/leads` (split view; tabs ANALYSIS · DATA · SITE_PLAN · LOG·n · OUTREACH; actions CALL/WHATSAPP/VERIFY/REFRESH/CONTACTED→ARCHIVE), `/settings`.

API: `auth/login|logout` · `sweep` (start) + `sweep/step` + `sweep/stop` · `leads` (list/filters/countOnly) + `leads/export` (CSV) + `leads/[id]` + `[id]/analyze|verify|refresh|contacted|activities` · `analyze/step` (batch) · `dashboard` · `quota` · `settings` · `archive` (contacted-history CSV). All JSON errors: `{error}`; quota blocks add `{quotaBlocked:true}` with HTTP 429.

## 7. Environment (`.env`, template in `.env.example`)

`DATABASE_URL` (Neon) · `ALEX_PASSWORD` · `SESSION_SECRET` · `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini) · `TOMTOM_API_KEY` · `TAVILY_API_KEY` · optional `GOOGLE_PLACES_API_KEY` · optional `GEMINI_MODEL`. Key sources are documented inline in `.env.example`.

## 8. Verification — COMPLETE (2026-07-19, live APIs)

- `npm run build` ✓ (Next 16, all 20 routes) · `npm run lint` ✓
- Auth: `/` → 307 `/login`; wrong password → 401; correct → HttpOnly signed cookie; API without cookie → 401 ✓
- Neon: connected, `db:push` created all 7 tables ✓
- Demo seed: first dashboard load created exactly 1 DEMO lead (Annapurna Bhojanalay, score 91, full analysis) ✓
- **Live sweep** (Jaipur, tailor, google+osm): 3 Google requests → 60 scanned → 48 no-website leads; OSM step → 2 more; cross-source dedup ran; total 50 real leads ✓
- **Live Gemini analysis** on a real lead: `gemini-3.1-flash-lite`, score 92, reasoning cites the lead's real 738 reviews/4.9★, WhatsApp drafts EN + हिन्दी, site plan pages, call window ✓
- Archive flow: ✓ CONTACTED on a real lead → row appears in history CSV, lead 404s in app ✓
- Quota Guardian logged real usage exactly: google_places 4/1000 (month), gemini 1/1000 (day) ✓
- **2026-07-20 additions (all live):** TomTom-only sweep (7 Jaipur barbers, TT badges) ✓ · triple-source Noida salon sweep: Google 20 + TomTom 99 = 119 leads in one run ✓ · OSM Overpass 504 handled gracefully mid-sweep, then fallback-mirror retry added and verified (39 OSM Noida leads via mirrors) ✓ · Gemini analysis #2 (score 92) ✓ · TomTom lead refresh via Place-by-ID ✓ · verify without Tavily key → polite `.env.example` pointer ✓ · filtered CSV export ✓ · Quota Guardian shows all 4 providers, matching real usage (places 8, gemini 2, tomtom 3, tavily 0) ✓
- **Tavily verified live (2026-07-20):** real lead verify → harvested 6 FB/IG links; after expanding DIRECTORY_HOSTS (magicpin.in etc.) it correctly discovered the lead's hidden real website → verified_no_website=false. Feature working as designed. Only Vercel deployment remains untested.
- Note: ~215 REAL leads (Jaipur tailors/barbers + Noida salons) live in the DB for Sumit to use or archive; SETUP.md was deleted at Sumit's request — key docs now live inline in `.env.example`.

## 9. Repos & deployment

- GitHub targets: `Sumitkr28/Alex-ai` (personal-branded README, local branch `main`) and `xorvion-ai/Alex-ai` (Xorvion-branded README, local branch `xorvion-main` — push it as that repo's `main`). Remotes `sumit` and `xorvion` are configured; repos must exist on GitHub first (the provided PATs cannot create repos).
- Deploy target: **Vercel Hobby via the sumitkr28 account** — import repo at vercel.com/new, add all `.env` vars, deploy. Not yet deployed.
- Local `.env` exists with Sumit's chosen login password and a random SESSION_SECRET (never committed — `.env` is git-ignored); all API keys still empty.

## 10. Open TODOs (state on 2026-07-19 evening)

1. ✅ Neon: connected (screenshot had hidden a '5' in the password), tables created, everything verified.
2. ✅ Gemini key: validated live; model `gemini-3.1-flash-lite` confirmed — no override needed.
3. ✅ Google Places API (New): billing verified via **UPI (no card!)** — trial mode (auto-charge impossible). Key validated with real searches. **Quota caps are NOT adjustable on trial accounts** ("Adjust: No" in console) — and not needed: trial mode can't bill, and the in-app Guardian (verified accurate against Google's own meter) enforces 900/month. If Sumit EVER activates the account, set 35/day caps on SearchTextRequest + GetPlaceRequest FIRST. Still to do (optional): restrict key to Places API (New) in Keys & Credentials; optional usage alert at 30/day. **Never click "Activate full account"** — when the 90-day trial ends, the app auto-falls back to card-free OSM mode.
4. ✅ NEW (2026-07-20): **TomTom** added as third lead source (key set, live-tested: 100 tailor POIs in Jaipur) and **Tavily** replaces Brave for verification (Tavily account created, Researcher plan 1,000/mo, pay-as-you-go OFF — key pending from Sumit, arrives truncated in screenshots so must be pasted as text). Brave permanently rejected (card required, auto-bills past $5 credit).
5. ✅ **DEPLOYED (2026-07-20):** live at **[alex-ai-xorvion.vercel.app](https://alex-ai-xorvion.vercel.app)** via the xorvion-ai Vercel account (imported xorvion-ai/Alex-ai, env vars added, build Ready). The repo's main gets force-pushed on updates — Vercel auto-redeploys on every push.
6. Sumit: **rotate the two GitHub PATs** shared in chat (used for pushes; treat as exposed). The Google/Gemini keys also appeared in chat screenshots — key restriction (3.) mitigates; can regenerate anytime.
7. Future ideas (out of scope for v1): demo-site generator per lead, paid email enrichment, multi-user.

## 11. Key documents

- `ALEX-AI-PLAN.md` — approved product plan (source of truth for behavior)
- `Agentic AI web app design/design_handoff_alex_ai/README.md` — design tokens & screen specs (source of truth for looks)
- `.env.example` — free-tier setup guide · `README.md` — public repo readme
