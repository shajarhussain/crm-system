"use client";

import { useSyncExternalStore } from 'react';
import type { Lead, FollowUpRecord, AuditEventRecord } from '@/hooks/useLeads';
import type { DealRecord, ExpenseRecord, AppNotification } from '@/hooks/useFinancials';
import type { EmployeeData } from '@/hooks/useEmployees';

/**
 * Demo mode — a fully interactive walkthrough with no backend at all.
 *
 * Everything lives in memory: sign-in, leads, follow-ups, deals, expenses. No
 * Firebase, no network, no credentials. Intended for showing the product to
 * someone before the real project is configured.
 *
 * Off unless NEXT_PUBLIC_DEMO_MODE=true. When it is on, a banner is pinned to
 * every screen so nobody can mistake this for live data — the previous build's
 * fatal flaw was a demo path that looked exactly like the real thing and issued
 * working admin tokens against a live database. This one cannot reach a
 * database at all.
 */

export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const DEMO_PASSWORD = 'Demo12345';

export interface DemoAccount {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'employee';
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { uid: 'demo-admin', email: 'admin@crm.com', name: 'Usman Sheikh', role: 'admin' },
  { uid: 'demo-emp-1', email: 'ayesha@crm.com', name: 'Ayesha Khan', role: 'employee' },
  { uid: 'demo-emp-2', email: 'bilal@crm.com', name: 'Bilal Ahmed', role: 'employee' },
  { uid: 'demo-emp-3', email: 'sana@crm.com', name: 'Sana Malik', role: 'employee' },
];

const SESSION_KEY = 'crm.demo.session';

/**
 * The signed-in demo account, held outside React.
 *
 * Restored from sessionStorage at module load rather than in an effect, and
 * exposed through useSyncExternalStore with a null server snapshot — which is
 * the pattern React documents for client-only state that must survive
 * hydration without a mismatch.
 */
let demoSession: DemoAccount | null = null;
const sessionListeners = new Set<() => void>();

if (IS_DEMO && typeof window !== 'undefined') {
  const stored = window.sessionStorage.getItem(SESSION_KEY);
  demoSession = DEMO_ACCOUNTS.find((a) => a.uid === stored) ?? null;
}

export function getDemoSession(): DemoAccount | null {
  return demoSession;
}

export function signInDemo(email: string, password: string): DemoAccount | null {
  const account = DEMO_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (!account || password !== DEMO_PASSWORD) return null;

  demoSession = account;
  window.sessionStorage.setItem(SESSION_KEY, account.uid);
  sessionListeners.forEach((fn) => fn());
  return account;
}

export function signOutDemo() {
  demoSession = null;
  window.sessionStorage.removeItem(SESSION_KEY);
  sessionListeners.forEach((fn) => fn());
}

export function useDemoSession(): DemoAccount | null {
  return useSyncExternalStore(
    (fn) => {
      sessionListeners.add(fn);
      return () => sessionListeners.delete(fn);
    },
    () => demoSession,
    () => null
  );
}

/** Firestore Timestamps are objects with these methods; the UI calls them everywhere. */
function ts(date: Date) {
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
  };
}
const minutesFromNow = (n: number) => ts(new Date(Date.now() + n * 60_000));
const hoursAgo = (n: number) => ts(new Date(Date.now() - n * 3_600_000));
const daysAgo = (n: number) => ts(new Date(Date.now() - n * 86_400_000));

const CAMPAIGNS = [
  { id: '23851', name: 'DHA Phase 6 — Plot Enquiry' },
  { id: '23852', name: 'Bahria Town — Apartments' },
  { id: '23853', name: 'Gulberg — Commercial Floors' },
];

interface DemoState {
  employees: EmployeeData[];
  leads: Lead[];
  followUps: Record<string, FollowUpRecord[]>;
  events: Record<string, AuditEventRecord[]>;
  deals: DealRecord[];
  expenses: ExpenseRecord[];
  notifications: AppNotification[];
}

