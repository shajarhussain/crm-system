import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export interface EmployeeData {
  uid: string;
  email: string;
  priority: number;
  status: 'ACTIVE' | 'DISABLED';
}

export function useEmployees() {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'employee'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        uid: doc.id,
        email: doc.data().email || 'Unknown',
        priority: doc.data().priority || 99,
        status: doc.data().status || 'ACTIVE',
      })) as EmployeeData[];
      
      data.sort((a, b) => a.priority - b.priority);
      setEmployees(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching employees:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { employees, loading };
}
