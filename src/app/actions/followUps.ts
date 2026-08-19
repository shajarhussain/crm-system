"use server";

import { adminDb } from "@/lib/firebase/server";
import { verifyAuth } from "@/lib/firebase/serverAuth";
import { runAction, UserFacingError, type ActionResult } from "@/lib/actionResult";
import { FieldValue, Transaction } from "firebase-admin/firestore";

export interface FollowUpInput {
  message: string;
  callMade: boolean;
  callCount?: number;
  whatsappNote?: string;
  /** ISO datetime — lets an employee log a call they made earlier (FR-15). */
  occurredAt?: string;
}

/**
 * Adds a follow-up (FR-14, FR-15).
 *
 * This is the only write path for follow-ups and it only ever creates. There is
 * deliberately no update or delete action anywhere in this codebase, and the
 * Security Rules deny both for every role including admin — BR-13/BR-14 make
 * that a two-layer guarantee. Corrections are made by adding a new entry.
 */
export async function addFollowUp(
  token: string,
  leadId: string,
  input: FollowUpInput
): Promise<ActionResult<{ followUpId: string }>> {
  return runAction("addFollowUp", async () => {
    const auth = await verifyAuth(token);

    const message = (input.message ?? "").trim();
    if (!message) {
      throw new UserFacingError("Write what happened before saving the follow-up.");
    }
    if (message.length > 5000) {
      throw new UserFacingError("That note is too long — keep it under 5000 characters.");
    }

    const callMade = Boolean(input.callMade);
    const callCount = callMade ? clampCallCount(input.callCount) : 0;
    const occurredAt = parseOccurredAt(input.occurredAt);

    return adminDb.runTransaction(async (t: Transaction) => {
      const leadRef = adminDb.collection("leads").doc(leadId);
      const leadSnap = await t.get(leadRef);

      if (!leadSnap.exists) {
        throw new UserFacingError("That lead no longer exists.");
      }

      const lead = leadSnap.data()!;
      if (auth.role !== "admin" && lead.assignedUserId !== auth.uid) {
        throw new UserFacingError("This lead is not assigned to you.");
      }
      if (lead.status === "ASSIGNED") {
        throw new UserFacingError("Accept this lead before logging a follow-up.");
      }

      const followUpRef = leadRef.collection("followUps").doc();

      t.create(followUpRef, {
        message,
        callMade,
        callCount,
        whatsappNote: (input.whatsappNote ?? "").trim() || null,
        occurredAt,
        createdAt: FieldValue.serverTimestamp(),
        authorUid: auth.uid,
        authorEmail: auth.email ?? null,
      });

      // Denormalised onto the lead so the no-follow-up scan (FR-18) is a single
      // query instead of a subcollection read per active lead.
      t.update(leadRef, {
        lastFollowUpAt: FieldValue.serverTimestamp(),
        lastActivityAt: FieldValue.serverTimestamp(),
        followUpCount: FieldValue.increment(1),
        callCount: FieldValue.increment(callCount),
      });

      t.create(leadRef.collection("events").doc(), {
        type: "FOLLOW_UP_ADDED",
        actorUid: auth.uid,
        at: FieldValue.serverTimestamp(),
        meta: { followUpId: followUpRef.id, callMade, callCount },
      });

      return { followUpId: followUpRef.id };
    });
  });
}

function clampCallCount(value: unknown): number {
  const count = Math.floor(Number(value));
  if (!Number.isFinite(count) || count < 1) return 1;
  return Math.min(count, 100);
}

/**
 * A follow-up can be backdated — an employee logging this morning's calls at
 * lunchtime is normal — but not postdated, which would corrupt the timeline.
 */
function parseOccurredAt(raw: string | undefined): Date {
  if (!raw) return new Date();

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date();

  if (parsed.getTime() > Date.now() + 60_000) {
    throw new UserFacingError("A follow-up cannot be dated in the future.");
  }
  return parsed;
}
