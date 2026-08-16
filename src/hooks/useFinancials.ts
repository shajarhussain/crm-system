import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
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

export function useFinancials() {
  const [netProfit, setNetProfit] = useState<number>(0);
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [deals, setDeals] = useState<DealRecord[]>([]);

  useEffect(() => {
    let dealsSum = 0;
    let expensesSum = 0;

    const unsubDeals = onSnapshot(collection(db, 'closedDeals'), (snap) => {
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
    });

    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snap) => {
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
    });

    return () => {
      unsubDeals();
      unsubExpenses();
    };
  }, []);

  return { netProfit, totalExpenses, totalRevenue, expenses, deals };
}

export interface AppNotification {
  id: string;
  type: string;
  leadId: string;
  payload: any;
  createdAt: any;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'), 
      where('readAt', '==', null)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppNotification[];
      setNotifications(data);
    });

    return () => unsub();
  }, []);

  return { notifications };
}
