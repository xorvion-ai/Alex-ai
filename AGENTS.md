<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Alex.ai

**Read `PROJECT-STATUS.md` first** — it holds the complete project context: what the product is, hard constraints (must stay $0/month, Quota Guardian, no scraping, delete-on-contact, fixed design), architecture, DB schema, API map, verification state, and open TODOs.

- Product behavior spec: `ALEX-AI-PLAN.md` · Design spec: `Agentic AI web app design/design_handoff_alex_ai/README.md` · Keys/setup: `.env.example` (inline docs)
- Commands: `npm run dev` · `npm run build` · `npm run lint` · `npm run db:push` (needs `.env`)
- Never introduce paid API usage; every external call must go through `guard()`/`spend()` in `src/lib/quota.ts`.
