import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export interface ExpenseRecord {
  id: string;
  title: string;
  category: string;
  amount: number;
  description?: string;
  addedByUid: string;
  date: any;
}

export interface DealRecord {
  id: string;
  leadId: string;
  userId: string;
  amountReceived: number;
  payableAmount: number;
  profit: number;
  enteredAt: any;
}

export interface AppNotification {
  id: string;
  type: string;
  leadId: string;
  payload: any;
  createdAt: any;
}

const DEMO_EXPENSES: ExpenseRecord[] = [
  { id: "exp-1", title: "Meta Lead Ads - Summer Campaign", category: "Marketing", amount: 1250, description: "Lead acquisition budget across Meta platforms", addedByUid: "admin", date: { toDate: () => new Date() } },
  { id: "exp-2", title: "Fiber Internet Office", category: "Internet", amount: 150, description: "Monthly high-speed connection", addedByUid: "admin", date: { toDate: () => new Date() } },
  { id: "exp-3", title: "Enterprise Software Suite", category: "Software", amount: 300, description: "Tools and CRM licenses", addedByUid: "admin", date: { toDate: () => new Date() } },
];

const DEMO_DEALS: DealRecord[] = [
  { id: "deal-1", leadId: "lead-meta-104", userId: "demo-emp-1", amountReceived: 8500, payableAmount: 5000, profit: 3500, enteredAt: { toDate: () => new Date() } }
];

const DEMO_NOTIFICATIONS: AppNotification[] = [
  { id: "notif-1", type: "RED_FLAG", leadId: "lead-meta-102", payload: { message: "Lead SLA timer approaching 10-minute threshold." }, createdAt: { toDate: () => new Date() } }
];

export function useFinancials() {
  const [netProfit, setNetProfit] = useState<number>(1800);
  const [totalExpenses, setTotalExpenses] = useState<number>(1700);
  const [totalRevenue, setTotalRevenue] = useState<number>(3500);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(DEMO_EXPENSES);
  const [deals, setDeals] = useState<DealRecord[]>(DEMO_DEALS);

  useEffect(() => {
    let dealsSum = 3500;
    let expensesSum = 1700;

    try {
      const unsubDeals = onSnapshot(collection(db, 'closedDeals'), (snap) => {
        if (!snap.empty) {
          const dealList = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as DealRecord[];
          
          dealList.sort((a, b) => {
            const aTime = a.enteredAt?.toMillis ? a.enteredAt.toMillis() : 0;
            const bTime = b.enteredAt?.toMillis ? b.enteredAt.toMillis() : 0;
            return bTime - aTime;
          });

          dealsSum = dealList.reduce((sum, doc) => sum + (doc.profit || 0), 0);
          setDeals(dealList);
          setTotalRevenue(dealsSum);
          setNetProfit(dealsSum - expensesSum);
        }
      }, () => {});

      const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snap) => {
        if (!snap.empty) {
          const expList = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as ExpenseRecord[];

          expList.sort((a, b) => {
            const aTime = a.date?.toMillis ? a.date.toMillis() : 0;
            const bTime = b.date?.toMillis ? b.date.toMillis() : 0;
            return bTime - aTime;
          });

          expensesSum = expList.reduce((sum, doc) => sum + (doc.amount || 0), 0);
          setExpenses(expList);
          setTotalExpenses(expensesSum);
          setNetProfit(dealsSum - expensesSum);
        }
      }, () => {});

      return () => {
        unsubDeals();
        unsubExpenses();
      };
    } catch (e) {
      // fallback to demo defaults
    }
  }, []);

  return { netProfit, totalExpenses, totalRevenue, expenses, deals };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>(DEMO_NOTIFICATIONS);

  useEffect(() => {
    try {
      const q = query(
        collection(db, 'notifications'), 
        where('readAt', '==', null)
      );

      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const data = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as AppNotification[];
          setNotifications(data);
        }
      }, () => {});

      return () => unsub();
    } catch (e) {
      // fallback
    }
  }, []);

  return { notifications };
}
