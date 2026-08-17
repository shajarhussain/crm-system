"use server";

import { adminDb } from "@/lib/firebase/server";
import { db } from "@/lib/firebase/client";
import { verifyAuth } from "@/lib/firebase/serverAuth";
import { LeadStatus } from "@/hooks/useLeads";
import { doc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function assignLead(token: string, leadId: string, userId: string) {
  const decoded = await verifyAuth(token);
  if (decoded.role !== "admin") throw new Error("Permission denied");

  const deadline = new Date(Date.now() + 10 * 60000);

  try {
    const leadRef = adminDb.collection("leads").doc(leadId);
    await leadRef.update({
      assignedUserId: userId,
      assignedAt: new Date(),
      distributionMethod: "MANUAL",
      status: "ASSIGNED",
      acceptDeadlineAt: deadline
    });

    await leadRef.collection("events").add({
      type: "MANUALLY_ASSIGNED",
      actorUid: decoded.uid,
      at: new Date(),
      meta: { assignedTo: userId }
    });
  } catch (e) {
    const leadRef = doc(db, "leads", leadId);
    await updateDoc(leadRef, {
      assignedUserId: userId,
      assignedAt: serverTimestamp(),
      distributionMethod: "MANUAL",
      status: "ASSIGNED",
      acceptDeadlineAt: deadline
    });

    const eventRef = collection(db, "leads", leadId, "events");
    await addDoc(eventRef, {
      type: "MANUALLY_ASSIGNED",
      actorUid: decoded.uid,
      at: serverTimestamp(),
      meta: { assignedTo: userId }
    });
  }

  return { success: true };
}

export async function reassignLeadManual(token: string, leadId: string, newUserId: string) {
  const decoded = await verifyAuth(token);
  if (decoded.role !== "admin") throw new Error("Permission denied");

  const deadline = new Date(Date.now() + 10 * 60000);

  try {
    const leadRef = adminDb.collection("leads").doc(leadId);
    await leadRef.update({
      assignedUserId: newUserId,
      assignedAt: new Date(),
      distributionMethod: "MANUAL",
      status: "ASSIGNED",
      acceptDeadlineAt: deadline
    });

    await leadRef.collection("events").add({
      type: "MANUALLY_REASSIGNED",
      actorUid: decoded.uid,
      at: new Date(),
      meta: { newAssignee: newUserId }
    });
  } catch (e) {
    const leadRef = doc(db, "leads", leadId);
    await updateDoc(leadRef, {
      assignedUserId: newUserId,
      assignedAt: serverTimestamp(),
      distributionMethod: "MANUAL",
      status: "ASSIGNED",
      acceptDeadlineAt: deadline
    });

    const eventRef = collection(db, "leads", leadId, "events");
    await addDoc(eventRef, {
      type: "MANUALLY_REASSIGNED",
      actorUid: decoded.uid,
      at: serverTimestamp(),
      meta: { newAssignee: newUserId }
    });
  }

  return { success: true };
}

export async function acceptLead(token: string, leadId: string) {
  const decoded = await verifyAuth(token);
  if (decoded.role !== "employee") throw new Error("Permission denied");
  const uid = decoded.uid;

  try {
    const leadRef = adminDb.collection("leads").doc(leadId);
    await leadRef.update({
      status: "ACCEPTED",
      acceptedAt: new Date()
    });

    await leadRef.collection("events").add({
      type: "LEAD_ACCEPTED",
      actorUid: uid,
      at: new Date()
    });
  } catch (e) {
    const leadRef = doc(db, "leads", leadId);
    await updateDoc(leadRef, {
      status: "ACCEPTED",
      acceptedAt: serverTimestamp()
    });

    const eventRef = collection(db, "leads", leadId, "events");
    await addDoc(eventRef, {
      type: "LEAD_ACCEPTED",
      actorUid: uid,
      at: serverTimestamp()
    });
  }

  return { success: true };
}

export async function setLeadStatus(token: string, leadId: string, status: LeadStatus) {
  const decoded = await verifyAuth(token);
  const uid = decoded.uid;

  try {
    const leadRef = adminDb.collection("leads").doc(leadId);
    await leadRef.update({ status });

    await leadRef.collection("events").add({
      type: "STATUS_CHANGED",
      actorUid: uid,
      at: new Date(),
      meta: { newStatus: status }
    });
  } catch (e) {
    const leadRef = doc(db, "leads", leadId);
    await updateDoc(leadRef, { status });

    const eventRef = collection(db, "leads", leadId, "events");
    await addDoc(eventRef, {
      type: "STATUS_CHANGED",
      actorUid: uid,
      at: serverTimestamp(),
      meta: { newStatus: status }
    });
  }

  return { success: true };
}
