import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getFunctions } from "firebase-admin/functions";

export const assignLead = onCall(async (request) => {
  if (!request.auth || request.auth.token.role !== "admin") {
    throw new HttpsError("permission-denied", "Only admins can manually assign leads.");
  }

  const { leadId, userId } = request.data;
  const db = admin.firestore();

  await db.runTransaction(async (t) => {
    const leadRef = db.collection("leads").doc(leadId);
    const leadSnap = await t.get(leadRef);

    if (!leadSnap.exists) {
      throw new HttpsError("not-found", "Lead not found");
    }

    const leadData = leadSnap.data();
    if (leadData?.status !== "NEW") {
      throw new HttpsError("failed-precondition", "Lead is not in NEW status");
    }

    t.update(leadRef, {
      assignedUserId: userId,
      assignedAt: admin.firestore.FieldValue.serverTimestamp(),
      distributionMethod: "MANUAL",
      status: "ASSIGNED"
    });

    const queue = getFunctions().taskQueue("onacceptdeadline");
    await queue.enqueue(
      { leadId, assignedUserId: userId },
      {
        scheduleDelaySeconds: 10 * 60,
        dispatchDeadlineSeconds: 60 * 5,
      }
    );
  });

  return { success: true };
});

export const acceptLead = onCall(async (request) => {
  if (!request.auth || request.auth.token.role !== "employee") {
    throw new HttpsError("permission-denied", "Only employees can accept leads.");
  }

  const { leadId } = request.data;
  const db = admin.firestore();
  const uid = request.auth.uid;

  await db.runTransaction(async (t) => {
    const leadRef = db.collection("leads").doc(leadId);
    const leadSnap = await t.get(leadRef);

    if (!leadSnap.exists) {
      throw new HttpsError("not-found", "Lead not found");
    }

    const leadData = leadSnap.data();
    if (leadData?.status !== "ASSIGNED" || leadData?.assignedUserId !== uid) {
      throw new HttpsError("failed-precondition", "Lead is not assigned to you or no longer pending acceptance.");
    }

    t.update(leadRef, {
      status: "ACCEPTED",
      acceptedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  return { success: true };
});
