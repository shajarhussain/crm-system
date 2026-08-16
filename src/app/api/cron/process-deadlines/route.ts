import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import { FieldValue, Transaction, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getNextAssigneeAndState, Employee, CycleState } from '@/lib/distribution';

export async function GET() {
  try {
    const now = new Date();
    
    // Process Expired NEW leads (Admin 5-min window missed)
    const expiredNewLeads = await adminDb.collection("leads")
      .where("status", "==", "NEW")
      .where("adminAssignDeadlineAt", "<", now)
      .get();
      
    // Process Expired ASSIGNED leads (Employee 10-min window missed)
    const expiredAssignedLeads = await adminDb.collection("leads")
      .where("status", "==", "ASSIGNED")
      .where("acceptDeadlineAt", "<", now)
      .get();
      
    let processedCount = 0;
    
    for (const doc of expiredNewLeads.docs) {
      await autoAssignLead(doc.id);
      processedCount++;
    }
    
    for (const doc of expiredAssignedLeads.docs) {
      await reassignLead(doc.id, doc.data().assignedUserId);
      processedCount++;
    }

    // 24-hour NO FOLLOW UP check
    const activeLeads = await adminDb.collection("leads").where("status", "in", ["ASSIGNED", "ACCEPTED"]).get();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const doc of activeLeads.docs) {
      const followUps = await doc.ref.collection("followUps").orderBy("createdAt", "desc").limit(1).get();
      
      let lastActivityTime = doc.data().assignedAt?.toDate() || doc.data().createdAt?.toDate();
      if (!followUps.empty) {
        lastActivityTime = followUps.docs[0].data().createdAt?.toDate();
      }

      if (lastActivityTime && lastActivityTime < twentyFourHoursAgo) {
        const notifId = `nofup_${doc.id}`;
        await adminDb.collection("notifications").doc(notifId).set({
          type: "NO_FOLLOWUP",
          leadId: doc.id,
          targetRole: "admin",
          payload: { message: "Lead has no follow-up in 24 hours." },
          createdAt: FieldValue.serverTimestamp(),
          readAt: null
        }, { merge: true });
        processedCount++;
      }
    }

    return NextResponse.json({ success: true, processedCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function autoAssignLead(leadId: string) {
  await adminDb.runTransaction(async (t: Transaction) => {
    const leadRef = adminDb.collection("leads").doc(leadId);
    const leadSnap = await t.get(leadRef);

    if (!leadSnap.exists || leadSnap.data()?.status !== "NEW") return;

    const usersSnap = await t.get(adminDb.collection("users"));
    const employees: Employee[] = [];
    usersSnap.forEach((doc: QueryDocumentSnapshot) => {
      const d = doc.data();
      if (d.role === "employee") {
        employees.push({ uid: doc.id, priority: d.priority || 99, status: d.status || "ACTIVE" });
      }
    });

    const configRef = adminDb.collection("config").doc("distribution");
    const configSnap = await t.get(configRef);
    const cycleState: CycleState = configSnap.exists ? (configSnap.data()?.cycleState || {}) : {};

    const { uid: nextAssignee, newState } = getNextAssigneeAndState(employees, cycleState);

    if (!nextAssignee) {
      t.update(leadRef, { status: "UNASSIGNED_NO_CAPACITY" });
      return;
    }

    t.update(leadRef, {
      assignedUserId: nextAssignee,
      assignedAt: FieldValue.serverTimestamp(),
      distributionMethod: "AUTO",
      status: "ASSIGNED",
      acceptDeadlineAt: new Date(Date.now() + 10 * 60000)
    });
    t.set(configRef, { cycleState: newState }, { merge: true });
  });
}

async function reassignLead(leadId: string, oldAssignee: string) {
  await adminDb.runTransaction(async (t: Transaction) => {
    const leadRef = adminDb.collection("leads").doc(leadId);
    const leadSnap = await t.get(leadRef);

    if (!leadSnap.exists || leadSnap.data()?.status !== "ASSIGNED" || leadSnap.data()?.assignedUserId !== oldAssignee) return;

    const eventRef = leadRef.collection("events").doc();
    t.set(eventRef, {
      type: "EXPIRED", actorUid: "system", at: FieldValue.serverTimestamp(), meta: { previousAssignee: oldAssignee }
    });

    const notifRef = adminDb.collection("notifications").doc();
    t.set(notifRef, {
      type: "RED_FLAG", leadId, targetRole: "admin", payload: { message: "Lead expired without acceptance." },
      createdAt: FieldValue.serverTimestamp(), readAt: null
    });

    const usersSnap = await t.get(adminDb.collection("users"));
    const employees: Employee[] = [];
    usersSnap.forEach((doc: QueryDocumentSnapshot) => {
      const d = doc.data();
      if (d.role === "employee" && doc.id !== oldAssignee) {
        employees.push({ uid: doc.id, priority: d.priority || 99, status: d.status || "ACTIVE" });
      }
    });

    const configRef = adminDb.collection("config").doc("distribution");
    const configSnap = await t.get(configRef);
    const cycleState: CycleState = configSnap.exists ? (configSnap.data()?.cycleState || {}) : {};

    const { uid: nextAssignee, newState } = getNextAssigneeAndState(employees, cycleState);

    if (!nextAssignee) {
      t.update(leadRef, { status: "NEW", assignedUserId: null, assignedAt: null, adminAssignDeadlineAt: new Date(Date.now() + 5 * 60000) });
      return;
    }

    t.update(leadRef, {
      assignedUserId: nextAssignee, assignedAt: FieldValue.serverTimestamp(), distributionMethod: "AUTO_REASSIGN",
      autoRotationCycleSnapshot: newState, acceptDeadlineAt: new Date(Date.now() + 10 * 60000)
    });
    t.set(configRef, { cycleState: newState }, { merge: true });
  });
}
