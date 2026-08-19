"use server";

import { adminDb } from "@/lib/firebase/server";
import { verifyAuth } from "@/lib/firebase/serverAuth";
import { runAction, UserFacingError, type ActionResult } from "@/lib/actionResult";
import { parseMoney } from "@/lib/money";
import { toE164Digits } from "@/lib/phone";
import { isTerminal } from "@/lib/leadStatus";
import { FieldValue, Transaction } from "firebase-admin/firestore";

/**
 * The Entry Module (FR-20, FR-21, BR-18, BR-19).
 *
 * Every won deal is recorded here, and this is the only path to CLOSED_WON.
 * The record is deliberately fuller than the amounts alone: a lead arrives from
 * Meta with whatever the customer typed into an ad form, which is rarely what
 * you want in a permanent customer record. At the point of sale the employee
 * confirms and completes the customer's details, and that confirmed version is
 * what the business keeps.
 */

export interface DealCustomerInput {
  name: string;
  phone: string;
  email?: string;
  cnic?: string;
  address?: string;
  city?: string;
}

export interface DealEntryInput {
  customer: DealCustomerInput;
  serviceDescription: string;
  amountReceived: number;
  payableAmount: number;
  paymentMethod?: string;
  dealDate?: string; // ISO date (yyyy-mm-dd) from the form
  notes?: string;
}

export const PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "Cheque",
  "Easypaisa",
  "JazzCash",
  "Card",
  "Other",
] as const;

/**
 * Records a closed deal and moves the lead to CLOSED_WON.
 *
 * The deal document id is the lead id, which makes the whole operation
 * idempotent: a double-submitted form, or an impatient second click, hits an
 * existing document and is rejected instead of silently double-counting the
 * revenue.
 *
 * Profit is computed here and never read from the client payload (BR-19).
 */
export async function closeDeal(
  token: string,
  leadId: string,
  input: DealEntryInput
): Promise<ActionResult<{ dealId: string; profit: number }>> {
  return runAction("closeDeal", async () => {
    const auth = await verifyAuth(token);

    const customerName = (input.customer?.name ?? "").trim();
    if (!customerName) {
      throw new UserFacingError("Enter the customer's name.");
    }

    const phoneDigits = toE164Digits(input.customer?.phone);
    if (!phoneDigits) {
      throw new UserFacingError("Enter a valid contact number for the customer.");
    }

    const serviceDescription = (input.serviceDescription ?? "").trim();
    if (!serviceDescription) {
      throw new UserFacingError("Describe what was sold, so the record makes sense later.");
    }

    const amountReceived = parseMoney(input.amountReceived);
    const payableAmount = parseMoney(input.payableAmount);
    const profit = amountReceived - payableAmount;

    const email = (input.customer?.email ?? "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new UserFacingError("That email address doesn't look right.");
    }

    const dealDate = parseDealDate(input.dealDate);

    return adminDb.runTransaction(async (t: Transaction) => {
      const leadRef = adminDb.collection("leads").doc(leadId);
      const dealRef = adminDb.collection("closedDeals").doc(leadId);

      const [leadSnap, dealSnap] = await Promise.all([t.get(leadRef), t.get(dealRef)]);

      if (!leadSnap.exists) {
        throw new UserFacingError("That lead no longer exists.");
      }
      if (dealSnap.exists) {
        throw new UserFacingError("This deal has already been entered.");
      }

      const lead = leadSnap.data()!;

      if (auth.role !== "admin" && lead.assignedUserId !== auth.uid) {
        throw new UserFacingError("This lead is not assigned to you.");
      }
      if (isTerminal(lead.status)) {
        throw new UserFacingError("This lead is already closed.");
      }
      if (!lead.assignedUserId) {
        throw new UserFacingError("Assign this lead to an employee before entering a deal.");
      }

      t.create(dealRef, {
        leadId,

        // Revenue is credited to whoever worked the lead, which is not
        // necessarily whoever typed the form — an admin may enter on their
        // behalf. Both are recorded so performance reporting stays honest.
        userId: lead.assignedUserId,
        enteredByUid: auth.uid,

        customer: {
          name: customerName,
          phone: phoneDigits,
          email: email || null,
          cnic: (input.customer?.cnic ?? "").trim() || null,
          address: (input.customer?.address ?? "").trim() || null,
          city: (input.customer?.city ?? "").trim() || null,
        },

        serviceDescription,
        paymentMethod: input.paymentMethod || "Cash",
        notes: (input.notes ?? "").trim() || null,

        amountReceived,
        payableAmount,
        profit,

        // Denormalised so campaign reporting doesn't need a lead join.
        campaignId: lead.campaignId ?? null,
        campaignName: lead.campaignName ?? null,
        source: lead.source ?? null,

        dealDate,
        enteredAt: FieldValue.serverTimestamp(),
      });

      t.update(leadRef, {
        status: "CLOSED_WON",
        closedAt: FieldValue.serverTimestamp(),
        closedDealId: leadId,
      });

      t.create(leadRef.collection("events").doc(), {
        type: "DEAL_CLOSED",
        actorUid: auth.uid,
        at: FieldValue.serverTimestamp(),
        meta: {
          dealId: leadId,
          creditedTo: lead.assignedUserId,
          amountReceived,
          payableAmount,
          profit,
        },
      });

      return { dealId: leadId, profit };
    });
  });
}

/**
 * The form supplies a plain date. Anchor it to midday so that rendering it back
 * in Asia/Karachi can't roll it onto the previous day.
 */
function parseDealDate(raw: string | undefined): Date {
  if (!raw) return new Date();

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) return new Date();

  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));

  if (Number.isNaN(parsed.getTime())) return new Date();
  if (parsed.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    throw new UserFacingError("The deal date cannot be in the future.");
  }

  return parsed;
}
