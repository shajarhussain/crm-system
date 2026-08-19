"use server";

import { adminDb } from "@/lib/firebase/server";
import { verifyAuth, requireAdmin } from "@/lib/firebase/serverAuth";
import { runAction, UserFacingError, type ActionResult } from "@/lib/actionResult";
import { isTerminal, isUserSettable, type LeadStatus } from "@/lib/leadStatus";
import { FieldValue, Transaction } from "firebase-admin/firestore";

const ACCEPT_WINDOW_MS = 10 * 60_000; // BR-7

/**
 * Manual assignment inside the 5-minute window (FR-8, BR-4).
 *
 * Runs in a transaction with a status guard so it cannot race the cron sweep:
 * whichever of the two commits first wins, and the loser sees the changed
 * status and aborts. Without this, an admin clicking "Assign" at 4:59 could
 * overwrite an auto-assignment that landed at 5:00, leaving two employees
 * believing the lead is theirs.
 */
export async function assignLead(
  token: string,
  leadId: string,
  userId: string
): Promise<ActionResult> {
  return runAction("assignLead", async () => {
    const admin = await requireAdmin(token);

    await adminDb.runTransaction(async (t: Transaction) => {
      const leadRef = adminDb.collection("leads").doc(leadId);
      const leadSnap = await t.get(leadRef);

      if (!leadSnap.exists) {
        throw new UserFacingError("That lead no longer exists.");
      }

      const lead = leadSnap.data()!;
      if (lead.status !== "NEW" && lead.status !== "UNASSIGNED_NO_CAPACITY") {
        throw new UserFacingError(
          `This lead has already moved on — it is now ${lead.status.replace(/_/g, " ").toLowerCase()}. Use Reassign instead.`
        );
      }

      const employee = await readAssignableEmployee(t, userId);

      const deadline = new Date(Date.now() + ACCEPT_WINDOW_MS);
      t.update(leadRef, {
        assignedUserId: userId,
        assignedAt: FieldValue.serverTimestamp(),
        // Baseline for the no-follow-up scan (FR-18) — the clock starts now.
        lastActivityAt: FieldValue.serverTimestamp(),
        distributionMethod: "MANUAL",
        status: "ASSIGNED",
        acceptDeadlineAt: deadline,
        adminAssignDeadlineAt: FieldValue.delete(),
        attemptedAssignees: FieldValue.arrayUnion(userId),
      });

      t.create(leadRef.collection("events").doc(), {
        type: "MANUALLY_ASSIGNED",
        actorUid: admin.uid,
        at: FieldValue.serverTimestamp(),
        meta: { assignedTo: userId, assigneeEmail: employee.email ?? null },
      });
    });
  });
}

/**
 * Admin override, available at any time (FR-11, BR-22).
 *
 * Clears the attempted-assignee list: the admin is making a deliberate choice,
 * so the anti-ping-pong exclusions from earlier automatic passes no longer apply.
 */
export async function reassignLeadManual(
  token: string,
  leadId: string,
  newUserId: string
): Promise<ActionResult> {
  return runAction("reassignLeadManual", async () => {
    const admin = await requireAdmin(token);

    await adminDb.runTransaction(async (t: Transaction) => {
      const leadRef = adminDb.collection("leads").doc(leadId);
      const leadSnap = await t.get(leadRef);

      if (!leadSnap.exists) {
        throw new UserFacingError("That lead no longer exists.");
      }

      const lead = leadSnap.data()!;
      if (isTerminal(lead.status)) {
        throw new UserFacingError("This lead is closed and cannot be reassigned.");
      }
      if (lead.assignedUserId === newUserId) {
        throw new UserFacingError("This lead is already assigned to that employee.");
      }

      const employee = await readAssignableEmployee(t, newUserId);

      t.update(leadRef, {
        assignedUserId: newUserId,
        assignedAt: FieldValue.serverTimestamp(),
        lastActivityAt: FieldValue.serverTimestamp(),
        acceptedAt: FieldValue.delete(),
        distributionMethod: "MANUAL",
        status: "ASSIGNED",
        acceptDeadlineAt: new Date(Date.now() + ACCEPT_WINDOW_MS),
        adminAssignDeadlineAt: FieldValue.delete(),
        attemptedAssignees: [newUserId],
      });

      t.create(leadRef.collection("events").doc(), {
        type: "MANUALLY_REASSIGNED",
        actorUid: admin.uid,
        at: FieldValue.serverTimestamp(),
        meta: {
          previousAssignee: lead.assignedUserId ?? null,
          newAssignee: newUserId,
          assigneeEmail: employee.email ?? null,
        },
      });
    });
  });
}

