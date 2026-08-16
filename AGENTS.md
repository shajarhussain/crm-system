# AGENTS.md

Standing instructions for any coding agent (Antigravity, Claude Code, Cursor, etc.) working in this
repo. This file governs **behavior** — how to act, what to check, when to stop and ask. For
**context** (stack, style preferences), see `GEMINI.md`. For **what to build**, see `docs/PRD.md`
and `docs/architecture.md` / `docs/architecture-essentials.md`.

## Before starting any task
1. Read `docs/architecture-essentials.md`. If the task touches lead assignment, follow-ups, or
   financials, also re-read the relevant section of `docs/architecture.md`.
2. Check `docs/PRD.md §8 Open Questions` — if your task depends on one of those unresolved items
   (8-lead rotation exact mechanics, monitoring-period length, etc.), don't guess a definitive
   behavior silently. Implement the documented default, add a `// TODO(confirm):` comment, and say
   so in your summary.

## Planning
- For anything touching more than one file, produce an implementation plan artifact before writing
  code. Wait for explicit approval before proceeding on:
  - Database schema/migrations
  - Auth/RBAC logic
  - Lead assignment/acceptance timer logic (§4.1–4.3 of architecture.md)
  - Financial calculations (profit/net profit)
- Small, obviously-scoped fixes (typo, styling tweak, single-file bug) can proceed without a plan.

## Non-negotiable invariants (do not weaken these under any framing)
- `followUps` documents are append-only. Never add an update/delete path, "for Admin" or otherwise
  — new info is always a new follow-up document. Enforce it both in the callable Function (only
  `.add()` exists) and in `firestore.rules` (`allow update, delete: if false;`).
- Employee data access is scoped in `firestore.rules` (`resource.data.assignedUserId ==
  request.auth.uid`) *and* re-checked inside callable Functions — never rely on the client SDK
  query alone or on UI hiding.
- The 5-minute assign window and 10-minute accept window must be backed by Cloud Tasks, never
  `setTimeout` or any in-memory delay — Cloud Functions instances are ephemeral and will drop
  in-memory timers on cold start/redeploy.
- No hard deletes on `leads`, `followUps`, `closedDeals`, `expenses`, `users` — disable/soft-status
  only.
- Never commit a Firebase service-account key or `.env*` file. Firebase web config (the public
  client config) is fine in the repo; Admin SDK credentials and any API secrets are Vercel
  Environment Variables or `firebase functions:secrets:set` — never both, and never in git.
- The WhatsApp integration stays behind the `config/integrations.whatsapp.enabled` flag until real
  credentials exist (see `docs/integrations/whatsapp-placeholder.md`) — don't build a second path
  or try to guess the API shape.

## Self-configuring MCP servers and skills
This repo's `.agents/mcp_config.json` lists the MCP servers this project expects (Firebase, Vercel,
GitHub, Context7, Chrome DevTools, and Sentry — the last one intentionally disabled until there's a
production deployment). `.agents/MCP_SERVERS.md` explains why each one is there and what was
deliberately left out.

Run `.agents/workflows/bootstrap-project.md` (the `/bootstrap-project` workflow) at the start of
work in any fresh environment, or whenever a connector stops working. It actually checks each
server rather than assuming, and maintains `SETUP_STATUS.md` at the repo root — a running record of
what's done automatically versus what's genuinely `WAITING ON YOU` (an OAuth click, a login, or a
secret that must come from the project owner, not be invented). Read `SETUP_STATUS.md` before
assuming the environment is ready; don't silently re-attempt a step it already marked as needing a
human.

Skills in `.agents/skills/` (e.g. `lead-distribution-rules`) need no setup — Antigravity discovers
them automatically from the folder. If a task needs a skill that doesn't exist yet (e.g. a
`financial-calculations` skill once that module is built), create one rather than re-deriving the
same rules from `architecture.md` every session.

## Testing
- The auto-distribution algorithm (`resolveNextAssignee`) and the profit/net-profit calculations are
  the highest-risk business logic in the app — write unit tests for these before considering the
  feature done, including edge cases (all employees disabled, single active employee, rotation
  wrap-around).
- After a UI change to the Admin or Employee dashboard, verify it in the browser before marking the
  task complete — and don't stop at "it renders." Use the `chrome-devtools` MCP to check
  `list_console_messages` and `list_network_requests` for the page you just touched; a page that
  looks right but is throwing a swallowed console error or a failed request is not done.

## Code & repo conventions
- Match the structure in `docs/architecture.md §8` (`/apps/web`, `/apps/api`,
  `/packages/shared-types`).
- TypeScript everywhere, strict mode on.
- Prisma migrations for every schema change — never hand-edit the database.
- No secrets in code or committed files. `.env` stays out of git; document required variables in
  `.env.example` instead.
- Conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).

## When in doubt
Prefer asking a clarifying question over inventing a business rule that isn't in `PRD.md`. This
project has real money and real customer-communication records riding on the CRM being correct.
