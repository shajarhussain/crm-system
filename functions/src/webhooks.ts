import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getFunctions } from "firebase-admin/functions";

export const onMetaLeadWebhook = onRequest(async (req, res) => {
  // In production, verify the Meta signature using req.headers["x-hub-signature"]
  // and the app secret before proceeding.

  if (req.method === "GET") {
    // Webhook verification challenge
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    
    // Hardcoded verification token for now, should use Secret Manager
    if (mode === "subscribe" && token === "crm_system_meta_token") {
      res.status(200).send(challenge);
      return;
    } else {
      res.sendStatus(403);
      return;
    }
  }

  if (req.method === "POST") {
    try {
      const body = req.body;
      const db = admin.firestore();

      // For each entry in the Meta webhook payload
      if (body.object === "page") {
        for (const entry of body.entry) {
          for (const change of entry.changes) {
            if (change.field === "leadgen") {
              const leadId = change.value.leadgen_id;
              
              // In production, fetch lead details via Graph API here
              // For now, we simulate the created lead doc
              const docRef = db.collection("leads").doc(leadId);
              
              await docRef.set({
                name: "Meta Lead " + leadId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: "NEW",
                source: "META_ADS",
                campaignId: change.value.campaign_id || "unknown",
                assignedUserId: null
              });

              // Enqueue the 5-minute Admin Assign Deadline task
              const queue = getFunctions().taskQueue("onassigndeadline");
              await queue.enqueue(
                { leadId },
                {
                  scheduleDelaySeconds: 5 * 60,
                  dispatchDeadlineSeconds: 60 * 5,
                }
              );
            }
          }
        }
      }

      res.status(200).send("EVENT_RECEIVED");
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
    }
  }
});
