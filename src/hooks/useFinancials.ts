import { useState, useEffect, useMemo } from 'react';
import { collection, doc, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { describeFirestoreError, type FirestoreTimestamp } from './useLeads';
import { withinRange, type DateRange } from '@/lib/dates';
import { IS_DEMO, useDemoState } from '@/lib/demo/store';

export interface ExpenseRecord {
  id: string;
  title: string;
  category: string;
  amount: number;
  description?: string | null;
  addedByUid: string;
  addedByEmail?: string | null;
  date?: FirestoreTimestamp;
}

export interface DealCustomer {
  name: string;
  phone: string;
  email?: string | null;
  cnic?: string | null;
  address?: string | null;
  city?: string | null;
}

export interface DealRecord {
  id: string;
  leadId: string;
  /** The employee credited with the sale. */
  userId: string;
  /** Whoever filled in the entry form — may be an admin acting for them. */
  enteredByUid?: string;
  customer?: DealCustomer;
  serviceDescription?: string;
  paymentMethod?: string;
  notes?: string | null;
  amountReceived: number;
  payableAmount: number;
  profit: number;
  campaignId?: string | null;
  campaignName?: string | null;
  dealDate?: FirestoreTimestamp;
  enteredAt?: FirestoreTimestamp;
}

export interface AppNotification {
  id: string;
  type: string;
  leadId: string;
  payload?: { message?: string; [key: string]: unknown };
  createdAt?: FirestoreTimestamp;
  readAt?: FirestoreTimestamp | null;
}

export interface FinancialTotals {
  /** Σ amount received — the actual money in (FR-28). */
  totalRevenue: number;
  /** Σ payable — what has to go back out. */
  totalPayable: number;
  /** Revenue − payable (BR-19). */
  grossProfit: number;
  totalExpenses: number;
  /** Gross profit − expenses (FR-28). */
  netProfit: number;
  dealCount: number;
  expenseCount: number;
}

/**
 * Financial rollups for the admin dashboard (FR-28).
 *
 * Totals are derived from the loaded documents rather than accumulated inside
 * the snapshot callbacks. The previous version shared mutable running sums
 * between two listeners, so whichever fired second computed net profit against
 * whatever the other had left behind — a race that produced a different figure
 * depending on which query resolved first.
 */
export function useFinancials(range: DateRange, enabled = true) {
  const [deals, setDeals] = useState<DealRecord[] | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const demoState = useDemoState();

  useEffect(() => {
    if (IS_DEMO || !enabled) return;

    const unsubDeals = onSnapshot(
      query(collection(db, 'closedDeals'), orderBy('enteredAt', 'desc'), limit(1000)),
      (snap) => {
        setDeals(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as DealRecord[]);
      },
      (err) => {
        console.error('[useFinancials:deals]', err);
        setDeals([]);
        setError(describeFirestoreError(err));
      }
    );

    const unsubExpenses = onSnapshot(
      query(collection(db, 'expenses'), orderBy('date', 'desc'), limit(1000)),
      (snap) => {
        setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ExpenseRecord[]);
      },
      (err) => {
        console.error('[useFinancials:expenses]', err);
        setExpenses([]);
        setError(describeFirestoreError(err));
      }
    );

    return () => {
      unsubDeals();
      unsubExpenses();
    };
  }, [enabled]);

  const allDeals = useMemo(
    () => (!enabled ? [] : IS_DEMO ? demoState.deals : (deals ?? [])),
    [enabled, deals, demoState.deals]
  );
  const allExpenses = useMemo(
    () => (!enabled ? [] : IS_DEMO ? demoState.expenses : (expenses ?? [])),
    [enabled, expenses, demoState.expenses]
  );

  // Filtering happens here rather than in the query so that changing the range
  // is instant and does not re-subscribe.
  const dealsInRange = useMemo(
    () => allDeals.filter((deal) => withinRange(deal.dealDate ?? deal.enteredAt, range)),
    [allDeals, range]
  );

  const expensesInRange = useMemo(
    () => allExpenses.filter((expense) => withinRange(expense.date, range)),
    [allExpenses, range]
  );

  const totals = useMemo<FinancialTotals>(() => {
    const totalRevenue = sum(dealsInRange, (d) => d.amountReceived);
    const totalPayable = sum(dealsInRange, (d) => d.payableAmount);
    const totalExpenses = sum(expensesInRange, (e) => e.amount);
    const grossProfit = totalRevenue - totalPayable;

    return {
      totalRevenue,
      totalPayable,
      grossProfit,
      totalExpenses,
      netProfit: grossProfit - totalExpenses,
      dealCount: dealsInRange.length,
      expenseCount: expensesInRange.length,
    };
  }, [dealsInRange, expensesInRange]);

  return {
    deals: dealsInRange,
    expenses: expensesInRange,
    allDeals,
    totals,
    loading: IS_DEMO ? false : enabled && (deals === null || expenses === null),
    error: IS_DEMO ? null : enabled ? error : null,
  };
}

