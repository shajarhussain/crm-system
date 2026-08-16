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
exports.closeDeal = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
exports.closeDeal = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Must be logged in.");
    }
    const { leadId, amountReceived, payableAmount } = request.data;
    const db = admin.firestore();
    const uid = request.auth.uid;
    const role = request.auth.token.role;
    const received = parseFloat(amountReceived);
    const payable = parseFloat(payableAmount);
    if (isNaN(received) || isNaN(payable)) {
        throw new https_1.HttpsError("invalid-argument", "Amounts must be numbers.");
    }
    const profit = received - payable;
    await db.runTransaction(async (t) => {
        const leadRef = db.collection("leads").doc(leadId);
        const leadSnap = await t.get(leadRef);
        if (!leadSnap.exists) {
            throw new https_1.HttpsError("not-found", "Lead not found");
        }
        const leadData = leadSnap.data();
        if (role !== "admin" && (leadData === null || leadData === void 0 ? void 0 : leadData.assignedUserId) !== uid) {
            throw new https_1.HttpsError("permission-denied", "Not assigned to this lead.");
        }
        t.update(leadRef, {
            status: "CLOSED_WON"
        });
        const dealRef = db.collection("closedDeals").doc();
        t.set(dealRef, {
            leadId,
            userId: (leadData === null || leadData === void 0 ? void 0 : leadData.assignedUserId) || uid,
            amountReceived: received,
            payableAmount: payable,
            profit,
            enteredAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const eventRef = leadRef.collection("events").doc();
        t.set(eventRef, {
            type: "DEAL_CLOSED",
            actorUid: uid,
            at: admin.firestore.FieldValue.serverTimestamp(),
            meta: { dealId: dealRef.id, profit }
        });
    });
    return { success: true };
});
//# sourceMappingURL=closedDeals.js.map