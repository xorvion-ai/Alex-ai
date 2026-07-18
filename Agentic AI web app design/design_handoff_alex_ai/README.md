# Handoff: Alex.ai — Agentic Lead-Gen Web App (a Xorvion product)

## Overview
Alex.ai is a single-user, $0/month agentic web app that finds small businesses **with no website** anywhere in the world (Google Places API + OpenStreetMap + Brave Search verification), scores them with AI (Gemini Flash Lite), and manages them in a CRM-lite pipeline: discover → analyze → contact via phone/WhatsApp → archive. Full product spec is in `PLAN.md` (this bundle) — read it first; it defines the stack (Next.js App Router + TypeScript, Vercel Hobby, Neon Postgres + Drizzle, Vercel AI SDK), free-tier quotas, DB schema, and build phases.

## About the Design Files
`Alex-ai App.dc.html` is a **design reference created in HTML** — an interactive prototype showing intended look and behavior, NOT production code. Your task is to **recreate this design in the target codebase** (Next.js + TypeScript + React per PLAN.md) using its patterns. Open the HTML file in a browser to click through every screen. All UI structure and styling in it is inline CSS — copy values from there when this README is not specific enough.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and copy are final. Recreate pixel-perfectly. Interactions in the prototype (sweep feed, batch progress) are simulations — wire them to real APIs per PLAN.md.

## Design Tokens
Colors (dark "operator console" theme — there is no light mode):
- App background: `#101214` · Deep background / sidebar / intro / login: `#0b0d0f`
- Panel/card: `#16191d` · Panel inner field: `#101214`
- Border: `#23272d` · Hairline row divider: `#1c2025` · Hover border: `#2f3640`
- Text primary: `#e6e9ed` · Body on cards: `#c3c9d1` · Secondary: `#8a929e` · Muted: `#5c646e` · Faint: `#4b525b`
- Accent green: `#4ade80` (gradient variant `linear-gradient(135deg,#6ef0a0,#2fae5e)`)
- Green tint bg: `#1d2b22` with border `#274434`
- Warning/amber (social-only, follow-ups, cautions): `#d9a13c`
- Google source badge: text `#7eb3ff` / border `#2a3a52` · OSM source badge: text `#c9a2e8` / border `#3d2f52`
- Score colors: ≥80 `#4ade80`, 60–79 `#d9d9a0`, <60 `#7a828c`

Typography (Google Fonts):
- `Space Grotesk` (400–800): UI text, headings, buttons. Page titles 20px/700; lead name 24px/700; wordmark 800 with negative letter-spacing.
- `JetBrains Mono` (400–700): all data/labels/numbers — section labels 9–10px/600 uppercase letter-spaced, scores 14–34px/700, chips 10–11px, body data 11–12.5px.
- Body/base sizes: 12–13.5px. Never below 10px except tiny badges.

Radii: cards/panels 8px, inputs/buttons 6px, small chips 4–5px, login card 10px, pills fully rounded. No shadows except: dropdowns `0 10px 30px rgba(0,0,0,.55)` and green glows `0 0 N rgba(74,222,128,.15–.45)` on primary buttons/logo.

## Brand
- **Logo**: green map-pin (gradient `#6ef0a0→#2fae5e`, rounded-square rotated 45° with `border-radius:50% 50% 50% 0`, dark dot hole) + wordmark "Alex.ai" (Space Grotesk 800, ".ai" in green) + product line "A XORVION PRODUCT" (JetBrains Mono 600, letter-spaced 3–5px, color `#aeb6c0` with "XORVION" in green `#4ade80`). The pin floats (2.6s bob) and emits a ping ring.
- **Intro/splash**: logo lockup alone, centered on `#0b0d0f`, fades in (0.8s), holds, fades out at ~2.6s; auto-advances to Login at 3.1s. No text, no button.

## Screens

### 1. Intro (splash)
Full viewport, centered lockup only (see Brand). 3 seconds → Login.

### 2. Login
Centered 380px column on radial-gradient bg (`#12161a` center → `#0b0d0f`). Lockup (54px pin + 32px wordmark + 10.5px product line), then card (`#101214`, border `#23272d`, radius 10, padding 22): "PASSWORD" label (mono 10px `#5c646e`), password input (bg `#16191d`, border `#23272d`, radius 6, padding 11/12), full-width green button "UNLOCK →" (bg `#4ade80`, text `#0b0d0f`, mono 700 13px), footnote "single-user · signed session cookie · no third-party auth" (mono 10.5px `#4b525b`). Enter key submits.

