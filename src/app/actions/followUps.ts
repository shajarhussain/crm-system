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

export async function addFollowUp(token: string, leadId: string, message: string, callMade: boolean, whatsappNote: string) {
  const decoded = await verifyAuth(token);
  const uid = decoded.uid;
  const role = decoded.role;

  await adminDb.runTransaction(async (t: Transaction) => {
    const leadRef = adminDb.collection("leads").doc(leadId);
    const leadSnap = await t.get(leadRef);
    if (!leadSnap.exists) throw new Error("Not found");
    
    const data = leadSnap.data();
    if (role !== "admin" && data?.assignedUserId !== uid) throw new Error("Permission denied");

    const followUpRef = leadRef.collection("followUps").doc();
    t.set(followUpRef, {
      message, callMade: !!callMade, whatsappNote,
      occurredAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      authorUid: uid
    });

    const eventRef = leadRef.collection("events").doc();
    t.set(eventRef, {
      type: "FOLLOW_UP_ADDED", actorUid: uid,
      at: FieldValue.serverTimestamp(), meta: { followUpId: followUpRef.id }
    });
  });
  return { success: true };
}
