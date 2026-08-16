import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export const addFollowUp = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  const { leadId, message, callMade, whatsappNote } = request.data;
  const db = admin.firestore();
  const uid = request.auth.uid;
  const role = request.auth.token.role;

  await db.runTransaction(async (t) => {
    const leadRef = db.collection("leads").doc(leadId);
    const leadSnap = await t.get(leadRef);

    if (!leadSnap.exists) {
      throw new HttpsError("not-found", "Lead not found");
    }

    const leadData = leadSnap.data();
    if (role !== "admin" && leadData?.assignedUserId !== uid) {
      throw new HttpsError("permission-denied", "Not assigned to this lead.");
    }

    const followUpRef = leadRef.collection("followUps").doc();
    t.set(followUpRef, {
      message,
      callMade: !!callMade,
      whatsappNote: whatsappNote || "",
      occurredAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      authorUid: uid
    });

    const eventRef = leadRef.collection("events").doc();
    t.set(eventRef, {
      type: "FOLLOW_UP_ADDED",
      actorUid: uid,
      at: admin.firestore.FieldValue.serverTimestamp(),
      meta: { followUpId: followUpRef.id }
    });
  });

  return { success: true };
});