### 3. App shell (all authed screens)
Left sidebar 204px, bg `#0b0d0f`, right border `#23272d`:
- Logo lockup small (26px pin, 17px wordmark, 6.5px product line).
- Nav: ◳ Dashboard, ◎ Discover, ☰ Leads (with count), ⚙ Settings. Item: 9px/18px padding, 13px; active = bg `#16191d`, white text, 2px green left border, 600 weight; inactive = `#8a929e`.
- Bottom: **Quota Guardian** card (collapsed: label + Places bar 412/1000; expanded on click: + Gemini 231/1000·day, Brave 246/2000 bars and amber note "⛨ hard-stop at 90% — a bill is impossible"). Bars: 4px track `#23272d`, green fill.
- "⏻ LOCK" button → returns to Login.

### 4. Dashboard
Padding 26/30. Title row + date (mono 11px). Four stat cards (grid 4×1fr, gap 14): LIVE LEADS 142 / ANALYZED (green, live-updates with batch) / CONTACTED → ARCHIVED 27 (+ history.csv link) / MONTHLY COST $0 (green). Card: label mono 9.5px `#5c646e`, number mono 700 34px, sub 11px `#8a929e`.
Below, two columns (1.4fr / 1fr):
- Left: FOLLOW-UPS DUE TODAY list (time mono amber, name 600, note, kind badge; row click → opens that lead in Leads) and RECENT SWEEPS table (QUERY/WHEN/FOUND/NEW/REQUESTS).
- Right: AI BATCH ANALYSIS card (green-bordered `#274434`): status text, progress bar, button cycling ▶ ANALYZE 24 NEW LEADS → ■ PAUSE → ▶ RESUME (n LEFT) → DONE ✓; footnote about rate limiting/resume. FREE QUOTA REMAINING card: bar per provider + "openstreetmap — unlimited · rate-limited".

### 5. Discover
Left form panel 400px (border-right):
- COUNTRY **dropdown**: options are 🌍 Global first, then a country list (India, United States, United Kingdom, Germany, France, Spain, Brazil, Mexico, Nigeria, UAE, Indonesia — extendable). Selected option shown in trigger; open panel bg `#16191d`, selected row green on `#1d2b22`.
- CITY / AREA text input, KEYWORD (optional) input.
- BUSINESS TYPES multi-select chips: **"any"** first (selecting "any" clears the others; selecting a specific type clears "any"), then restaurant, salon, plumber, tailor, garage, clinic, barber, sweet shop… Selected chip: green text on `#1d2b22` w/ border `#274434`; unselected: `#8a929e` on `#16191d`.
- LEAD SOURCES toggle chips: GOOGLE PLACES / OPENSTREETMAP (both can be on) + helper line.
- START SWEEP button (green, glow). While running: "■ STOP SWEEP" (dark bg, green text). Estimate footnote.
Right: progress header (query n/12, requests, scanned, no-website count, state ● SWEEPING / ✓ COMPLETE) + progress bar; below, **live feed** — new leads slide in at top (green dot, name, source badge G/OSM, category · area, NO_SITE/SOCIAL tag). Idle state: radar circle with rotating conic sweep + "radar idle" line.