function seed(): DemoState {
  const employees: EmployeeData[] = [
    { uid: 'demo-emp-1', name: 'Ayesha Khan', email: 'ayesha@crm.com', priority: 1, status: 'ACTIVE' },
    { uid: 'demo-emp-2', name: 'Bilal Ahmed', email: 'bilal@crm.com', priority: 2, status: 'ACTIVE' },
    { uid: 'demo-emp-3', name: 'Sana Malik', email: 'sana@crm.com', priority: 3, status: 'ACTIVE' },
    { uid: 'demo-emp-4', name: 'Faisal Siddiqui', email: 'faisal@crm.com', priority: 4, status: 'DISABLED' },
  ];

  const mk = (
    id: string, name: string, phone: string, email: string, city: string,
    status: Lead['status'], campaign: number, assigned: string | null,
    extra: Partial<Lead> = {}
  ): Lead => ({
    id, name, phone, email, city,
    status, source: 'META_ADS',
    campaignId: CAMPAIGNS[campaign].id,
    campaignName: CAMPAIGNS[campaign].name,
    assignedUserId: assigned,
    attemptedAssignees: assigned ? [assigned] : [],
    followUpCount: 0,
    callCount: 0,
    ...extra,
  });

  const leads: Lead[] = [
    mk('lead_1001', 'Hamza Tariq', '923001234567', 'hamza.tariq@gmail.com', 'Lahore', 'NEW', 0, null, {
      createdAt: hoursAgo(0.05), adminAssignDeadlineAt: minutesFromNow(3.5),
    }),
    mk('lead_1002', 'Fatima Noor', '923215558899', 'f.noor@outlook.com', 'Karachi', 'NEW', 1, null, {
      createdAt: hoursAgo(0.02), adminAssignDeadlineAt: minutesFromNow(4.6),
    }),
    mk('lead_1003', 'Imran Qureshi', '923334447788', 'imran.q@gmail.com', 'Islamabad', 'ASSIGNED', 0, 'demo-emp-1', {
      createdAt: hoursAgo(0.3), assignedAt: hoursAgo(0.05), acceptDeadlineAt: minutesFromNow(7.2),
      distributionMethod: 'AUTO',
    }),
    mk('lead_1004', 'Zainab Rashid', '923018887766', 'zainab.r@gmail.com', 'Lahore', 'NEGOTIATION', 2, 'demo-emp-1', {
      createdAt: daysAgo(3), assignedAt: daysAgo(3), acceptedAt: daysAgo(3),
      followUpCount: 3, callCount: 5, distributionMethod: 'AUTO',
    }),
    mk('lead_1005', 'Ahmed Raza', '923457778899', 'ahmed.raza@company.pk', 'Karachi', 'INTERESTED', 1, 'demo-emp-2', {
      createdAt: daysAgo(2), assignedAt: daysAgo(2), acceptedAt: daysAgo(2),
      followUpCount: 2, callCount: 2, distributionMethod: 'AUTO',
    }),
    mk('lead_1006', 'Sadia Iqbal', '923219994455', 'sadia.iqbal@gmail.com', 'Multan', 'CONTACTED', 0, 'demo-emp-3', {
      createdAt: daysAgo(1), assignedAt: daysAgo(1), acceptedAt: daysAgo(1),
      followUpCount: 1, callCount: 1, distributionMethod: 'MANUAL',
    }),
    mk('lead_1007', 'Kamran Butt', '923006665544', 'k.butt@gmail.com', 'Lahore', 'NO_RESPONSE', 1, 'demo-emp-2', {
      createdAt: daysAgo(4), assignedAt: daysAgo(4), acceptedAt: daysAgo(4),
      followUpCount: 4, callCount: 6, distributionMethod: 'AUTO_REASSIGN',
    }),
    mk('lead_1008', 'Nida Aslam', '923331112233', 'nida.aslam@gmail.com', 'Faisalabad', 'CLOSED_WON', 2, 'demo-emp-1', {
      createdAt: daysAgo(9), assignedAt: daysAgo(9), acceptedAt: daysAgo(9), closedAt: daysAgo(2),
      followUpCount: 5, callCount: 8, distributionMethod: 'AUTO',
    }),
    mk('lead_1009', 'Yasir Mehmood', '923005554433', 'yasir.m@gmail.com', 'Rawalpindi', 'CLOSED_WON', 0, 'demo-emp-2', {
      createdAt: daysAgo(14), assignedAt: daysAgo(14), acceptedAt: daysAgo(14), closedAt: daysAgo(6),
      followUpCount: 3, callCount: 4, distributionMethod: 'AUTO',
    }),
    mk('lead_1010', 'Hina Javed', '923452223344', 'hina.javed@gmail.com', 'Lahore', 'CLOSED_LOST', 1, 'demo-emp-3', {
      createdAt: daysAgo(11), assignedAt: daysAgo(11), acceptedAt: daysAgo(11),
      followUpCount: 2, callCount: 3, distributionMethod: 'AUTO',
    }),
  ];

  const followUps: Record<string, FollowUpRecord[]> = {
    lead_1004: [
      { id: 'fu1', message: 'Client visited the Gulberg site. Wants a corner floor and asked for a payment plan over 18 months.', callMade: true, callCount: 2, whatsappNote: 'Sent floor plan PDF', occurredAt: hoursAgo(6), createdAt: hoursAgo(6), authorUid: 'demo-emp-1', authorEmail: 'ayesha@crm.com' },
      { id: 'fu2', message: 'Sent the revised quote. He is comparing against one other option and will confirm this week.', callMade: true, callCount: 2, whatsappNote: 'Shared revised quote', occurredAt: hoursAgo(30), createdAt: hoursAgo(30), authorUid: 'demo-emp-1', authorEmail: 'ayesha@crm.com' },
      { id: 'fu3', message: 'First contact. Confirmed his budget range and that this is for office use, not investment.', callMade: true, callCount: 1, whatsappNote: null, occurredAt: hoursAgo(70), createdAt: hoursAgo(70), authorUid: 'demo-emp-1', authorEmail: 'ayesha@crm.com' },
    ],
    lead_1005: [
      { id: 'fu4', message: 'Wants a 3-bed on a higher floor. Asked about possession timeline and maintenance charges.', callMade: true, callCount: 1, whatsappNote: 'Sent brochure', occurredAt: hoursAgo(20), createdAt: hoursAgo(20), authorUid: 'demo-emp-2', authorEmail: 'bilal@crm.com' },
      { id: 'fu5', message: 'Initial call. Interested, but travelling until next week.', callMade: true, callCount: 1, whatsappNote: null, occurredAt: hoursAgo(44), createdAt: hoursAgo(44), authorUid: 'demo-emp-2', authorEmail: 'bilal@crm.com' },
    ],
    lead_1008: [
      { id: 'fu6', message: 'Deal agreed. Paperwork signed at the office, payment received by bank transfer.', callMade: true, callCount: 1, whatsappNote: 'Confirmed transfer', occurredAt: hoursAgo(50), createdAt: hoursAgo(50), authorUid: 'demo-emp-1', authorEmail: 'ayesha@crm.com' },
      { id: 'fu7', message: 'Final negotiation on price. Agreed after a small discount.', callMade: true, callCount: 3, whatsappNote: null, occurredAt: hoursAgo(96), createdAt: hoursAgo(96), authorUid: 'demo-emp-1', authorEmail: 'ayesha@crm.com' },
    ],
  };

  const events: Record<string, AuditEventRecord[]> = {};
  for (const lead of leads) {
    const list: AuditEventRecord[] = [
      { id: `${lead.id}-e1`, type: 'LEAD_INGESTED', actorUid: 'system:meta-webhook', at: lead.createdAt, meta: { campaignName: lead.campaignName, contactDetailsRetrieved: true } },
    ];
    if (lead.assignedUserId) {
      list.unshift({ id: `${lead.id}-e2`, type: lead.distributionMethod === 'MANUAL' ? 'MANUALLY_ASSIGNED' : 'AUTO_ASSIGNED', actorUid: lead.distributionMethod === 'MANUAL' ? 'demo-admin' : 'system:cron', at: lead.assignedAt, meta: { assignedTo: lead.assignedUserId } });
    }
    if (lead.acceptedAt) {
      list.unshift({ id: `${lead.id}-e3`, type: 'LEAD_ACCEPTED', actorUid: lead.assignedUserId!, at: lead.acceptedAt, meta: {} });
    }
    if (lead.closedAt) {
      list.unshift({ id: `${lead.id}-e4`, type: 'DEAL_CLOSED', actorUid: lead.assignedUserId!, at: lead.closedAt, meta: { dealId: lead.id } });
    }
    events[lead.id] = list;
  }

  const deals: DealRecord[] = [
    {
      id: 'lead_1008', leadId: 'lead_1008', userId: 'demo-emp-1', enteredByUid: 'demo-emp-1',
      customer: { name: 'Nida Aslam', phone: '923331112233', email: 'nida.aslam@gmail.com', cnic: '33100-1234567-8', address: 'House 42, Block C, Peoples Colony', city: 'Faisalabad' },
      serviceDescription: 'Gulberg commercial floor — 2nd floor, 1,850 sq ft',
      paymentMethod: 'Bank Transfer', notes: null,
      amountReceived: 4850000, payableAmount: 3200000, profit: 1650000,
      campaignId: '23853', campaignName: CAMPAIGNS[2].name,
      dealDate: daysAgo(2), enteredAt: daysAgo(2),
    },
    {
      id: 'lead_1009', leadId: 'lead_1009', userId: 'demo-emp-2', enteredByUid: 'demo-emp-2',
      customer: { name: 'Yasir Mehmood', phone: '923005554433', email: 'yasir.m@gmail.com', cnic: '37405-7654321-1', address: 'Flat 7B, Askari 14', city: 'Rawalpindi' },
      serviceDescription: 'DHA Phase 6 — 10 marla residential plot',
      paymentMethod: 'Cheque', notes: null,
      amountReceived: 2750000, payableAmount: 1900000, profit: 850000,
      campaignId: '23851', campaignName: CAMPAIGNS[0].name,
      dealDate: daysAgo(6), enteredAt: daysAgo(6),
    },
  ];

  const expenses: ExpenseRecord[] = [
    { id: 'x1', title: 'Office rent — August', category: 'Rent', amount: 250000, description: null, addedByUid: 'demo-admin', date: daysAgo(12) },
    { id: 'x2', title: 'Team salaries — August', category: 'Salaries', amount: 920000, description: null, addedByUid: 'demo-admin', date: daysAgo(12) },
    { id: 'x3', title: 'Meta Ads — lead campaigns', category: 'Marketing', amount: 175000, description: 'Facebook and Instagram lead forms', addedByUid: 'demo-admin', date: daysAgo(8) },
    { id: 'x4', title: 'Fibre internet', category: 'Internet', amount: 12000, description: null, addedByUid: 'demo-admin', date: daysAgo(10) },
    { id: 'x5', title: 'Electricity bill', category: 'Electricity', amount: 46500, description: null, addedByUid: 'demo-admin', date: daysAgo(5) },
    { id: 'x6', title: 'CRM and software licences', category: 'Software', amount: 28000, description: null, addedByUid: 'demo-admin', date: daysAgo(3) },
  ];

  const notifications: AppNotification[] = [
    { id: 'n1', type: 'RED_FLAG', leadId: 'lead_1007', payload: { message: 'Kamran Butt was not accepted within 10 minutes.' }, createdAt: hoursAgo(2), readAt: null },
    { id: 'n2', type: 'NO_FOLLOWUP', leadId: 'lead_1007', payload: { message: 'No follow-up logged on Kamran Butt for over 24 hours.' }, createdAt: hoursAgo(1), readAt: null },
  ];

  return { employees, leads, followUps, events, deals, expenses, notifications };
}

