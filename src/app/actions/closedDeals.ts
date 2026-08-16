"use server";

import { adminDb, adminAuth } from "@/lib/firebase/server";
import { FieldValue, Transaction } from "firebase-admin/firestore";

async function verifyAuth(token: string) {
  try {
    return await adminAuth.verifyIdToken(token);
  } catch (e) {
    throw new Error("Unauthorized");
  }
}

export async function closeDeal(token: string, leadId: string, amountReceived: number, payableAmount: number) {
  const decoded = await verifyAuth(token);
  const uid = decoded.uid;
  const role = decoded.role;

  const profit = amountReceived - payableAmount;

  await adminDb.runTransaction(async (t: Transaction) => {
    const leadRef = adminDb.collection("leads").doc(leadId);
    const leadSnap = await t.get(leadRef);
    if (!leadSnap.exists) throw new Error("Not found");
    
    const data = leadSnap.data();
    if (role !== "admin" && data?.assignedUserId !== uid) throw new Error("Permission denied");

    t.update(leadRef, { status: "CLOSED_WON" });

    const dealRef = adminDb.collection("closedDeals").doc();
    t.set(dealRef, {
      leadId, userId: data?.assignedUserId || uid,
      amountReceived, payableAmount, profit,
      enteredAt: FieldValue.serverTimestamp()
    });

    const eventRef = leadRef.collection("events").doc();
    t.set(eventRef, {
      type: "DEAL_CLOSED", actorUid: uid,
      at: FieldValue.serverTimestamp(), meta: { dealId: dealRef.id, profit }
    });
  });
  return { success: true };
}
