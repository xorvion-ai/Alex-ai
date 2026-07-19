# Alex.ai — your autonomous lead-hunting machine

**Alex.ai** is a full-stack, agentic lead-generation system by **Xorvion**. It sweeps three independent map worlds — Google Maps, OpenStreetMap, and TomTom — for small businesses with **no website**, anywhere on Earth, verifies them across the open web, deep-analyzes each one with AI, and manages the whole pipeline until the lead is contacted. Built to run at **$0/month**, forever, with a quota guardian that makes a bill impossible.

Sign in, point it at any city, and watch qualified leads stream in — each with a score, a website plan, and outreach drafts in the lead's own language.

## 🔗 [**Live Demo — alex-ai-xorvion.vercel.app**](https://alex-ai-xorvion.vercel.app)

## ✨ Features

- **Triple-source discovery** — Google Places API (New) + OpenStreetMap Overpass + TomTom Search sweep the same city and de-duplicate against each other; a Facebook-page-only "website" is detected and tagged `SOCIAL` (often the best leads).
- **Web-wide verification** — Tavily confirms a lead truly has no website anywhere online and harvests their social links as extra contact channels.
- **AI deep analysis** — Gemini Flash Lite scores every lead 0–100 with explainable reasoning, writes a business profile from real Google reviews, a website plan (**COPY PLAN FOR CLAUDE** → paste into Claude to build the actual site), and outreach drafts: WhatsApp messages in English *and* the lead's local language plus a 5-step call script with the best time to call.
- **CRM-lite pipeline** — filters, live search, CSV export, activity log, follow-up reminders with a due-today dashboard, one-tap CALL / WhatsApp.
- **Delete-on-contact** — ✓ CONTACTED archives a full snapshot to a downloadable history CSV and removes the lead; the pipeline only ever contains live prospects.
- **Quota Guardian** — every Google/Gemini/TomTom/Tavily call is metered; jobs hard-stop at 90% of each free tier. $0/month is a guarantee, not a hope.
- **Card-free first** — OSM and TomTom discovery, Gemini analysis, and Tavily verification all run on free tiers that require **no payment method at all**; Vercel Hobby + Neon Postgres host it for free.

## 🧭 How it works

1. **Sweep** — pick country (🌍 Global works), city, business types, sources → the engine runs one quota-guarded query chunk at a time (resumable, stoppable, with Overpass mirror fallback) and streams no-website businesses into a live feed.
2. **Analyze** — one click batch-runs the AI brain over every new lead, rate-limited to the Gemini free tier, pause/resume anytime.
3. **Close** — open a lead: signals, raw data, site plan, log, outreach. Call or WhatsApp the owner, log the outcome, set a follow-up — then archive on contact.

## 📦 Project structure

```text
src/
  proxy.ts               # auth gate (signed session cookie)
  app/
    login/               # intro splash + password login
    (app)/               # Dashboard · Discover · Leads · Settings
    api/                 # sweep, analyze, verify, leads CRUD, quota, archive
  lib/
    sweep.ts             # discovery engine (chunked, resumable)
    leadsource/          # google.ts · osm.ts · tomtom.ts · normalized types
    analyze.ts           # Gemini structured analysis
    verify.ts            # Tavily web verification
    quota.ts             # Quota Guardian (guard/spend per provider)
    db/schema.ts         # Drizzle: leads, analyses, searches, activities,
                         #          quota_usage, contacted_archive, settings
ALEX-AI-PLAN.md          # product spec · PROJECT-STATUS.md — full context
.env.example             # every key documented inline (all free / no-card)
```

## 🚀 Run it locally

```bash
cp .env.example .env   # fill in keys — each line says where to get it
npm install
npm run db:push        # create tables in Neon
npm run dev            # → http://localhost:3000
```

Deploy: import the repo at [vercel.com/new](https://vercel.com/new) (Hobby plan), add the same env vars, done.

## 🏢 About Xorvion

**Xorvion** is an independent AI studio created by **Sumit Kumar**, based in Noida, India. Xorvion designs, builds, and ships AI products end-to-end — from multi-agent orchestration and free-tier-first architecture to auth, persistence, and the design system. Alex.ai is one of its flagship builds.

- 🌐 Website: [xorvion-ai.vercel.app](https://xorvion-ai.vercel.app)
- 🔗 LinkedIn: [linkedin.com/company/xorvion](https://linkedin.com/company/xorvion)
- 🐙 GitHub: [github.com/xorvion-ai](https://github.com/xorvion-ai)
- 📨 Email: [xorvion.ai@gmail.com](mailto:xorvion.ai@gmail.com)

## 👤 Creator — Sumit Kumar

AI Engineer based in Noida, India, who takes AI products from idea to production.

- 💼 LinkedIn: [linkedin.com/in/sumit-kumar2812](https://linkedin.com/in/sumit-kumar2812)
- 🌐 Portfolio: [sumitkr28.vercel.app](https://sumitkr28.vercel.app)
- 🐙 GitHub: [github.com/Sumitkr28](https://github.com/Sumitkr28)
