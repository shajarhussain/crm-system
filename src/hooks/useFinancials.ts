import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export function useFinancials() {
  const [netProfit, setNetProfit] = useState<number>(0);
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);

  useEffect(() => {
    let dealsSum = 0;
    let expensesSum = 0;

    const unsubDeals = onSnapshot(collection(db, 'closedDeals'), (snap) => {
      dealsSum = snap.docs.reduce((sum, doc) => sum + (doc.data().profit || 0), 0);
      setTotalRevenue(dealsSum);
      setNetProfit(dealsSum - expensesSum);
    });

    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snap) => {
      expensesSum = snap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
      setTotalExpenses(expensesSum);
      setNetProfit(dealsSum - expensesSum);
    });

    return () => {
      unsubDeals();
      unsubExpenses();
    };
  }, []);

  return { netProfit, totalExpenses, totalRevenue };
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
