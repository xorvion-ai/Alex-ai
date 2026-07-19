# Alex.ai

**A free tool that finds small businesses with no website — anywhere on Earth — so you can build them one and sell it.**

Alex.ai sweeps Google Maps *and* OpenStreetMap for shops, restaurants, salons, garages… that have **zero web presence**, deep-analyzes each one with AI, and hands you everything you need to close them: a lead score, a website plan, and ready-to-send outreach in their own language. Total running cost: **$0/month**.

## What it does

Pick any city — Jaipur, Lagos, Berlin, São Paulo — and hit **START SWEEP**. Every business found gets tagged:

🟢 NO_SITE · 🟡 SOCIAL-ONLY (Facebook/Instagram page pretending to be a website — often the *best* leads)

…then the AI brain tells you exactly **who to call first and what to say**.

## Why it's different

Most lead-gen tools stop at "here's a list." Alex.ai runs the whole hunt:

- Searches **three independent map sources** (Google Places API + OpenStreetMap + TomTom) and de-duplicates across them
- **Verifies across the entire web** (Tavily) that the business truly has no website anywhere
- **Reads their Google reviews** and scores how likely they are to buy a website (0–100)
- Writes a **website plan** you can paste straight into Claude to build their site
- Drafts **WhatsApp messages + a phone call script** — in English *and* the lead's local language
- Deletes leads automatically once contacted (archived to CSV first) — your pipeline stays clean
- A built-in **Quota Guardian** hard-stops every provider at 90% of its free tier — a bill is impossible

## Features

- ⚡ Live sweep feed — leads stream in as the radar finds them
- 🌍 Global — works for any city, in any country, in any language
- 🧠 Explainable lead scores — see exactly *why* a lead scored 91
- 📞 One-tap CALL / WhatsApp buttons on every lead
- 📋 CSV export of any filtered list + contacted-history archive
- 🗓 Follow-up reminders with a due-today dashboard
- 🔒 Single-password login, your data in your own free Postgres

## Tech behind it

| Layer | Stack |
| --- | --- |
| Frontend + API | Next.js 16 (App Router) · TypeScript · React 19 |
| Database | Neon Postgres (free tier) · Drizzle ORM |
| AI | Vercel AI SDK · Gemini Flash Lite (free tier) — structured output |
| Lead sources | Google Places API (New) · OpenStreetMap Overpass + Nominatim · TomTom Search |
| Web verification | Tavily (free tier, no card) |
| Hosting | Vercel Hobby — 100% free tier |

## Architecture

```text
┌─────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│  Next.js UI     │ ──► │  Sweep engine        │ ──► │  Google Places (New) │
│  (Vercel)       │     │  chunked, resumable  │     │  OSM · TomTom        │
└─────────────────┘     └──────────┬───────────┘     └──────────────────────┘
        │                          ▼
        │               ┌──────────────────────┐     ┌──────────────────────┐
        │               │  Quota Guardian      │     │  Gemini Flash Lite   │
        └─────────────► │  hard-stop @ 90%     │ ──► │  score · site plan   │
                        │  of every free tier  │     │  outreach drafts     │
                        └──────────────────────┘     └──────────────────────┘
```

Leads live in your own Neon Postgres. No tracking, no third parties, no cost.

## Get started

Product spec: [ALEX-AI-PLAN.md](./ALEX-AI-PLAN.md) · every key you need (and where to get it, all free/no-card) is documented inline in [.env.example](./.env.example)

```bash
cp .env.example .env   # fill in keys — each line says where to get it
npm install
npm run db:push
npm run dev            # → http://localhost:3000
```

## 👋 About the creator

Hi, I'm **Sumit Kumar** — an AI/ML Engineer based in Noida, India. I design, build, and ship production-grade AI products end-to-end, and I built Alex.ai across every layer: the multi-source discovery engine, the quota-guarded free-tier architecture, the AI analysis pipeline, and the Next.js interface.

I'm always open to connecting with recruiters, founders, and fellow builders — if you like what you see here, let's talk.

- 🌐 Portfolio: [sumitkr28.vercel.app](https://sumitkr28.vercel.app)
- 💼 LinkedIn: [linkedin.com/in/sumit-kumar2812](https://linkedin.com/in/sumit-kumar2812)
- 🐙 GitHub: [github.com/Sumitkr28](https://github.com/Sumitkr28)
- 🚀 AI Studio: **Xorvion**
