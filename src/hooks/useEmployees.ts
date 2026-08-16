import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export interface EmployeeData {
  uid: string;
  email: string;
  priority: number;
  status: 'ACTIVE' | 'DISABLED';
}

const DEMO_EMPLOYEES: EmployeeData[] = [
  { uid: "demo-emp-1", email: "sarah.sales@company.com", priority: 1, status: "ACTIVE" },
  { uid: "demo-emp-2", email: "michael.advisor@company.com", priority: 2, status: "ACTIVE" },
  { uid: "demo-emp-3", email: "james.closer@company.com", priority: 3, status: "ACTIVE" },
];

export function useEmployees() {
  const [employees, setEmployees] = useState<EmployeeData[]>(DEMO_EMPLOYEES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'employee'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const data = snapshot.docs.map(doc => ({
            uid: doc.id,
            email: doc.data().email || 'Unknown',
            priority: doc.data().priority || 99,
            status: doc.data().status || 'ACTIVE',
          })) as EmployeeData[];
          
          data.sort((a, b) => a.priority - b.priority);
          setEmployees(data);
        } else {
          setEmployees(DEMO_EMPLOYEES);
        }
        setLoading(false);
      }, (error) => {
        console.warn("Firestore employees listener fallback:", error.message);
        setEmployees(DEMO_EMPLOYEES);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (e) {
      setEmployees(DEMO_EMPLOYEES);
      setLoading(false);
    }
  }, []);

  return { employees, loading };
}
