"use server";

import { adminDb, adminAuth } from "@/lib/firebase/server";
import { requireAdmin } from "@/lib/firebase/serverAuth";
import { runAction, UserFacingError, type ActionResult } from "@/lib/actionResult";
import { FieldValue } from "firebase-admin/firestore";

export interface CreateEmployeeInput {
  name: string;
  email: string;
  password: string;
  priority: number;
}

/**
 * Creates an employee account (FR-1, BR-1).
 *
 * The Auth user and the profile document are created together; if the profile
 * write fails the Auth user is removed again, so a half-created employee who
 * can sign in but has no role never exists.
 */
export async function createEmployee(
  token: string,
  input: CreateEmployeeInput
): Promise<ActionResult<{ uid: string }>> {
  return runAction("createEmployee", async () => {
    const admin = await requireAdmin(token);

    const name = (input.name ?? "").trim();
    const email = (input.email ?? "").trim().toLowerCase();
    const password = input.password ?? "";
    const priority = normalizePriority(input.priority);

    if (!name) {
      throw new UserFacingError("Enter the employee's name.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new UserFacingError("Enter a valid email address.");
    }
    if (password.length < 8) {
      throw new UserFacingError("The password must be at least 8 characters.");
    }

    let userRecord;
    try {
      userRecord = await adminAuth.createUser({ email, password, displayName: name });
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === "auth/email-already-exists") {
        throw new UserFacingError("An account with that email already exists.");
      }
      if (code === "auth/invalid-password") {
        throw new UserFacingError("That password is not strong enough.");
      }
      throw error;
    }

    try {
      await adminAuth.setCustomUserClaims(userRecord.uid, { role: "employee" });

      await adminDb.collection("users").doc(userRecord.uid).create({
        name,
        email,
        role: "employee",
        priority,
        status: "ACTIVE",
        createdAt: FieldValue.serverTimestamp(),
        createdByUid: admin.uid,
      });
    } catch (error) {
      // Roll back so we never leave an account that can sign in but has no profile.
      await adminAuth.deleteUser(userRecord.uid).catch(() => {});
      throw error;
    }

    return { uid: userRecord.uid };
  });
}

/** Changes an employee's rotation priority (FR-1, BR-2). */
export async function setEmployeePriority(
  token: string,
  uid: string,
  priority: number
): Promise<ActionResult> {
  return runAction("setEmployeePriority", async () => {
    await requireAdmin(token);
    const next = normalizePriority(priority);

    const userRef = adminDb.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists || snap.data()?.role !== "employee") {
      throw new UserFacingError("That employee no longer exists.");
    }

    await userRef.update({ priority: next });
  });
}

/** Updates an employee's display name (FR-1). */
export async function setEmployeeName(
  token: string,
  uid: string,
  name: string
): Promise<ActionResult> {
  return runAction("setEmployeeName", async () => {
    await requireAdmin(token);

    const trimmed = (name ?? "").trim();
    if (!trimmed) {
      throw new UserFacingError("Enter a name.");
    }

    await adminDb.collection("users").doc(uid).update({ name: trimmed });
    await adminAuth.updateUser(uid, { displayName: trimmed }).catch(() => {});
  });
}

/**
 * Disables an employee (FR-2, FR-3, BR-22).
 *
 * Never deletes. The Auth account is disabled so they cannot sign in, and
 * because `verifyAuth` checks for revocation their existing session stops
 * working immediately rather than lasting until the token expires. All of their
 * historical leads, follow-ups and deals stay exactly where they are.
 */
export async function disableEmployee(token: string, uid: string): Promise<ActionResult<{ openLeads: number }>> {
  return runAction("disableEmployee", async () => {
    const admin = await requireAdmin(token);

    if (uid === admin.uid) {
      throw new UserFacingError("You cannot disable your own account.");
    }

    const userRef = adminDb.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      throw new UserFacingError("That employee no longer exists.");
    }

    await adminAuth.updateUser(uid, { disabled: true });
    await adminAuth.revokeRefreshTokens(uid);
    await userRef.update({
      status: "DISABLED",
      disabledAt: FieldValue.serverTimestamp(),
      disabledByUid: admin.uid,
    });

    // Tell the admin how many leads now need rehoming (FR-3).
    const openLeads = await adminDb
      .collection("leads")
      .where("assignedUserId", "==", uid)
      .where("status", "in", ["ASSIGNED", "ACCEPTED", "CONTACTED", "FOLLOW_UP", "INTERESTED", "NEGOTIATION"])
      .count()
      .get();

    return { openLeads: openLeads.data().count };
  });
}

/** Brings a disabled employee back (FR-2 — the missing half of disable). */
export async function enableEmployee(token: string, uid: string): Promise<ActionResult> {
  return runAction("enableEmployee", async () => {
    const admin = await requireAdmin(token);

    const userRef = adminDb.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      throw new UserFacingError("That employee no longer exists.");
    }

    await adminAuth.updateUser(uid, { disabled: false });
    await userRef.update({
      status: "ACTIVE",
      disabledAt: FieldValue.delete(),
      disabledByUid: FieldValue.delete(),
      reEnabledAt: FieldValue.serverTimestamp(),
      reEnabledByUid: admin.uid,
    });
  });
}

function normalizePriority(value: unknown): number {
  const priority = Math.floor(Number(value));
  if (!Number.isFinite(priority) || priority < 1 || priority > 20) {
    throw new UserFacingError("Priority must be a number between 1 and 20.");
  }
  return priority;
}
