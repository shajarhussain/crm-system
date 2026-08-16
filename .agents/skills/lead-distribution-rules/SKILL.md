---
name: lead-distribution-rules
description: Use whenever implementing or modifying lead assignment, auto-distribution, acceptance timers, or red-flag logic in this CRM. Covers the 5-minute admin window, 10-minute accept window, and 8-lead priority rotation.
---

# Lead Distribution Rules

Reference: `docs/architecture.md §4.1–4.3`, `docs/PRD.md §5 BR-3..BR-9`.

## Rules
1. New lead → Admin has 5 minutes to manually assign. Use a persisted delayed job, not `setTimeout`.
2. If unassigned after 5 minutes → hand off to `resolveNextAssignee()`, which implements priority
   order + 8-lead rotation (see architecture.md for the exact algorithm — flagged as needing Admin
   confirmation before launch).
3. Assigned employee has 10 minutes to accept, also via a persisted delayed job.
4. No acceptance in time → reassign via `resolveNextAssignee()` excluding the non-accepting
   employee for that pass, log a `LeadEvent(type=EXPIRED)`, create a `Notification(type=RED_FLAG)`.
5. Disabled employees are skipped in rotation without breaking the sequence.
6. All of this logic must be pure and unit-tested independently of the HTTP/job-queue plumbing.

## When touching this code
- Don't shortcut the timers with in-memory delays "for now" — this is the one area the business
  proposal is strict about (BR-4, BR-7).
- If a change would alter how the 8-lead rotation counts, flag it explicitly rather than adjusting
  it quietly — it's an open confirmation item with the Admin (PRD §8, item 1).
