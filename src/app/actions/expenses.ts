"use server";
import { adminDb, adminAuth } from "@/lib/firebase/server";
import { FieldValue } from "firebase-admin/firestore";

async function verifyAuth(token: string) {
  try {
    return await adminAuth.verifyIdToken(token);
  } catch (e) {
    throw new Error("Unauthorized");
  }
}

export async function addExpense(token: string, title: string, category: string, amount: number, description: string) {
  const decoded = await verifyAuth(token);
  if (decoded.role !== "admin") throw new Error("Permission denied");

  const expenseRef = adminDb.collection("expenses").doc();
  await expenseRef.set({
    title,
    category,
    amount,
    description,
    addedByUid: decoded.uid,
    date: FieldValue.serverTimestamp()
  });

  return { success: true };
}
