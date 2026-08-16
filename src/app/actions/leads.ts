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

export async function assignLead(token: string, leadId: string, userId: string) {
  const decoded = await verifyAuth(token);
  if (decoded.role !== "admin") throw new Error("Permission denied");

  await adminDb.runTransaction(async (t: Transaction) => {
    const leadRef = adminDb.collection("leads").doc(leadId);
    const leadSnap = await t.get(leadRef);

    if (!leadSnap.exists) throw new Error("Lead not found");
    const data = leadSnap.data();
    if (data?.status !== "NEW") throw new Error("Lead is not NEW");

    const deadline = new Date(Date.now() + 10 * 60000);

    t.update(leadRef, {
      assignedUserId: userId,
      assignedAt: FieldValue.serverTimestamp(),
      distributionMethod: "MANUAL",
      status: "ASSIGNED",
      acceptDeadlineAt: deadline
    });
  });
  return { success: true };
}

export async function acceptLead(token: string, leadId: string) {
  const decoded = await verifyAuth(token);
  if (decoded.role !== "employee") throw new Error("Permission denied");
  
  const uid = decoded.uid;

  await adminDb.runTransaction(async (t: Transaction) => {
    const leadRef = adminDb.collection("leads").doc(leadId);
    const leadSnap = await t.get(leadRef);

    if (!leadSnap.exists) throw new Error("Lead not found");
    const data = leadSnap.data();
    
    if (data?.status !== "ASSIGNED" || data?.assignedUserId !== uid) {
      throw new Error("Lead is not assigned to you");
    }

    t.update(leadRef, {
      status: "ACCEPTED",
      acceptedAt: FieldValue.serverTimestamp()
    });
  });
  return { success: true };
}
