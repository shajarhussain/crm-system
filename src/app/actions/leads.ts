"use server";

import { adminDb, adminAuth } from "@/lib/firebase/server";
import { FieldValue, Transaction } from "firebase-admin/firestore";
import { LeadStatus } from "@/hooks/useLeads";

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

    const eventRef = leadRef.collection("events").doc();
    t.set(eventRef, {
      type: "MANUALLY_ASSIGNED",
      actorUid: decoded.uid,
      at: FieldValue.serverTimestamp(),
      meta: { assignedTo: userId }
    });
  });
  return { success: true };
}

export async function reassignLeadManual(token: string, leadId: string, newUserId: string) {
  const decoded = await verifyAuth(token);
  if (decoded.role !== "admin") throw new Error("Permission denied");

  await adminDb.runTransaction(async (t: Transaction) => {
    const leadRef = adminDb.collection("leads").doc(leadId);
    const leadSnap = await t.get(leadRef);

    if (!leadSnap.exists) throw new Error("Lead not found");
    const data = leadSnap.data();

    const deadline = new Date(Date.now() + 10 * 60000);

    t.update(leadRef, {
      assignedUserId: newUserId,
      assignedAt: FieldValue.serverTimestamp(),
      distributionMethod: "MANUAL",
      status: "ASSIGNED",
      acceptDeadlineAt: deadline
    });

    const eventRef = leadRef.collection("events").doc();
    t.set(eventRef, {
      type: "MANUALLY_REASSIGNED",
      actorUid: decoded.uid,
      at: FieldValue.serverTimestamp(),
      meta: { previousAssignee: data?.assignedUserId, newAssignee: newUserId }
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

    const eventRef = leadRef.collection("events").doc();
    t.set(eventRef, {
      type: "LEAD_ACCEPTED",
      actorUid: uid,
      at: FieldValue.serverTimestamp()
    });
  });
  return { success: true };
}

export async function setLeadStatus(token: string, leadId: string, status: LeadStatus) {
  const decoded = await verifyAuth(token);
  const uid = decoded.uid;
  const role = decoded.role;

  await adminDb.runTransaction(async (t: Transaction) => {
    const leadRef = adminDb.collection("leads").doc(leadId);
    const leadSnap = await t.get(leadRef);

    if (!leadSnap.exists) throw new Error("Lead not found");
    const data = leadSnap.data();

    if (role !== "admin" && data?.assignedUserId !== uid) {
      throw new Error("Permission denied");
    }

    t.update(leadRef, { status });

    const eventRef = leadRef.collection("events").doc();
    t.set(eventRef, {
      type: "STATUS_CHANGED",
      actorUid: uid,
      at: FieldValue.serverTimestamp(),
      meta: { previousStatus: data?.status, newStatus: status }
    });
  });

  return { success: true };
}
