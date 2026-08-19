"use server";

import { adminDb } from "@/lib/firebase/server";

export interface IntegrationsConfig {
  whatsapp: {
    enabled: boolean;
    phoneNumberId: string | null;
  };
}

const DEFAULT_CONFIG: IntegrationsConfig = {
  whatsapp: { enabled: false, phoneNumberId: null },
};

/**
 * Feature flags for outbound integrations (architecture.md §10).
 *
 * Defaults to everything off, so a missing config document behaves the same as
 * an explicitly disabled one rather than throwing.
 */
export async function getIntegrationsConfig(): Promise<IntegrationsConfig> {
  try {
    const snap = await adminDb.collection("config").doc("integrations").get();
    if (!snap.exists) return DEFAULT_CONFIG;

    const data = snap.data() ?? {};
    return {
      whatsapp: {
        enabled: Boolean(data.whatsapp?.enabled),
        phoneNumberId: data.whatsapp?.phoneNumberId ?? null,
      },
    };
  } catch (error) {
    console.error("[config] Could not read config/integrations:", error);
    return DEFAULT_CONFIG;
  }
}