### 6. Leads (split view)
Left column 400px: search input + FILTERS toggle button (green). Filter panel (collapsible): COUNTRY dropdown (same component incl. 🌍 Global), CITY, BUSINESS TYPE chips (incl. "any"), SOURCE segmented (ALL/GOOGLE/OSM), WEBSITE STATUS (NONE/SOCIAL), SCORE ≥ slider, VERIFIED ✓ toggle, APPLY (green, shows match count) / RESET / CSV ↓.
Lead rows: score (mono 700 14px, score-colored), name 600 13px + source badge, meta line (category · ★rating·reviews · area · verified ✓), right tag SOCIAL (amber) / NO_SITE (faint). Selected: bg `#16191d` + 2px green left border.
Right detail pane:
- Header: meta line (LEAD_0042 · ANALYZED · source · refreshed 2d ago ⟳ · VERIFIED_NO_WEBSITE ✓), name 24px/700, address line + "maps ↗" link (`#7eb3ff`), score box (green border, mono 34px + STRONG/MEDIUM/WEAK).
- Action row: CALL {phone} (green solid, `tel:`), WHATSAPP (`wa.me`), VERIFY ON WEB ⌕, ⟳ REFRESH, and right-aligned "✓ CONTACTED → ARCHIVE" (confirm dialog → delete from DB + append to contacted-history CSV, per PLAN.md).
- Tabs, **in this exact order**: ANALYSIS · DATA · SITE_PLAN · LOG·n · OUTREACH (outreach deliberately last). Active tab: 2px green underline, white.
  - ANALYSIS: LEAD_SCORE reasoning card (+ model attribution), BUSINESS_PROFILE card; right rail SIGNALS (rating/reviews/website/verified), BEST_CALL_WINDOW.
  - DATA: 2-col key-value grid of raw lead fields (source, source_id, category, price, address, phone, rating, reviews, website_status, verified_no_site, hours, language_hint, first_seen, last_refreshed) + amber cache note "google cache rule: refresh if > 30d".
  - SITE_PLAN: CONTENT ANGLE card, SELLING POINTS list (green ▸), right rail SUGGESTED PAGES chips + green "COPY PLAN FOR CLAUDE" button (copies plan text).
  - LOG: activity rows (kind mono green, text, when) + add-note input (Enter or ADD button) + ⏰ FOLLOW-UP button (sets due_at).
  - OUTREACH: WhatsApp draft EN + WhatsApp draft in lead's local language (both with COPY → "COPIED ✓" feedback), PHONE CALL SCRIPT numbered steps, BEST_CALL_WINDOW.

### 7. Settings
2×2 card grid (max-width 980): API KEYS (Google Places, Google AI Studio, Brave — masked password inputs, note "keys live in env vars — never in the database"), QUOTA GUARDIAN (hard-stop threshold slider at 90%, per-provider caps list, amber console-caps note), DISCOVERY DEFAULTS (DEFAULT COUNTRY dropdown incl. 🌍 Global, default categories chips), OUTREACH (second-language select; note that drafts are always EN + lead's local language) + SAVE SETTINGS (green) → toast "Settings saved ✓" bottom-right.

## Interactions & Behavior
- Intro auto-advance (3.1s timeout). Login on Enter/click. Lock returns to login.
- Country dropdowns: click to open/close (▾/▴), click option selects + closes; one shared selected country value in the prototype.
- "any" business type is mutually exclusive with specific types.
- Sweep: chunked client-driven polling per PLAN.md; feed items animate in (`translateX(-12px)→0`, .35s); progress bar `transition:width .4s`.
- Batch analysis: pausable/resumable; progress bar `transition:width .25s`.
- Copy buttons: clipboard write + 1.5s "COPIED ✓" state. Toasts: 1.8s, bottom-right, green tint card.
- Hovers: rows lighten to `#14171a`/`#191d22`; buttons brighten (`#5ee890`) or gain green border. Animations: fadeup .3–.8s ease; pin bob 2.6s; ping ring 2.2s; radar sweep = rotating conic-gradient 3s linear.
- Delete-on-contacted, refresh, CSV export, quota hard-stop behavior: implement per PLAN.md §Core Modules.

## State Management (prototype's model — map to real data)
`screen`, `selectedLead`, `tab`, `filtersOpen`, `quotaOpen`, `country`, `catSel` (with `any`), `srcSel`, sweep state (`running/feed/queries/requests/found/new`), batch state (`running/n`), `notes`, `toast`, `copied`. Real app: leads/analyses/searches/activities/quota_usage tables per PLAN.md schema.

## Assets
No image assets. Logo is pure CSS (see Brand). Fonts from Google Fonts. Icons are unicode glyphs (◳ ◎ ☰ ⚙ ⏻ ⟳ ⌕ ⏰ ▸ ★) — replace with a proper icon set (e.g. Lucide) at parity sizes if preferred.

## Files
- `Alex-ai App.dc.html` — the full interactive prototype (all 7 screens). Open in a browser.
- `PLAN.md` — product/functional spec, stack, schema, quotas, build phases.
