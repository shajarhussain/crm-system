import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export const closeDeal = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  const { leadId, amountReceived, payableAmount } = request.data;
  const db = admin.firestore();
  const uid = request.auth.uid;
  const role = request.auth.token.role;

  const received = parseFloat(amountReceived);
  const payable = parseFloat(payableAmount);
  if (isNaN(received) || isNaN(payable)) {
    throw new HttpsError("invalid-argument", "Amounts must be numbers.");
  }

  const profit = received - payable;

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

    t.update(leadRef, {
      status: "CLOSED_WON"
    });

    const dealRef = db.collection("closedDeals").doc();
    t.set(dealRef, {
      leadId,
      userId: leadData?.assignedUserId || uid,
      amountReceived: received,
      payableAmount: payable,
      profit,
      enteredAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const eventRef = leadRef.collection("events").doc();
    t.set(eventRef, {
      type: "DEAL_CLOSED",
      actorUid: uid,
      at: admin.firestore.FieldValue.serverTimestamp(),
      meta: { dealId: dealRef.id, profit }
    });
  });

  return { success: true };
});
