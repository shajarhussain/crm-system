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
exports.acceptLead = exports.assignLead = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const functions_1 = require("firebase-admin/functions");
exports.assignLead = (0, https_1.onCall)(async (request) => {
    if (!request.auth || request.auth.token.role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Only admins can manually assign leads.");
    }
    const { leadId, userId } = request.data;
    const db = admin.firestore();
    await db.runTransaction(async (t) => {
        const leadRef = db.collection("leads").doc(leadId);
        const leadSnap = await t.get(leadRef);
        if (!leadSnap.exists) {
            throw new https_1.HttpsError("not-found", "Lead not found");
        }
        const leadData = leadSnap.data();
        if ((leadData === null || leadData === void 0 ? void 0 : leadData.status) !== "NEW") {
            throw new https_1.HttpsError("failed-precondition", "Lead is not in NEW status");
        }
        t.update(leadRef, {
            assignedUserId: userId,
            assignedAt: admin.firestore.FieldValue.serverTimestamp(),
            distributionMethod: "MANUAL",
            status: "ASSIGNED"
        });
        const queue = (0, functions_1.getFunctions)().taskQueue("onacceptdeadline");
        await queue.enqueue({ leadId, assignedUserId: userId }, {
            scheduleDelaySeconds: 10 * 60,
            dispatchDeadlineSeconds: 60 * 5,
        });
    });
    return { success: true };
});
exports.acceptLead = (0, https_1.onCall)(async (request) => {
    if (!request.auth || request.auth.token.role !== "employee") {
        throw new https_1.HttpsError("permission-denied", "Only employees can accept leads.");
    }
    const { leadId } = request.data;
    const db = admin.firestore();
    const uid = request.auth.uid;
    await db.runTransaction(async (t) => {
        const leadRef = db.collection("leads").doc(leadId);
        const leadSnap = await t.get(leadRef);
        if (!leadSnap.exists) {
            throw new https_1.HttpsError("not-found", "Lead not found");
        }
        const leadData = leadSnap.data();
        if ((leadData === null || leadData === void 0 ? void 0 : leadData.status) !== "ASSIGNED" || (leadData === null || leadData === void 0 ? void 0 : leadData.assignedUserId) !== uid) {
            throw new https_1.HttpsError("failed-precondition", "Lead is not assigned to you or no longer pending acceptance.");
        }
        t.update(leadRef, {
            status: "ACCEPTED",
            acceptedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });
    return { success: true };
});
//# sourceMappingURL=leads.js.map