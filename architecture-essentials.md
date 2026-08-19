# Architecture Essentials — Quick Reference

*Condensed from `architecture.md`. Keep this loaded as always-on context — it's short on purpose.*

## Stack
Next.js on **Vercel** — UI, **Server Actions** (all privileged writes), webhook and cron route
handlers · **Firebase**: Firestore (DB, realtime via `onSnapshot`), Firebase Auth (`role` custom
claim), Firebase Storage. SLA timers are deadline timestamps on the lead document, swept by
`/api/cron/process-deadlines`.

> `architecture.md` specifies Cloud Functions + Cloud Tasks + Cloud Scheduler. That is *not*
> what was built — see `docs/implementation-notes.md`. There is no `/functions` package.

## Entities (Firestore collections)
`users/{uid}` (role, priority) · `campaigns/{id}` · `leads/{id}` with subcollections
`followUps/{id}` (append-only) and `events/{id}` (audit log) · `closedDeals/{id}`
(Received − Payable = Profit) · `expenses/{id}` · `notifications/{id}` · `config/integrations`
(feature flags, incl. the WhatsApp placeholder).

## Non-negotiable invariants
1. Admin gets **5 minutes** to manually assign a new lead before auto-distribution takes over.
2. Auto-distribution = employee priority order + **8-lead rotation** (see architecture.md §4.2 for
   the concrete algorithm — flagged as needing Admin confirmation, don't silently change it).
3. Assigned employee gets **10 minutes** to accept before the lead auto-reassigns and a **Red Flag**
   fires to Admin.
4. `followUps` docs are **append-only** — only an `.add()` write path exists, no update Function,
   and Firestore Security Rules also deny update/delete as defense-in-depth. Never add an
   edit/delete path for follow-ups, even "just for Admin."
5. Employees can only ever query/see their **own** leads and performance — enforced by Firestore
   Security Rules (`assignedUserId == request.auth.uid`), not just hidden in the UI.
6. Nothing that touches money or follow-up history is ever hard-deleted. Disabling an employee
   preserves their historical records (soft status flag, not document deletion).
7. `Profit = Amount Received − Payable Amount`, computed server-side in the `closeDeal` Function —
   never trust a client-submitted profit value. `Net Profit = Σ Profit − Σ Expenses`.
8. Timers (5-min / 10-min) must survive redeploys/cold-starts. Implemented as deadline
   timestamps on the lead document, swept by a scheduled route — never `setTimeout` or any
   in-memory delay. Deadlines fire on the next sweep, so the real window is the SLA plus up
   to one cron interval.
9. WhatsApp send-side integration is a stubbed, switched-off seam until real credentials arrive —
   don't build a parallel path when they do, just flip `config/integrations.whatsapp.enabled`.

## Where things live
- Requirements: `docs/PRD.md` (functional reqs + the 22 numbered Business Rules, BR-1..BR-22)
- Full design: `docs/architecture.md`
- Agent behavior rules: `AGENTS.md`
- Project context/style: `GEMINI.md`

## Before building anything new
Check this file + `PRD.md §5 Business Rules` first. If a task seems to require breaking one of the
8 invariants above, stop and ask rather than assuming.
