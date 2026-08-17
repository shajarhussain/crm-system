"use server";

import { adminDb } from "@/lib/firebase/server";
import { db } from "@/lib/firebase/client";
import { verifyAuth } from "@/lib/firebase/serverAuth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function addExpense(token: string, title: string, category: string, amount: number, description: string) {
  const decoded = await verifyAuth(token);
  if (decoded.role !== "admin") throw new Error("Permission denied");

  try {
    const expenseRef = adminDb.collection("expenses").doc();
    await expenseRef.set({
      title,
      category,
      amount,
      description,
      addedByUid: decoded.uid,
      date: new Date()
    });
  } catch (e) {
    const expenseRef = collection(db, "expenses");
    await addDoc(expenseRef, {
      title,
      category,
      amount,
      description,
      addedByUid: decoded.uid,
      date: serverTimestamp()
    });
  }

  return { success: true };
}
