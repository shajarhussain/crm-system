"use server";

import { adminDb } from "@/lib/firebase/server";
import { db } from "@/lib/firebase/client";
import { verifyAuth } from "@/lib/firebase/serverAuth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function addFollowUp(
  token: string, 
  leadId: string, 
  message: string, 
  callMade: boolean, 
  whatsappNote: string,
  callCount: number = 1
) {
  const decoded = await verifyAuth(token);
  const uid = decoded.uid;

  try {
    const leadRef = adminDb.collection("leads").doc(leadId);
    const fuRef = leadRef.collection("followUps").doc();
    await fuRef.set({
      message,
      callMade: !!callMade,
      callCount: callCount || 1,
      whatsappNote: whatsappNote || "",
      occurredAt: new Date(),
      createdAt: new Date(),
      authorUid: uid
    });

    await leadRef.collection("events").add({
      type: "FOLLOW_UP_ADDED",
      actorUid: uid,
      at: new Date(),
      meta: { followUpId: fuRef.id, callMade, callCount }
    });
  } catch (e) {
    const fuRef = collection(db, "leads", leadId, "followUps");
    const fuDoc = await addDoc(fuRef, {
      message,
      callMade: !!callMade,
      callCount: callCount || 1,
      whatsappNote: whatsappNote || "",
      occurredAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      authorUid: uid
    });

    const eventRef = collection(db, "leads", leadId, "events");
    await addDoc(eventRef, {
      type: "FOLLOW_UP_ADDED",
      actorUid: uid,
      at: serverTimestamp(),
      meta: { followUpId: fuDoc.id, callMade, callCount }
    });
  }

  return { success: true };
}
