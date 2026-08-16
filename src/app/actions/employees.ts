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

export async function createEmployee(token: string, email: string, password: string, priority: number) {
  const decoded = await verifyAuth(token);
  if (decoded.role !== "admin") throw new Error("Permission denied");

  const userRecord = await adminAuth.createUser({
    email,
    password,
  });

  await adminAuth.setCustomUserClaims(userRecord.uid, { role: "employee" });

  await adminDb.collection("users").doc(userRecord.uid).set({
    email,
    role: "employee",
    priority,
    status: "ACTIVE",
    createdAt: FieldValue.serverTimestamp()
  });

  return { success: true, uid: userRecord.uid };
}

export async function setEmployeePriority(token: string, uid: string, priority: number) {
  const decoded = await verifyAuth(token);
  if (decoded.role !== "admin") throw new Error("Permission denied");

  await adminDb.collection("users").doc(uid).update({
    priority,
  });
  return { success: true };
}

export async function disableEmployee(token: string, uid: string) {
  const decoded = await verifyAuth(token);
  if (decoded.role !== "admin") throw new Error("Permission denied");

  await adminAuth.updateUser(uid, { disabled: true });
  await adminDb.collection("users").doc(uid).update({
    status: "DISABLED",
  });
  return { success: true };
}
