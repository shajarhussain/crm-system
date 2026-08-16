# Architecture — Lead Management & CRM Platform

Companion to `PRD.md`. This is the document the coding agent should treat as the technical
source of truth. `architecture-essentials.md` is the condensed version to keep loaded every session.

---

## 1. Tech Stack (Firebase + Vercel)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (React, App Router) | One codebase for Admin + Employee apps; deployed on **Vercel** |
| Backend | **Cloud Functions for Firebase** (2nd gen, Node.js/TypeScript) | Serverless — no server to manage; callable functions handle all privileged writes so business rules live server-side, not in client code |
| Database | **Cloud Firestore** | Realtime by default (no separate WebSocket layer needed), scales automatically, native Firebase Auth integration for security rules |
| Auth | **Firebase Authentication** (email/password) + custom claims for `role` | Custom claim `role: admin\|employee`; `priority` and other mutable fields live in the Firestore `users/{uid}` doc, not in claims (claims are for slow-changing authorization facts, not business data) |
| Job queue / timers | **Cloud Tasks** targeting Cloud Functions | The 5-min assign window and 10-min accept window are business-critical delayed events — Cloud Tasks persists them server-side and survives redeploys, no Redis to run (see §6) |
| Realtime updates | Firestore `onSnapshot` listeners | Firestore pushes changes to the client natively — Admin dashboard subscribes directly, no custom realtime server |
| File storage | Firebase Storage | Expense receipts / supporting documents |
| Meta integration | Meta Lead Ads Webhook → HTTPS Cloud Function | Webhook gives near-instant intake |
| WhatsApp | `wa.me` click-to-chat now; a config seam reserved for the real WhatsApp Business API once the client provides it (see §10) | Matches BR-11; nothing to rebuild later, just fill in credentials |
| Frontend hosting | **Vercel** (per your setup) | Next.js-native, git-connected deploys |
| Backend hosting | **Firebase** (Functions, Firestore, Storage, Cloud Tasks) — same GCP project | Frontend and backend live on different platforms by design here; the Next.js app talks to Firebase via the client SDK (reads/realtime) and callable Functions (privileged writes) |

> Note: this intentionally drops the earlier Postgres/NestJS/Redis draft in favor of an
> all-Firebase backend, per your instruction to build on Firebase with Vercel for hosting.

---

## 2. High-Level System Components

```
Meta Ads ──(webhook)──▶ onMetaLeadWebhook (Cloud Function, HTTPS)
                                │  writes
                                ▼
                     Firestore: leads/{leadId}
                                │  onSnapshot (realtime, no polling)
                                ▼
              Next.js Admin Dashboard (Vercel) ── Firebase client SDK
                                │
              Cloud Tasks: enqueue "assign-deadline" (+5 min)
                     ┌──────────┴──────────┐
        Admin calls assignLead()      Task fires → onAssignDeadline
        (callable Function)                (Cloud Function)
                     │                        │
                     ▼                        ▼
             Employee gets lead      resolveNextAssignee()
                     │              (priority + 8-lead rotation)
                     ▼                        │
   Cloud Tasks: "accept-deadline" (+10 min) ◀──┘
                     │
        ┌────────────┴────────────┐
  Employee calls acceptLead()   Task fires → onAcceptDeadline
        │                          │
        ▼                          ▼
  Lead active, follow-ups   Reassign to next employee
  written via addFollowUp()  + Red Flag doc → notifications/
  (callable Function),           collection → Admin dashboard
  WhatsApp click-to-chat,        realtime alert
  eventually closeDeal()
        │
        ▼
Financial roll-up (Firestore aggregation queries or a scheduled
Function that maintains rollup docs) → Expense module → Net Profit
```

All privileged writes (assign, accept, follow-up creation, closed-deal entry, employee
management, expenses) go through **callable Cloud Functions**, never directly from the client SDK.
Firestore Security Rules then act as defense-in-depth (deny-by-default, only allow the specific
reads the role should have) — see §7.

---

## 3. Data Model (Firestore collections)

