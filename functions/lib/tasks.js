"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onAcceptDeadline = exports.onAssignDeadline = void 0;
const tasks_1 = require("firebase-functions/v2/tasks");
const admin = __importStar(require("firebase-admin"));
const functions_1 = require("firebase-admin/functions");
const distribution_1 = require("./distribution");
exports.onAssignDeadline = (0, tasks_1.onTaskDispatched)({
    retryConfig: {
        maxAttempts: 3,
        minBackoffSeconds: 60,
    }
}, async (request) => {
    const { leadId } = request.data;
    const db = admin.firestore();
    await db.runTransaction(async (t) => {
        var _a;
        const leadRef = db.collection("leads").doc(leadId);
        const leadSnap = await t.get(leadRef);
        if (!leadSnap.exists)
            return;
        const leadData = leadSnap.data();
        // Idempotency check: only act if it's still NEW
        if ((leadData === null || leadData === void 0 ? void 0 : leadData.status) !== "NEW")
            return;
        // Read all users and config to get current state
        const usersSnap = await t.get(db.collection("users"));
        const employees = [];
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
        const cycleState = configSnap.exists ? (((_a = configSnap.data()) === null || _a === void 0 ? void 0 : _a.cycleState) || {}) : {};
        const { uid: nextAssignee, newState } = (0, distribution_1.getNextAssigneeAndState)(employees, cycleState);
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
        const queue = (0, functions_1.getFunctions)().taskQueue("onacceptdeadline");
        await queue.enqueue({ leadId, assignedUserId: nextAssignee }, {
            scheduleDelaySeconds: 10 * 60,
            dispatchDeadlineSeconds: 60 * 5,
        });
    });
});
exports.onAcceptDeadline = (0, tasks_1.onTaskDispatched)({
    retryConfig: {
        maxAttempts: 3,
        minBackoffSeconds: 60,
    }
}, async (request) => {
    const { leadId, assignedUserId } = request.data;
    const db = admin.firestore();
    await db.runTransaction(async (t) => {
        var _a;
        const leadRef = db.collection("leads").doc(leadId);
        const leadSnap = await t.get(leadRef);
        if (!leadSnap.exists)
            return;
        const leadData = leadSnap.data();
        // Idempotency: only act if still ASSIGNED to the SAME user
        if ((leadData === null || leadData === void 0 ? void 0 : leadData.status) !== "ASSIGNED" || (leadData === null || leadData === void 0 ? void 0 : leadData.assignedUserId) !== assignedUserId)
            return;
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
        const employees = [];
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
        const cycleState = configSnap.exists ? (((_a = configSnap.data()) === null || _a === void 0 ? void 0 : _a.cycleState) || {}) : {};
        const { uid: nextAssignee, newState } = (0, distribution_1.getNextAssigneeAndState)(employees, cycleState);
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
        const queue = (0, functions_1.getFunctions)().taskQueue("onacceptdeadline");
        await queue.enqueue({ leadId, assignedUserId: nextAssignee }, {
            scheduleDelaySeconds: 10 * 60,
            dispatchDeadlineSeconds: 60 * 5,
        });
    });
});
//# sourceMappingURL=tasks.js.map