/**
 * Employee accepts a lead inside their 10-minute window (FR-10, BR-7).
 *
 * Enforces three things the previous implementation left open: that the caller
 * is the assigned employee, that the lead is actually awaiting acceptance, and
 * that the window has not already closed.
 */
export async function acceptLead(token: string, leadId: string): Promise<ActionResult> {
  return runAction("acceptLead", async () => {
    const auth = await verifyAuth(token);

    await adminDb.runTransaction(async (t: Transaction) => {
      const leadRef = adminDb.collection("leads").doc(leadId);
      const leadSnap = await t.get(leadRef);

      if (!leadSnap.exists) {
        throw new UserFacingError("That lead no longer exists.");
      }

      const lead = leadSnap.data()!;

      if (auth.role !== "admin" && lead.assignedUserId !== auth.uid) {
        throw new UserFacingError("This lead is not assigned to you.");
      }
      if (lead.status === "ACCEPTED") {
        throw new UserFacingError("You have already accepted this lead.");
      }
      if (lead.status !== "ASSIGNED") {
        throw new UserFacingError("This lead is not waiting to be accepted.");
      }

      const deadline = lead.acceptDeadlineAt?.toDate?.() ?? lead.acceptDeadlineAt;
      if (deadline instanceof Date && deadline.getTime() < Date.now()) {
        throw new UserFacingError(
          "Your 10-minute window for this lead has passed. It is being passed to the next employee."
        );
      }

      t.update(leadRef, {
        status: "ACCEPTED",
        acceptedAt: FieldValue.serverTimestamp(),
        lastActivityAt: FieldValue.serverTimestamp(),
        acceptDeadlineAt: FieldValue.delete(),
      });

      t.create(leadRef.collection("events").doc(), {
        type: "LEAD_ACCEPTED",
        actorUid: auth.uid,
        at: FieldValue.serverTimestamp(),
        meta: { acceptedBy: auth.uid },
      });
    });
  });
}

/**
 * Status change by the assigned employee or an admin (FR-13).
 *
 * CLOSED_WON is rejected here on purpose: BR-18 requires every won deal to pass
 * through the Entry Module, so `closeDeal` is the only route into that status.
 */
export async function setLeadStatus(
  token: string,
  leadId: string,
  status: LeadStatus
): Promise<ActionResult> {
  return runAction("setLeadStatus", async () => {
    const auth = await verifyAuth(token);

    if (status === "CLOSED_WON") {
      throw new UserFacingError(
        "To mark a deal as won, use the Deal Entry tab so the customer record and amounts are captured."
      );
    }
    if (!isUserSettable(status)) {
      throw new UserFacingError("That status is managed by the system and cannot be set by hand.");
    }

    await adminDb.runTransaction(async (t: Transaction) => {
      const leadRef = adminDb.collection("leads").doc(leadId);
      const leadSnap = await t.get(leadRef);

      if (!leadSnap.exists) {
        throw new UserFacingError("That lead no longer exists.");
      }

      const lead = leadSnap.data()!;

      if (auth.role !== "admin" && lead.assignedUserId !== auth.uid) {
        throw new UserFacingError("This lead is not assigned to you.");
      }
      if (isTerminal(lead.status)) {
        throw new UserFacingError(
          "This lead is closed. Its record is kept as-is — add a follow-up note if something changed."
        );
      }
      if (lead.status === "ASSIGNED") {
        throw new UserFacingError("Accept this lead before updating its status.");
      }
      if (lead.status === status) {
        return;
      }

      t.update(leadRef, { status });

      t.create(leadRef.collection("events").doc(), {
        type: "STATUS_CHANGED",
        actorUid: auth.uid,
        at: FieldValue.serverTimestamp(),
        meta: { from: lead.status, to: status },
      });
    });
  });
}

/**
 * Loads a user and confirms they can receive leads.
 * Reads through the transaction so the check is part of the same snapshot.
 */
async function readAssignableEmployee(t: Transaction, uid: string) {
  const userSnap = await t.get(adminDb.collection("users").doc(uid));
  if (!userSnap.exists) {
    throw new UserFacingError("That employee no longer exists.");
  }

  const user = userSnap.data()!;
  if (user.role !== "employee") {
    throw new UserFacingError("Leads can only be assigned to employees.");
  }
  if (user.status === "DISABLED") {
    throw new UserFacingError("That employee is disabled and cannot receive new leads.");
  }

  return user;
}
