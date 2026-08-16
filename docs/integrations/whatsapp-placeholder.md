# WhatsApp Integration — Placeholder / Seam

**Status:** credentials not yet provided by the client. Build the seam now, switched off, so
plugging in the real API later is a config change, not a rebuild.

## What exists today (Phase 1, per PRD BR-11)
Employees use `wa.me/{phone}` click-to-chat links to message customers manually, then log what was
sent as a normal `followUp` document (`whatsappNote` field). No outbound API call happens.

## The seam to build now
1. **Config doc:** `config/integrations` (Firestore) —
   ```json
   { "whatsapp": { "enabled": false, "phoneNumberId": null } }
   ```
2. **Function stub:** `/functions/src/whatsapp.ts`
   ```ts
   export async function sendWhatsAppMessage(leadId: string, message: string) {
     const config = await getIntegrationsConfig();
     if (!config.whatsapp.enabled) {
       return { skipped: true, reason: "whatsapp integration not yet configured" };
     }
     // TODO: real WhatsApp Business API call once credentials exist.
     // Reads secrets WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID via
     // firebase functions:secrets:set — never hard-code them here.
   }
   ```
3. **Reserved secret names** (set later, not now):
   - `WHATSAPP_API_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`

## When the client provides credentials
1. `firebase functions:secrets:set WHATSAPP_API_TOKEN`
2. `firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID`
3. Update `config/integrations.whatsapp` → `{ enabled: true, phoneNumberId: "<id>" }`
4. Fill in the real HTTP call in `sendWhatsAppMessage` (WhatsApp Cloud API `POST
   /{phone-number-id}/messages`, or whichever provider the client is using — confirm which before
   assuming Meta's own Cloud API vs. a BSP like Twilio/360dialog, since the request shape differs).
5. No schema change, no new call sites, no client-code changes needed — every place that will
   eventually "send" a WhatsApp message should already be calling `sendWhatsAppMessage()` and
   getting a graceful no-op today.

## Do not do
- Don't guess at API credentials or a specific provider's request format before they're provided.
- Don't build a second, parallel "future" WhatsApp module — extend this same function/seam.