```
users/{uid}                      role, name, priority, status, createdAt
                                  (uid = Firebase Auth uid; role also mirrored into a custom claim)

campaigns/{campaignId}           name, metaCampaignId, category

leads/{leadId}                   name, phone, email, campaignId, source, createdAt, status,
                                  assignedUserId, assignedAt, acceptedAt, adminAssignDeadlineAt,
                                  acceptDeadlineAt, distributionMethod, autoRotationCycleSnapshot
  leads/{leadId}/followUps/{id}  message, callMade, callCount, whatsappNote, occurredAt, createdAt,
                                  authorUid — append-only (Security Rules + Functions both refuse
                                  update/delete; see §4.4 and §7)
  leads/{leadId}/events/{id}     type, actorUid, meta, at — audit trail, also append-only

closedDeals/{dealId}             leadId, userId, amountReceived, payableAmount,
                                  profit (computed in the callable Function, not client-trusted),
                                  enteredAt

expenses/{expenseId}             title, category, amount, date, description, addedByUid, noteUrl

notifications/{notificationId}   type, leadId, targetRole, payload, createdAt, readAt

config/integrations              single doc: { whatsapp: { enabled, phoneNumberId, ... },
                                  meta: { verifyToken } } — see §10 for the WhatsApp placeholder
```

Firestore is document-oriented, not relational — there's no foreign-key enforcement, so referential
integrity (e.g. "a lead's `campaignId` must exist") is enforced inside the callable Functions, not
the database. Composite indexes will be needed for the common Admin filters (status + campaign +
date, assignedUserId + status) — define these in `firestore.indexes.json` as they come up rather
than guessing all of them up front.

---

## 4. Core Business Logic

