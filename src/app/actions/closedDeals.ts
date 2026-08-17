"use server";

import { adminDb } from "@/lib/firebase/server";
import { db } from "@/lib/firebase/client";
import { verifyAuth } from "@/lib/firebase/serverAuth";
import { doc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function closeDeal(token: string, leadId: string, amountReceived: number, payableAmount: number) {
  const decoded = await verifyAuth(token);
  const uid = decoded.uid;
  const profit = amountReceived - payableAmount;

  try {
    const leadRef = adminDb.collection("leads").doc(leadId);
    await leadRef.update({ status: "CLOSED_WON" });

    const dealRef = adminDb.collection("closedDeals").doc();
    await dealRef.set({
      leadId,
      userId: uid,
      amountReceived,
      payableAmount,
      profit,
      enteredAt: new Date()
    });

    await leadRef.collection("events").add({
      type: "DEAL_CLOSED",
      actorUid: uid,
      at: new Date(),
      meta: { dealId: dealRef.id, profit }
    });
  } catch (e) {
    const leadRef = doc(db, "leads", leadId);
    await updateDoc(leadRef, { status: "CLOSED_WON" });

    const dealRef = collection(db, "closedDeals");
    const docRef = await addDoc(dealRef, {
      leadId,
      userId: uid,
      amountReceived,
      payableAmount,
      profit,
      enteredAt: serverTimestamp()
    });

    const eventRef = collection(db, "leads", leadId, "events");
    await addDoc(eventRef, {
      type: "DEAL_CLOSED",
      actorUid: uid,
      at: serverTimestamp(),
      meta: { dealId: docRef.id, profit }
    });
  }

  return { success: true };
}
