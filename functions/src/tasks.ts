import { onTaskDispatched } from "firebase-functions/v2/tasks";
import * as admin from "firebase-admin";
import { getFunctions } from "firebase-admin/functions";
import { getNextAssigneeAndState, Employee, CycleState } from "./distribution";

export const onAssignDeadline = onTaskDispatched(
  {
    retryConfig: {
      maxAttempts: 3,
      minBackoffSeconds: 60,
    }
  },
  async (request) => {
    const { leadId } = request.data as { leadId: string };
    const db = admin.firestore();

    await db.runTransaction(async (t) => {
      const leadRef = db.collection("leads").doc(leadId);
      const leadSnap = await t.get(leadRef);

      if (!leadSnap.exists) return;
      
      const leadData = leadSnap.data();
      // Idempotency check: only act if it's still NEW
      if (leadData?.status !== "NEW") return;

      // Read all users and config to get current state
      const usersSnap = await t.get(db.collection("users"));
      const employees: Employee[] = [];
      usersSnap.forEach(doc => {
        const d = doc.data();
        if (d.role === "employee") {
          employees.push({
            uid: doc.id,
            priority: d.priority || 99,
            status: d.status || "ACTIVE"
          });
        }
      });

      const configRef = db.collection("config").doc("distribution");
      const configSnap = await t.get(configRef);
      const cycleState: CycleState = configSnap.exists ? (configSnap.data()?.cycleState || {}) : {};

      const { uid: nextAssignee, newState } = getNextAssigneeAndState(employees, cycleState);

      if (!nextAssignee) {
        // No active employees available
        t.update(leadRef, {
          status: "UNASSIGNED_NO_CAPACITY"
        });
        return;
      }

      // Assign the lead
      t.update(leadRef, {
        assignedUserId: nextAssignee,
        assignedAt: admin.firestore.FieldValue.serverTimestamp(),
        distributionMethod: "AUTO",
        status: "ASSIGNED",
        autoRotationCycleSnapshot: newState
      });

      t.set(configRef, { cycleState: newState }, { merge: true });

      // Enqueue the accept-deadline task (+10 minutes)
      const queue = getFunctions().taskQueue("onacceptdeadline");
      await queue.enqueue(
        { leadId, assignedUserId: nextAssignee },
        {
          scheduleDelaySeconds: 10 * 60,
          dispatchDeadlineSeconds: 60 * 5,
        }
      );
    });
  }
);

export const onAcceptDeadline = onTaskDispatched(
  {
    retryConfig: {
      maxAttempts: 3,
      minBackoffSeconds: 60,
    }
  },
  async (request) => {
    const { leadId, assignedUserId } = request.data as { leadId: string, assignedUserId: string };
    const db = admin.firestore();

    await db.runTransaction(async (t) => {
      const leadRef = db.collection("leads").doc(leadId);
      const leadSnap = await t.get(leadRef);

      if (!leadSnap.exists) return;
      
      const leadData = leadSnap.data();
      // Idempotency: only act if still ASSIGNED to the SAME user
      if (leadData?.status !== "ASSIGNED" || leadData?.assignedUserId !== assignedUserId) return;

      // Create an EXPIRED event
      const eventRef = leadRef.collection("events").doc();
      t.set(eventRef, {
        type: "EXPIRED",
        actorUid: "system",
        at: admin.firestore.FieldValue.serverTimestamp(),
        meta: { previousAssignee: assignedUserId }
      });

      // Create Red Flag notification
      const notifRef = db.collection("notifications").doc();
      t.set(notifRef, {
        type: "RED_FLAG",
        leadId,
        targetRole: "admin",
        payload: { message: "Lead expired without acceptance." },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        readAt: null
      });

      // Rerun assignment excluding this user for this pass
      const usersSnap = await t.get(db.collection("users"));
      const employees: Employee[] = [];
      usersSnap.forEach(doc => {
        const d = doc.data();
        if (d.role === "employee" && doc.id !== assignedUserId) {
          employees.push({
            uid: doc.id,
            priority: d.priority || 99,
            status: d.status || "ACTIVE"
          });
        }
      });

      const configRef = db.collection("config").doc("distribution");
      const configSnap = await t.get(configRef);
      const cycleState: CycleState = configSnap.exists ? (configSnap.data()?.cycleState || {}) : {};

      const { uid: nextAssignee, newState } = getNextAssigneeAndState(employees, cycleState);

      if (!nextAssignee) {
        t.update(leadRef, {
          status: "NEW", // Fallback to NEW so Admin has to intervene
          assignedUserId: null,
          assignedAt: null
        });
        return;
      }

      t.update(leadRef, {
        assignedUserId: nextAssignee,
        assignedAt: admin.firestore.FieldValue.serverTimestamp(),
        distributionMethod: "AUTO_REASSIGN",
        autoRotationCycleSnapshot: newState
      });

      t.set(configRef, { cycleState: newState }, { merge: true });

      // Enqueue a NEW accept-deadline task for the new assignee
      const queue = getFunctions().taskQueue("onacceptdeadline");
      await queue.enqueue(
        { leadId, assignedUserId: nextAssignee },
        {
          scheduleDelaySeconds: 10 * 60,
          dispatchDeadlineSeconds: 60 * 5,
        }
      );
    });
  }
);
