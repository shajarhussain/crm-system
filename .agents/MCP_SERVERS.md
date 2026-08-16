# MCP Servers — Chosen Set & Why

This project's `.agents/mcp_config.json` is deliberately short. Every entry earns its place because
it does something Antigravity can't already do natively, and directly supports "runs on its own,
few errors" — not because it's popular in general MCP round-ups.

## In the config

| Server | Role | Human step required |
|---|---|---|
| `firebase` | Firestore/Auth/Functions/Storage — schema checks, deploys, log reads | `firebase login` once (browser) |
| `vercel` | Deployments, env vars, logs, domains | One-time OAuth consent |
| `github` | Repo/PR/issue operations (git CLI itself is already configured separately) | Personal access token, `repo`+`read:org`+`read:user` scopes |
| `context7` | Live Next.js/Firebase API docs, so the agent isn't coding against stale training data | None — no auth needed |
| `chrome-devtools` | Console errors, network requests, performance traces on a live-rendered page | None — connects to the browser Antigravity already drives |
| `sentry` *(off by default)* | Production error monitoring once deployed — turn on when you have real users | Sentry account + auth token |

## Deliberately left out (and why)

Two other lists got passed around for this project — a generic "any coding agent" list and a
broader Antigravity-specific one. Here's what didn't make the cut and why, so it's a decision, not
an oversight:

- **Postgres / Supabase MCP** — not needed. This project's database is **Firestore**, not
  Postgres/Supabase. The Firebase MCP already covers Firestore.
- **Filesystem MCP** — redundant. Antigravity has native file read/write/navigate built in; this is
  what Cline/generic MCP clients need it for, not Antigravity.
- **Puppeteer MCP** — superseded by `chrome-devtools` (which itself is puppeteer-based) and
  Antigravity's own built-in browser subagent for visual verification/screenshots.
- **Fetch / Brave Search MCP** — `context7` covers the specific "current library docs" need better
  than generic web search; add a general search MCP later only if the agent is regularly missing
  non-doc information it needs.
- **BigQuery / AlloyDB MCP** — this is for data-warehouse/analytics-heavy projects. Nothing in this
  CRM needs a data warehouse; Firestore + the reporting queries in `architecture.md §5` cover it.
- **Windsor.ai / HubSpot MCP** — these aggregate *external* marketing/CRM platforms into your
  workflow. You're building the CRM, not connecting to one, so this doesn't apply.
- **Google Workspace MCP** — genuinely optional, not excluded for a real reason. Only worth adding
  if you want the agent pulling live specs from Google Docs instead of files you hand it directly
  (you've been handing it PDFs/direct requests, so skipped for now).
- **Composio (or Arcade/Rube)** — kept out of the default config, not the plan. Once the WhatsApp
  Business API and/or Meta Ads Manager cross-checks become real work (post-credentials), one of
  these "universal bridge" services is the right way to reach them, since neither has a clean
  first-party MCP today. Add it at that point rather than now, so the agent doesn't have unused
  tools cluttering its context in the meantime — see `frontend-design`-style principle of
  "don't overwhelm the agent" in the Antigravity docs.

## The "no error, runs on its own" pairing

Two of the above work together specifically for your reliability goal:
- `chrome-devtools` lets the agent read actual browser console errors and failed network requests
  after it makes a UI change — not just "the screenshot looks right."
- `sentry` (once turned on post-launch) closes the loop in production: real user errors flow back
  to the agent instead of you having to notice and report them.