/* -------------------------------------------------------------------------- */
/* A minimal reactive store                                                    */
/* -------------------------------------------------------------------------- */

let state: DemoState = seed();
const listeners = new Set<() => void>();

function emit() {
  state = { ...state };
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useDemoState(): DemoState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state
  );
}

export function resetDemo() {
  state = seed();
  listeners.forEach((fn) => fn());
}

const now = () => ts(new Date());
let counter = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now()}_${counter++}`;

function addEvent(leadId: string, type: string, actorUid: string, meta: Record<string, unknown> = {}) {
  state.events[leadId] = [
    { id: nextId('ev'), type, actorUid, at: now(), meta },
    ...(state.events[leadId] ?? []),
  ];
}

function patchLead(leadId: string, patch: Partial<Lead>) {
  state.leads = state.leads.map((lead) => (lead.id === leadId ? { ...lead, ...patch } : lead));
}

/* -------------------------------------------------------------------------- */
/* Mutations — same shapes the real Server Actions return                      */
/* -------------------------------------------------------------------------- */

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });

export const demo = {
  assignLead(leadId: string, userId: string, actorUid: string): Result {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) return fail('That lead no longer exists.');
    if (lead.status !== 'NEW' && lead.status !== 'UNASSIGNED_NO_CAPACITY') {
      return fail('This lead has already been assigned. Use Reassign instead.');
    }
    patchLead(leadId, {
      assignedUserId: userId, assignedAt: now(), lastActivityAt: now(),
      status: 'ASSIGNED', distributionMethod: 'MANUAL',
      acceptDeadlineAt: minutesFromNow(10), adminAssignDeadlineAt: undefined,
      attemptedAssignees: [...(lead.attemptedAssignees ?? []), userId],
    });
    addEvent(leadId, 'MANUALLY_ASSIGNED', actorUid, { assignedTo: userId });
    emit();
    return ok(undefined);
  },

  reassignLead(leadId: string, userId: string, actorUid: string): Result {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) return fail('That lead no longer exists.');
    if (lead.assignedUserId === userId) return fail('This lead is already assigned to that employee.');
    patchLead(leadId, {
      assignedUserId: userId, assignedAt: now(), lastActivityAt: now(),
      status: 'ASSIGNED', distributionMethod: 'MANUAL',
      acceptedAt: undefined, acceptDeadlineAt: minutesFromNow(10),
      attemptedAssignees: [userId],
    });
    addEvent(leadId, 'MANUALLY_REASSIGNED', actorUid, { previousAssignee: lead.assignedUserId, newAssignee: userId });
    emit();
    return ok(undefined);
  },

  acceptLead(leadId: string, actorUid: string): Result {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) return fail('That lead no longer exists.');
    if (lead.assignedUserId !== actorUid) return fail('This lead is not assigned to you.');
    if (lead.status !== 'ASSIGNED') return fail('This lead is not waiting to be accepted.');
    patchLead(leadId, { status: 'ACCEPTED', acceptedAt: now(), lastActivityAt: now(), acceptDeadlineAt: undefined });
    addEvent(leadId, 'LEAD_ACCEPTED', actorUid);
    emit();
    return ok(undefined);
  },

  setLeadStatus(leadId: string, status: Lead['status'], actorUid: string): Result {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) return fail('That lead no longer exists.');
    if (lead.status === 'ASSIGNED') return fail('Accept this lead before updating its status.');
    patchLead(leadId, { status });
    addEvent(leadId, 'STATUS_CHANGED', actorUid, { from: lead.status, to: status });
    emit();
    return ok(undefined);
  },

  addFollowUp(
    leadId: string,
    input: { message: string; callMade: boolean; callCount?: number; whatsappNote?: string; occurredAt?: string },
    actorUid: string,
    actorEmail: string
  ): Result<{ followUpId: string }> {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) return fail('That lead no longer exists.');
    if (lead.status === 'ASSIGNED') return fail('Accept this lead before logging a follow-up.');

    const id = nextId('fu');
    const at = input.occurredAt ? ts(new Date(input.occurredAt)) : now();
    const calls = input.callMade ? Math.max(1, Number(input.callCount) || 1) : 0;

    state.followUps[leadId] = [
      { id, message: input.message, callMade: input.callMade, callCount: calls,
        whatsappNote: input.whatsappNote || null, occurredAt: at, createdAt: now(),
        authorUid: actorUid, authorEmail: actorEmail },
      ...(state.followUps[leadId] ?? []),
    ];
    patchLead(leadId, {
      followUpCount: (lead.followUpCount ?? 0) + 1,
      callCount: (lead.callCount ?? 0) + calls,
      lastActivityAt: now(),
    });
    addEvent(leadId, 'FOLLOW_UP_ADDED', actorUid, { followUpId: id, callMade: input.callMade, callCount: calls });
    emit();
    return ok({ followUpId: id });
  },

  closeDeal(
    leadId: string,
    input: {
      customer: { name: string; phone: string; email?: string; cnic?: string; address?: string; city?: string };
      serviceDescription: string; amountReceived: number; payableAmount: number;
      paymentMethod?: string; dealDate?: string; notes?: string;
    },
    actorUid: string
  ): Result<{ dealId: string; profit: number }> {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) return fail('That lead no longer exists.');
    if (state.deals.some((d) => d.leadId === leadId)) return fail('This deal has already been entered.');
    if (!input.customer.name.trim()) return fail("Enter the customer's name.");
    if (!input.customer.phone.trim()) return fail('Enter a valid contact number for the customer.');
    if (!input.serviceDescription.trim()) return fail('Describe what was sold, so the record makes sense later.');
    if (!Number.isFinite(input.amountReceived) || !Number.isFinite(input.payableAmount)) {
      return fail('Enter a valid amount.');
    }

    const profit = input.amountReceived - input.payableAmount;
    state.deals = [
      {
        id: leadId, leadId, userId: lead.assignedUserId ?? actorUid, enteredByUid: actorUid,
        customer: {
          name: input.customer.name.trim(),
          phone: input.customer.phone.replace(/\D/g, ''),
          email: input.customer.email?.trim() || null,
          cnic: input.customer.cnic?.trim() || null,
          address: input.customer.address?.trim() || null,
          city: input.customer.city?.trim() || null,
        },
        serviceDescription: input.serviceDescription.trim(),
        paymentMethod: input.paymentMethod || 'Cash',
        notes: input.notes?.trim() || null,
        amountReceived: input.amountReceived, payableAmount: input.payableAmount, profit,
        campaignId: lead.campaignId ?? null, campaignName: lead.campaignName ?? null,
        dealDate: input.dealDate ? ts(new Date(`${input.dealDate}T12:00:00`)) : now(),
        enteredAt: now(),
      },
      ...state.deals,
    ];
    patchLead(leadId, { status: 'CLOSED_WON', closedAt: now() });
    addEvent(leadId, 'DEAL_CLOSED', actorUid, { dealId: leadId, profit });
    emit();
    return ok({ dealId: leadId, profit });
  },

  addExpense(input: { title: string; category: string; amount: number; description?: string; date?: string }, actorUid: string): Result<{ expenseId: string }> {
    if (!input.title.trim()) return fail('Give the expense a title.');
    if (!Number.isFinite(input.amount) || input.amount <= 0) return fail('Enter an amount greater than zero.');
    const id = nextId('x');
    state.expenses = [
      { id, title: input.title.trim(), category: input.category, amount: input.amount,
        description: input.description?.trim() || null, addedByUid: actorUid,
        date: input.date ? ts(new Date(`${input.date}T12:00:00`)) : now() },
      ...state.expenses,
    ];
    emit();
    return ok({ expenseId: id });
  },

  createEmployee(input: { name: string; email: string; password: string; priority: number }): Result<{ uid: string }> {
    if (!input.name.trim()) return fail("Enter the employee's name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return fail('Enter a valid email address.');
    if (input.password.length < 8) return fail('The password must be at least 8 characters.');
    if (state.employees.some((e) => e.email === input.email.toLowerCase())) {
      return fail('An account with that email already exists.');
    }
    const uid = nextId('emp');
    state.employees = [...state.employees, {
      uid, name: input.name.trim(), email: input.email.toLowerCase(),
      priority: input.priority, status: 'ACTIVE',
    }];
    emit();
    return ok({ uid });
  },

  setEmployeePriority(uid: string, priority: number): Result {
    state.employees = state.employees.map((e) => (e.uid === uid ? { ...e, priority } : e));
    emit();
    return ok(undefined);
  },

  setEmployeeStatus(uid: string, status: 'ACTIVE' | 'DISABLED'): Result<{ openLeads: number }> {
    state.employees = state.employees.map((e) => (e.uid === uid ? { ...e, status } : e));
    const openLeads = state.leads.filter(
      (l) => l.assignedUserId === uid && !['CLOSED_WON', 'CLOSED_LOST', 'NOT_INTERESTED'].includes(l.status)
    ).length;
    emit();
    return ok({ openLeads });
  },

  markNotificationRead(id: string): Result {
    state.notifications = state.notifications.filter((n) => n.id !== id);
    emit();
    return ok(undefined);
  },

  markAllNotificationsRead(): Result<{ cleared: number }> {
    const cleared = state.notifications.length;
    state.notifications = [];
    emit();
    return ok({ cleared });
  },
};