/**
 * The deal entry for one lead, if it has been closed.
 * The deal document id is the lead id, so this is a direct lookup.
 */
export function useDealForLead(leadId: string | null) {
  const [state, setState] = useState<{ key: string; deal: DealRecord | null } | null>(null);
  const demoState = useDemoState();
  const key = leadId ?? 'idle';

  useEffect(() => {
    if (IS_DEMO || !leadId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'closedDeals', leadId),
      (snap) => {
        setState({ key: leadId, deal: snap.exists() ? ({ id: snap.id, ...snap.data() } as DealRecord) : null });
      },
      (err) => {
        console.error('[useDealForLead]', err);
        setState({ key: leadId, deal: null });
      }
    );

    return () => unsubscribe();
  }, [leadId]);

  if (IS_DEMO) {
    return {
      deal: leadId ? (demoState.deals.find((d) => d.leadId === leadId) ?? null) : null,
      loading: false,
    };
  }

  const current = state?.key === key ? state : null;
  return { deal: current?.deal ?? null, loading: Boolean(leadId) && current === null };
}

/** An employee's own closed deals — Security Rules scope this to them. */
export function useMyDeals(uid: string | undefined, range: DateRange) {
  const [state, setState] = useState<{ key: string; deals: DealRecord[] } | null>(null);
  const demoState = useDemoState();
  const key = uid ?? 'idle';

  useEffect(() => {
    if (IS_DEMO || !uid) return;

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'closedDeals'),
        where('userId', '==', uid),
        orderBy('enteredAt', 'desc'),
        limit(500)
      ),
      (snap) => {
        setState({ key: uid, deals: snap.docs.map((d) => ({ id: d.id, ...d.data() })) as DealRecord[] });
      },
      (err) => {
        console.error('[useMyDeals]', err);
        setState({ key: uid, deals: [] });
      }
    );

    return () => unsubscribe();
  }, [uid]);

  const current = state?.key === key ? state : null;
  const allDeals = useMemo(
    () => (IS_DEMO ? demoState.deals.filter((d) => d.userId === uid) : (current?.deals ?? [])),
    [current, demoState.deals, uid]
  );

  const dealsInRange = useMemo(
    () => allDeals.filter((deal) => withinRange(deal.dealDate ?? deal.enteredAt, range)),
    [allDeals, range]
  );

  const totals = useMemo(
    () => ({
      revenue: sum(dealsInRange, (d) => d.amountReceived),
      profit: sum(dealsInRange, (d) => d.profit),
      count: dealsInRange.length,
    }),
    [dealsInRange]
  );

  return { deals: dealsInRange, totals, loading: IS_DEMO ? false : Boolean(uid) && current === null };
}

/** Unread admin alerts (FR-19). */
export function useNotifications(enabled = true) {
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const demoState = useDemoState();

  useEffect(() => {
    if (IS_DEMO || !enabled) return;

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'notifications'),
        where('readAt', '==', null),
        orderBy('createdAt', 'desc'),
        limit(100)
      ),
      (snap) => {
        setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as AppNotification[]);
      },
      (err) => {
        console.error('[useNotifications]', err);
        setNotifications([]);
      }
    );

    return () => unsubscribe();
  }, [enabled]);

  if (IS_DEMO) {
    return { notifications: enabled ? demoState.notifications : [], loading: false };
  }

  return {
    notifications: enabled ? (notifications ?? []) : [],
    loading: enabled && notifications === null,
  };
}

function sum<T>(items: T[], pick: (item: T) => number | undefined): number {
  return items.reduce((total, item) => total + (Number(pick(item)) || 0), 0);
}
