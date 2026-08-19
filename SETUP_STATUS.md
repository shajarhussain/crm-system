# Setup Status

What is done in the code versus what still needs a credential or a console
action. Full instructions: [`docs/deployment-runbook.md`](docs/deployment-runbook.md).

## Done in the codebase

- [x] Firestore Security Rules — deny-by-default, role-scoped reads, follow-ups
      immutable for every role
- [x] Storage rules — admin-only read, no client writes
- [x] Composite indexes for every query the app makes
- [x] Server-side auth — Firebase ID token verification with revocation checking;
      no demo or preview identities
- [x] SLA deadline sweep — auto-distribution, reassignment, red flags,
      no-follow-up alerts
- [x] Meta webhook — signature verification, Graph API lead retrieval, campaign
      resolution
- [x] Entry Module — full customer record on close, idempotent per lead
- [x] PKR currency and Asia/Karachi reporting periods
- [x] `vercel.json` cron declaration
- [x] Unit tests for the distribution algorithm and money/phone handling
- [x] Admin bootstrap and demo-data purge scripts

## Done on the live project (17 Aug 2026)

- [x] **Email/Password sign-in enabled** — was disabled, which is why no account
      could sign in (`auth/configuration-not-found`). Verified: sign-in attempts
      now return `auth/invalid-credential` rather than a config error.
- [x] **Firestore rules and indexes deployed** to `cms-system-crm`. Verified by
      an unauthenticated client read against every collection — all now return
      `permission-denied`. Before this, the whole database was readable and
      writable by anyone holding the public web API key.
- [x] **Old demo accounts confirmed non-existent** — Firebase Auth holds zero
      users, so `admin@crm.com` and `employee1@crm.com` were never created. The
      seed script would have failed on the same disabled provider. Their
      passwords are still in git history at commit `a78b08a`; do not reuse them.

## Waiting on you

- [ ] **Firebase service account** in `.env.local` and Vercel
      (`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_PROJECT_ID`)
      — until this is set, every privileged write fails
- [ ] **First admin account** — create it in the console, then
      `npm run set-admin-role -- you@company.com` to grant the role claim.
      Verify with `npm run check-auth -- you@company.com '<password>'`
- [ ] **Purge the seeded demo records** — `npm run purge-demo-data -- --confirm`.
      Declined for now; the 13 demo documents are still in the database and
      **will appear in the dashboard** as soon as an admin account exists.
- [ ] **`CRON_SECRET`** in Vercel, plus a plan or scheduler that permits
      minute-level cron — until then no SLA window is enforced
- [ ] **Firebase Storage** — not set up on the project. Only needed when expense
      receipt uploads are built; `storage.rules` is ready for it.

## Waiting on your team

- [ ] **Meta Business Manager access** — admin on the account and the Page
      running the lead ads
- [ ] **`META_APP_SECRET`** — from the Meta app, for webhook signature verification
- [ ] **`META_PAGE_ACCESS_TOKEN`** — long-lived, with `leads_retrieval`.
      Needs Advanced Access, which needs business verification. Start early.
- [ ] **`META_WEBHOOK_VERIFY_TOKEN`** — any string, entered identically here and
      in the Meta app
- [ ] **`META_AD_ACCOUNT_ID`** and `ads_read` — optional, for campaign names in
      reports
- [ ] **The live lead form's field names** — so custom or Urdu-labelled questions
      map correctly

## Waiting on the client's decision

Shipped as assumptions; changing them later means migrating data. Listed in full
in [`docs/implementation-notes.md`](docs/implementation-notes.md) §7.

- [ ] Whether the 8-lead rotation should count manual assignments
- [ ] Whether the no-follow-up window is 24 clock hours or 24 business hours
- [ ] Whether deadlines firing on the next sweep (SLA + up to one minute) is
      acceptable
- [ ] Which customer fields the Entry Module should require
- [ ] Whether admins need a way to correct a deal entry

## Phase 2 — not blocking

- [ ] WhatsApp Business API credentials. BR-11 keeps Phase 1 on manual
      click-to-chat; the send seam exists and is switched off.
