"use server";
import { adminDb } from "@/lib/firebase/server";

export async function getIntegrationsConfig() {
  const doc = await adminDb.collection("config").doc("integrations").get();
  if (!doc.exists) {
    // Default config if not present
    return {
      whatsapp: { enabled: false, phoneNumberId: null }
    };
  }
  return doc.data() as any;
}
