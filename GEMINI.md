# GEMINI.md — Project Context for Antigravity

*This file is auto-loaded by Antigravity at the start of every session in this workspace. It's the
"ambient context" file — coding style and project facts. Behavior rules live in `AGENTS.md`;
Antigravity reads both and merges them (GEMINI.md wins on conflicts).*

## What this project is
Lead Management & CRM Platform: Meta Ads leads → automatic/manual distribution to employees →
tracked follow-ups → closed-deal financials → performance/campaign/financial reporting. Full detail
in `docs/PRD.md` and `docs/architecture.md`.

## Stack
Next.js on **Vercel** (frontend, git-connected auto-deploy) · **Firebase** for everything else:
Cloud Functions (backend logic, callable + HTTPS + scheduled), Firestore (DB, realtime via
`onSnapshot`), Firebase Auth, Firebase Storage, Cloud Tasks for the business-critical 5-min/10-min
timers. Repo layout: Next.js app at root, Cloud Functions in `/functions` — see
`docs/architecture.md §8`. Git CLI is already configured in this workspace; use it normally.

## Docs to treat as source of truth
- `docs/PRD.md` — functional requirements, roles, the 22 numbered Business Rules (BR-1..BR-22), and
  open questions that still need Admin confirmation.
- `docs/architecture.md` — full technical design, data model, API surface, business-logic algorithms.
- `docs/architecture-essentials.md` — condensed cheat sheet, check this first every session.
- `AGENTS.md` — behavior rules (planning, testing, invariants) for the agent itself.

## Coding style preferences
- TypeScript, strict mode, no `any` without a comment justifying it.
- Prefer small, pure, unit-testable functions for business logic (especially lead distribution and
  financial calculations) over logic buried inside controllers.
- REST naming: plural nouns, nested resources for follow-ups/closed-deals under `/leads/:id/...`.
- Keep Admin-only and Employee-only UI in clearly separate route groups, not conditionally rendered
  from one shared page.

## MCP servers available in this workspace
See `.agents/mcp_config.json` for the live config and `.agents/MCP_SERVERS.md` for what each one
does and — just as important — what was deliberately left out and why (Postgres/Supabase, Filesystem,
Puppeteer, BigQuery, Windsor.ai/HubSpot don't apply to this Firebase-backed CRM). The set: the
official **Firebase MCP**, official **Vercel MCP**, **GitHub MCP**, **Context7** (live docs),
**Chrome DevTools MCP** (console/network/performance — catches errors a screenshot won't), and
**Sentry** (production error monitoring, off until there's a real deployment with users).

**First session in this workspace, or any time setup drifts:** run the `/bootstrap-project`
workflow (`.agents/workflows/bootstrap-project.md`). It's self-checking — it actually verifies each
server connects rather than assuming, and it maintains `SETUP_STATUS.md` at the repo root as a
running record of what's done automatically versus what's still `WAITING ON YOU` (a login click or
a secret only you should provide). Check `SETUP_STATUS.md` before assuming the environment is fully
configured.

## Response language / tone
Plain, direct engineering explanations. Flag assumptions explicitly rather than silently picking one
when `PRD.md §8` lists something as an open question.
