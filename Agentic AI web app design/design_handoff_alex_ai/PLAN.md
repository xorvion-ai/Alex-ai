# Alex.ai — Free-Tier Lead-Gen Tool Plan

> **Note for the designer:** this document describes pages and functionality only. All UI/visual design decisions are intentionally left open — decide the design yourself based on what the app needs to do.

## Context

Sumit wants a personal agentic web app, **Alex.ai**, that finds small businesses/shops **anywhere in the world** (global, not one country) that have **no website**, using Google Maps data **plus free internet sources beyond Google Maps** (OpenStreetMap, web-search verification). Each such business becomes a **lead**: the app stores its full details (name, category, address, phone, ratings, reviews, opening hours, location, Google Maps link), runs a **deep AI analysis** on it (lead quality score, business profile, suggested website content, ready-to-send outreach messages), and manages the leads in a simple pipeline so Sumit can contact the owner, build them a website with AI (outside this app), and sell it.

**Hard constraints:**
- **$0/month** — everything must run on free tiers, with safeguards so no bill is ever generated.
- **Official Google Places API only** (no scraping). This gives phone numbers, addresses, ratings, reviews — but **not emails** (emails aren't available for free; outreach will be phone/WhatsApp/visit-based).
- **Lead-gen only** — no demo-website generator inside Alex.ai. Websites get built separately with Claude.

---

## Free-Tier Stack (total: $0/month)

| Layer | Choice | Free limit (verify current numbers at build time) |
|---|---|---|
| App framework | Next.js (App Router, TypeScript) | — |
| Hosting | Vercel Hobby plan (also runs fully locally with `npm run dev`) | Free |
| Database | Neon Postgres (via Vercel Marketplace) + Drizzle ORM | ~0.5 GB — enough for 100k+ leads |
| Maps data (source 1) | **Google Places API (New)** — Text Search + Place Details. Works for **any city worldwide** | Per-SKU free monthly calls: ~10,000 Essentials / 5,000 Pro / **1,000 Enterprise** requests. The `websiteUri` + phone fields are **Enterprise-tier**, so ~1,000 free searches/month × up to 20 places each ≈ up to ~20,000 businesses scanned/month for free |
| Map data outside Google (source 2) | **OpenStreetMap via Overpass API** — global open map database; query shops/amenities by area + category, keep ones with no `website`/`contact:website` tag (phone often present via `phone`/`contact:phone` tags) | **Free and effectively unlimited** (public servers, fair-use; add polite rate limiting). No billing account at all |
| Internet check (source 3) | **Brave Search API** — for promising leads, search the web for "business name + city" to (a) verify no website exists anywhere online and (b) discover their Facebook/Instagram/WhatsApp links as extra contact channels | Free tier ~**2,000 searches/month** |
| AI analysis | Vercel AI SDK v6 + **Google Gemini Flash Lite free tier** (`gemini-3.1-flash-lite` via Google AI Studio key — verify the exact current model ID at build time) | Flash Lite has the **highest free daily request limit** of the Gemini models (~1,000+/day) → ~1,000 lead analyses/day at $0. Model string kept in one config constant so it can be swapped anytime |
| Auth | Single-user password (env var + signed session cookie via middleware) | Free, no third-party |

**Google billing reality check (must be in setup docs):** Google requires a billing account with a card even for free-tier usage. To guarantee $0: (1) in Google Cloud console, set **hard API quota caps** at/below the free-tier numbers, (2) set a budget alert at $1, and (3) Alex.ai itself tracks every call in a `quota_usage` table and refuses to run jobs once ~90% of the month's free quota is used (the **Quota Guardian**, below).

---

## Core Modules

### 1. Discovery Engine (find no-website businesses — multi-source, global)

Built as **pluggable lead sources** behind one interface (`discover(location, category) → normalized leads`), so new sources can be added later without touching the rest of the app:

- **Source: Google Places** (below) — best data quality, quota-limited.
- **Source: OpenStreetMap (Overpass API)** — free/unlimited; query `shop=*`, `amenity=*`, `craft=*` etc. in a bounding box; a business with no `website`/`contact:website` tag is a candidate lead; capture `phone`/`contact:phone`, address tags, and coordinates. Every OSM lead links to its map location too.
- **Cross-source dedup:** Google leads dedupe by `place_id`; OSM leads by OSM id; across sources, a new lead is skipped if an existing lead has a very similar normalized name within ~100 m (name + geo proximity match).
- **Web verification & social discovery (Brave Search, on-demand):** for shortlisted leads, one web search per lead confirms no website exists anywhere on the internet (OSM tags can be stale, and some businesses have sites not listed on their map profile) and captures Facebook/Instagram/WhatsApp links into `socials`. Sets a `verified_no_website` flag + confidence. Results also feed the AI analysis.

**Google Places source details:**

- Input: a location (**any city/area worldwide** — the sweep works identically for Delhi, Lagos, São Paulo, or Berlin), one or more **business categories** (restaurant, salon, plumber, tailor, garage, clinic, etc. — a curated list of Google place types), optional keyword.
- Runs **Text Search (New)** requests with an Enterprise field mask (`id, displayName, formattedAddress, location, types, rating, userRatingCount, nationalPhoneNumber, internationalPhoneNumber, websiteUri, googleMapsUri, currentOpeningHours, priceLevel`). Pages up to ~60 results per query; sweeps a city via category × neighborhood sub-queries. The **`googleMapsUri`** is stored for every lead — a direct "open this shop on Google Maps" link so Sumit can instantly see the listing, photos, and exact location.
- **The core filter:** keep only places where `websiteUri` is missing → `website_status = 'none'`. Also treat a Facebook/Instagram/WhatsApp link in `websiteUri` as **`'social_only'`** — those businesses have no real website and are often the *best* leads. Both kinds are stored; filterable in the UI.
- Deduplicates by `place_id` (upsert). Each run is recorded in `searches` with how many API requests it consumed.
- Long-running sweeps are processed in **chunks driven by the client** (each poll processes the next few queries) — keeps everything within normal function limits on the free plan, no queue infrastructure needed.

### 2. Lead Store (Postgres via Drizzle)

Tables (final schema at build time):

- `leads` — **`source`** ('google' | 'osm') + **`source_id`** (Google `place_id` or OSM element id; unique per source), name, types + primary category, address, city, country, lat/lng, phones, rating, review_count, price_level, hours JSON, **`google_maps_uri`** / map link for the listing, `website_status` ('none' | 'social_only'), **`verified_no_website`** (null until web-checked, then true/false + checked_at), socials JSON, language_hint, `status` ('new' → 'analyzed'), score, timestamps (`first_seen_at`, `last_refreshed_at`).
- `analyses` — lead_id, model used, score, summary, website_plan JSON, outreach_drafts JSON, created_at.
- `searches` — query, location, category, requests_used, results_found, leads_added, run_at.
- `activities` — lead_id, type (call / whatsapp / visit / note), note text, optional `due_at` for follow-up reminders, done flag.
- `quota_usage` — provider, SKU, period (month or day depending on provider), count.

**Google TOS note:** officially, `place_id` may be stored forever but most other place fields may only be cached ~30 days. Mitigation built in: every lead keeps its `place_id` and has a one-click **Refresh** action (re-fetch via Place Details) plus `last_refreshed_at` shown on stale leads.

### 3. AI Deep Analysis (the "agentic" brain)
For each lead, compile everything known (name, category, reviews text via a Place Details Enterprise+Atmosphere call, rating trend, hours, price level, neighborhood, country/language) and run one structured `generateObject` call (AI SDK + zod schema) producing:
- **`lead_score` (0–100) + reasoning** — how likely this business is to buy a website (signals: good rating + many reviews but no website = strong; permanently closed / low activity = weak).
- **`business_profile`** — plain-language summary of what the business is and what customers say about it (mined from reviews).
- **`website_plan`** — suggested pages, content angle, and selling points for *their* future website (this is what Sumit hands to Claude when actually building the site).
- **`outreach`** — ready-to-use first-contact drafts: a phone call script and a WhatsApp/SMS message, generated in **both English and the business's local language**, personalized with details from their reviews, plus a suggested best time to call (from opening hours).
- Batch mode: "Analyze all new leads" runs through the queue with a rate limiter tuned to Gemini's free-tier requests/day; progress shown; resumes where it stopped.

### 4. Lead Manager (CRM-lite)
- Filter/search leads by city, country, category, score, status, website_status.
- Lead detail view: all stored data + latest analysis + activity log + follow-up reminder (`due_at`), with click-to-call `tel:`, click-to-WhatsApp `wa.me`, and **"Open in Google Maps"** (`google_maps_uri`) links.
- **Delete on contacted/done:** marking a lead as **Contacted** or **Done** permanently deletes it (and its analyses/activities) from the database after a confirmation. Before deletion, the lead's row is auto-appended to a downloadable CSV archive ("contacted history") so the phone number and details aren't lost by accident — but it no longer appears anywhere in the app.
- **CSV export** of any filtered list.
- Dashboard counters: leads found / analyzed / contacted-and-deleted this month, and remaining free quota.

### 5. Quota Guardian

- Every **Google**, **Gemini**, and **Brave Search** call increments `quota_usage` (Google + Brave tracked per month, Gemini per day).
- **OpenStreetMap/Overpass has no billing at all** — it only gets a polite rate limiter (a small delay between requests), never a cost.
- Dashboard shows "X of Y free requests left" per provider.
- Jobs hard-stop at a configurable threshold (default 90% of free tier) — Alex.ai can never cause a bill even if Google-side caps are misconfigured.

---

## Pages (functionality only — visual design left entirely to the designer)

1. **Login** — single password gate.
2. **Dashboard** — pipeline stats + quota remaining + follow-ups due today.
3. **Discover** — location (any city worldwide) + categories + lead-source picker (Google Maps / OpenStreetMap / both) → live progress of the sweep → new leads found.
4. **Leads** — filterable table → **Lead detail** (data, analysis, outreach drafts, activities, refresh, status).
5. **Settings** — API keys, quota thresholds, default categories, outreach language preference.

---

## Build Phases

**Phase 1 — MVP (find & store leads)**
1. Scaffold Next.js + TypeScript in `d:\Users\sumit\coding\Alex-ai`; Drizzle + Neon; password auth middleware.
2. Google Places client with field masks + quota logging; Discovery Engine with the no-website / social-only filter; chunked sweep endpoint.
3. Leads table + lead detail page (raw data), CSV export.
4. Setup docs: Google Cloud project, enable Places API (New), API key restrictions, **quota caps + $1 budget alert**, Google AI Studio key, Neon connection.

**Phase 2 — AI brain & pipeline**
5. Analysis module (zod schema + `generateObject` on Gemini Flash Lite free tier), single-lead + batch with rate limiting.
6. Statuses, activities/notes, follow-up reminders, click-to-call/WhatsApp/Google-Maps links, delete-on-contacted with CSV archive.
7. Quota Guardian dashboard; lead Refresh action.
8. Deploy to Vercel Hobby (needs `npm i -g vercel` — CLI not installed yet); works identically when run locally.

**Phase 3 — Beyond Google Maps (internet-wide, still $0)**
9. OpenStreetMap/Overpass lead source behind the same source interface, with polite rate limiting and cross-source name+location dedup; Discover form gains a source picker (Google / OSM / both).
10. Brave Search web verification + social discovery (`verified_no_website` flag, socials capture) as an on-demand action per lead and as an optional step in batch analysis; Brave quota tracked by the Quota Guardian.

**Out of scope:** demo-website generation, paid email/social enrichment, any scraping, multi-user support, and all visual design (designer's decision).

---

## Verification
1. Run locally (`npm run dev`), log in with the password.
2. Run a Discover sweep on one small city + one category; confirm leads appear, all have no real website, each has a working map link, `quota_usage` incremented correctly, and re-running the same sweep adds no duplicates. Repeat for a **non-Indian city** (e.g., a European or African one) to confirm global coverage works the same.
2b. Run the same sweep with the OSM source; confirm OSM leads appear, and a business found by both Google and OSM shows up only once (cross-source dedup). Web-verify one lead and confirm the `verified_no_website` flag and any found socials are saved.
3. Open a lead → run analysis → confirm score, profile, website plan, and outreach drafts (English + local language) are stored and displayed; batch-analyze several leads and confirm the rate limiter and resume work.
4. Add a note with a follow-up date and confirm it appears on the dashboard; mark a lead as Contacted → confirm it's deleted from the app and its row landed in the contacted-history CSV archive; export a filtered CSV and open it.
5. Set the quota threshold artificially low and confirm the Quota Guardian blocks new sweeps.
6. Cross-check Google Cloud console: request counts match `quota_usage`, caps and budget alert are active, projected cost $0.
