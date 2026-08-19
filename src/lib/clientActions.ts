"use client";

import { IS_DEMO, demo, getDemoSession } from '@/lib/demo/store';
import type { LeadStatus } from '@/lib/leadStatus';
import type { ActionResult } from '@/lib/actionResult';

/**
 * Every mutation the UI performs goes through here.
 *
 * In demo mode it hits the in-memory store and returns immediately. Otherwise
 * it forwards to the real Server Action, imported dynamically so that demo mode
 * never pulls the Firebase Admin SDK into the request at all.
 *
 * Signatures and return shapes match the Server Actions exactly, so call sites
 * do not care which one is running.
 */

/** Who the demo store should attribute mutations to. */
const actor = () => getDemoSession() ?? { uid: 'demo-admin', email: 'admin@crm.com' };

export async function assignLead(token: string, leadId: string, userId: string): Promise<ActionResult> {
  if (IS_DEMO) return demo.assignLead(leadId, userId, actor().uid);
  return (await import('@/app/actions/leads')).assignLead(token, leadId, userId);
}

export async function reassignLeadManual(token: string, leadId: string, userId: string): Promise<ActionResult> {
  if (IS_DEMO) return demo.reassignLead(leadId, userId, actor().uid);
  return (await import('@/app/actions/leads')).reassignLeadManual(token, leadId, userId);
}

export async function acceptLead(token: string, leadId: string): Promise<ActionResult> {
  if (IS_DEMO) return demo.acceptLead(leadId, actor().uid);
  return (await import('@/app/actions/leads')).acceptLead(token, leadId);
}

export async function setLeadStatus(token: string, leadId: string, status: LeadStatus): Promise<ActionResult> {
  if (IS_DEMO) return demo.setLeadStatus(leadId, status, actor().uid);
  return (await import('@/app/actions/leads')).setLeadStatus(token, leadId, status);
}

export async function addFollowUp(
  token: string,
  leadId: string,
  input: { message: string; callMade: boolean; callCount?: number; whatsappNote?: string; occurredAt?: string }
): Promise<ActionResult<{ followUpId: string }>> {
  if (IS_DEMO) return demo.addFollowUp(leadId, input, actor().uid, actor().email);
  return (await import('@/app/actions/followUps')).addFollowUp(token, leadId, input);
}

export async function closeDeal(
  token: string,
  leadId: string,
  input: {
    customer: { name: string; phone: string; email?: string; cnic?: string; address?: string; city?: string };
    serviceDescription: string;
    amountReceived: number;
    payableAmount: number;
    paymentMethod?: string;
    dealDate?: string;
    notes?: string;
  }
): Promise<ActionResult<{ dealId: string; profit: number }>> {
  if (IS_DEMO) return demo.closeDeal(leadId, input, actor().uid);
  return (await import('@/app/actions/closedDeals')).closeDeal(token, leadId, input);
}

export async function addExpense(
  token: string,
  input: { title: string; category: string; amount: number; description?: string; date?: string }
): Promise<ActionResult<{ expenseId: string }>> {
  if (IS_DEMO) return demo.addExpense(input, actor().uid);
  return (await import('@/app/actions/expenses')).addExpense(token, input);
}

export async function createEmployee(
  token: string,
  input: { name: string; email: string; password: string; priority: number }
): Promise<ActionResult<{ uid: string }>> {
  if (IS_DEMO) return demo.createEmployee(input);
  return (await import('@/app/actions/employees')).createEmployee(token, input);
}

export async function setEmployeePriority(token: string, uid: string, priority: number): Promise<ActionResult> {
  if (IS_DEMO) return demo.setEmployeePriority(uid, priority);
  return (await import('@/app/actions/employees')).setEmployeePriority(token, uid, priority);
}

export async function disableEmployee(token: string, uid: string): Promise<ActionResult<{ openLeads: number }>> {
  if (IS_DEMO) return demo.setEmployeeStatus(uid, 'DISABLED');
  return (await import('@/app/actions/employees')).disableEmployee(token, uid);
}

export async function enableEmployee(token: string, uid: string): Promise<ActionResult> {
  if (IS_DEMO) return demo.setEmployeeStatus(uid, 'ACTIVE') as ActionResult;
  return (await import('@/app/actions/employees')).enableEmployee(token, uid);
}

export async function markNotificationRead(token: string, id: string): Promise<ActionResult> {
  if (IS_DEMO) return demo.markNotificationRead(id);
  return (await import('@/app/actions/notifications')).markNotificationRead(token, id);
}

export async function markAllNotificationsRead(token: string): Promise<ActionResult<{ cleared: number }>> {
  if (IS_DEMO) return demo.markAllNotificationsRead();
  return (await import('@/app/actions/notifications')).markAllNotificationsRead(token);
}

/** Expense categories, safe to import on the client in either mode. */
export const EXPENSE_CATEGORIES = [
  'Rent', 'Salaries', 'Internet', 'Electricity', 'Water',
  'Bills', 'Marketing', 'Software', 'Other',
] as const;

export const PAYMENT_METHODS = [
  'Cash', 'Bank Transfer', 'Cheque', 'Easypaisa', 'JazzCash', 'Card', 'Other',
] as const;