### 4.1 Assignment window (BR-3–BR-5)
`onMetaLeadWebhook` (HTTPS Function) writes `leads/{leadId}` with `status=NEW`, then creates a
Cloud Task on the `assign-deadline` queue scheduled for +5 minutes, targeting the
`onAssignDeadline` HTTP Function, with the `leadId` in the payload and the task's `name` set
deterministically from `leadId` (so a duplicate webhook delivery can't double-enqueue it).
- If Admin calls the `assignLead` callable Function before the task fires → it deletes the pending
  Cloud Task, sets `distributionMethod=MANUAL`, `status=ASSIGNED`, enqueues the 10-minute
  `accept-deadline` task.
- If the task fires first → `onAssignDeadline` hands off to the Auto-Distribution Engine (§4.2).

### 4.2 Auto-distribution: priority + 8-lead rotation (proposed concrete algorithm)
The source proposal states the *rule* ("after every 8 leads, rotation moves to the next-priority
employee") without pinning the exact tie-break math. Proposed, buildable interpretation — **confirm
with the Admin before launch** (see PRD Open Question 1):

1. Maintain a per-employee `autoAssignedCount` counter (resets only by explicit admin action, not
   nightly — confirm).
2. Active employees are ordered by priority (1 = highest).
3. The current "turn" employee is whoever has received fewer than 8 leads in the running cycle;
   ties broken by priority order.
4. Once an employee's count in the cycle hits 8, move to the next-priority employee and start their
   count at 0; when the lowest-priority employee completes their 8, wrap back to priority 1.
5. Disabled employees are skipped entirely and do not break the rotation sequence.

Implement this as a pure, unit-testable function (`resolveNextAssignee(employees, cycleState) →
employeeId`) — this is the single highest-risk piece of business logic in the system and needs
dedicated test coverage.

### 4.3 Acceptance window (BR-7–BR-9)
On assignment (manual or auto): enqueue an `accept-deadline` Cloud Task for +10 minutes,
targeting `onAcceptDeadline`.
- Employee calls the `acceptLead` callable Function → deletes the pending task,
  `status=ACCEPTED`, `acceptedAt=now()`.
- Task fires unaccepted → write a `leads/{leadId}/events` doc `{type: EXPIRED}`, re-run §4.2
  excluding the non-accepting employee for this pass, create a `notifications/{id}` doc
  `{type: RED_FLAG}` — the Admin dashboard's `onSnapshot` listener on `notifications` picks it up
  instantly, no extra push infrastructure needed.

### 4.4 Follow-up immutability (BR-13/BR-14)
Enforce at two layers, not just UI: (1) the `addFollowUp` callable Function is the *only* write
path and it only ever does `.add()` (create), never `.update()`/`.delete()` — there is no
`updateFollowUp`/`deleteFollowUp` Function, full stop; (2) Firestore Security Rules on
`leads/{leadId}/followUps/{id}` explicitly `allow update, delete: if false;` for every role,
including Admin, as defense-in-depth against a future Function bug. Corrections are always a new
follow-up document.

### 4.5 Financials
`ClosedDeal.profit` is computed inside the `closeDeal` callable Function
(`amountReceived − payableAmount`), never trusted from the client payload. Financial dashboard
reads aggregate either via Firestore queries filtered by date range, or — once volumes grow — via a
scheduled Function that maintains daily/monthly rollup docs (`rollups/{YYYY-MM-DD}`) so the
dashboard doesn't have to sum every document on every page load.
`Net Profit = Σ(profit) − Σ(expenses.amount)` over the selected range.

### 4.6 No-follow-up reminder (FR-18)
A **scheduled Function** (Cloud Scheduler trigger, e.g. every 30 minutes) queries
`leads where assignedUserId != null and status not in (Closed/Won, Closed/Lost)`, checks whether
the lead's most recent `followUps` doc is older than the configurable monitoring window (or absent
entirely), and writes a `notifications/{id}` doc `{type: NO_FOLLOWUP}` — guard against duplicate
notifications for the same breach by checking for an existing unresolved notification for that
`leadId` before creating a new one.

---

## 5. Function Surface (representative, not exhaustive)

Reads (lists, detail views, dashboards) go straight from the Next.js app to Firestore via the
client SDK + Security Rules — no Function needed for those. Writes and anything privileged go
through callable Functions:

```
# Callable Functions (invoked from the Next.js app via the Firebase client SDK,
# auth token attached automatically)
createEmployee(input)              # Admin only
setEmployeePriority(uid, priority) # Admin only
disableEmployee(uid)               # Admin only
assignLead(leadId, uid)            # Admin only, within the 5-min window
acceptLead(leadId)                 # the assigned Employee, within the 10-min window
reassignLead(leadId, uid)          # Admin, manual override any time
setLeadStatus(leadId, status)      # assigned Employee or Admin
addFollowUp(leadId, input)         # assigned Employee or Admin — create only, ever
closeDeal(leadId, amountReceived, payableAmount)   # assigned Employee or Admin
createExpense(input)               # Admin only
getEmployeePerformance(uid?, range)
getCampaignPerformance(campaignId?, range)
getFinancialSummary(range)

# HTTPS Functions (not callable — hit by external systems)
onMetaLeadWebhook            # Meta Lead Ads → lead intake, signature-verified
onAssignDeadline             # Cloud Tasks target for the 5-min window
onAcceptDeadline             # Cloud Tasks target for the 10-min window

# Scheduled Functions (Cloud Scheduler)
noFollowUpReminderScan       # every 30 min, see §4.6
dailyRollup                  # optional, once reporting volume needs it
```

---

## 6. Background Jobs & Scheduling — why Cloud Tasks, not `setTimeout`

The 5-minute and 10-minute windows are compliance-critical (they *are* the product, per BR-4–BR-9).
An in-process timer dies on redeploy/cold-start and silently breaks the SLA — and Cloud Functions
instances are ephemeral by design, so in-memory timers are a non-starter here regardless. Cloud
Tasks persists the scheduled call server-side (backed by GCP, no infra for you to run) and retries
on failure. Make every task handler idempotent — check the lead's current `status` before acting,
since a task could in principle be delivered more than once (Cloud Tasks is at-least-once).

---

## 7. Security & RBAC

- **Firestore Security Rules** are the outer boundary: default-deny, then explicit `allow` per
  collection based on `request.auth.token.role` and, for leads/follow-ups, `assignedUserId`. This
  is what actually enforces BR-10 (employees only see their own leads) even if a Function has a bug
  — never rely on the client hiding data.
- **Callable Functions** re-check role/ownership server-side before any write — rules are the floor,
  not the only check, since Functions run with Admin SDK privileges that bypass rules.
- Firebase Authentication handles password hashing/sessions; custom claims carry `role` and are set
  via the Admin SDK only (never client-settable).
- The Meta webhook Function verifies Meta's signature header; reject unsigned/invalid payloads.
- Firebase Admin SDK service-account credentials (used by the Next.js app on Vercel for any
  server-side calls) live in **Vercel Environment Variables**, never in the repo — see `AGENTS.md`.
- All financial and follow-up writes logged to `leads/{id}/events` — see PRD §4.11.

---

## 8. Suggested Repo Structure (single Next.js app + a `functions` package)

```
/                       # Next.js app (App Router) — deployed to Vercel
  /app
  /lib                  # Firebase client SDK init, shared helpers
/functions              # Cloud Functions for Firebase (separate package, own package.json)
  /src
    leads.ts            # assignLead, acceptLead, reassignLead, setLeadStatus
    followUps.ts        # addFollowUp
    closedDeals.ts      # closeDeal
    employees.ts        # createEmployee, setEmployeePriority, disableEmployee
    expenses.ts
    reports.ts
    webhooks.ts         # onMetaLeadWebhook
    tasks.ts            # onAssignDeadline, onAcceptDeadline
    scheduled.ts        # noFollowUpReminderScan, dailyRollup
    distribution.ts     # resolveNextAssignee() — pure, unit-tested
firestore.rules
firestore.indexes.json
firebase.json
/docs
  PRD.md
  architecture.md
  architecture-essentials.md
  integrations/whatsapp-placeholder.md
/.agents
  rules/
  skills/
  workflows/
  mcp_config.json
AGENTS.md
GEMINI.md
.env.example
```

---

## 9. Environments & Deployment

- **Frontend:** Vercel, connected to the git repo (already configured) — every push to `main`
  deploys production, PRs get preview deployments automatically.
- **Backend:** Firebase — `firebase deploy --only functions,firestore:rules,firestore:indexes`.
  Recommended: a `firebase use` alias per environment (`staging`, `production`) mapping to separate
  Firebase projects, so schema/rule changes can be tested before they touch real leads.
- **Local dev:** Firebase Emulator Suite (`firebase emulators:start`) for Firestore/Auth/Functions/
  Tasks, `vercel dev` (or `next dev`) for the frontend pointed at the emulators.
- **Secrets:** Vercel Environment Variables for anything the Next.js app needs (Firebase web config
  is public by design; the Admin SDK service-account key, if the app needs server-side Admin access,
  is a Vercel secret env var, never committed). Cloud Functions get their own secrets via
  `firebase functions:secrets:set` (Meta app secret/verify token, and later the WhatsApp API key —
  see §10).

---

## 10. WhatsApp Integration Seam (credentials pending)

The client will provide WhatsApp Business API credentials later. Build the *shape* of the
integration now, switched off, so there's no rework when the keys arrive:

- `config/integrations` Firestore doc carries `whatsapp: { enabled: false, phoneNumberId: null }`.
- Add a `sendWhatsAppMessage(leadId, message)` function in `/functions/src/whatsapp.ts` now, with
  the real HTTP call stubbed behind an `if (!config.enabled) return { skipped: true }` guard, so
  future call sites can be wired up today without knowing the final API details.
- Reserve secret names `WHATSAPP_API_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` via
  `firebase functions:secrets:set` — leave unset until the client hands them over.
- When credentials arrive: set the two secrets, flip `config/integrations.whatsapp.enabled` to
  `true`, fill in the real fetch call. No schema change, no new call sites.
- Full detail: `docs/integrations/whatsapp-placeholder.md`.
