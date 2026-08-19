import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { describeFirestoreError, type FirestoreTimestamp } from './useLeads';
import { IS_DEMO, useDemoState } from '@/lib/demo/store';

export interface EmployeeData {
  uid: string;
  name: string;
  email: string;
  priority: number;
  status: 'ACTIVE' | 'DISABLED';
  createdAt?: FirestoreTimestamp;
}

interface EmployeeState {
  employees: EmployeeData[];
  error: string | null;
}

/** The employee roster. Admin-only — Security Rules deny this query to everyone else. */
export function useEmployees(enabled = true) {
  const [state, setState] = useState<EmployeeState | null>(null);
  const demoState = useDemoState();

  useEffect(() => {
    if (IS_DEMO || !enabled) return;

    const q = query(collection(db, 'users'), where('role', '==', 'employee'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const employees = snapshot.docs.map((doc) => {
          const raw = doc.data();
          return {
            uid: doc.id,
            name: raw.name || raw.email || 'Unnamed',
            email: raw.email || '—',
            priority: typeof raw.priority === 'number' ? raw.priority : 99,
            status: raw.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
            createdAt: raw.createdAt,
          } as EmployeeData;
        });

        // Active first, then by rotation priority, then by name.
        employees.sort((a, b) => {
          if (a.status !== b.status) return a.status === 'ACTIVE' ? -1 : 1;
          if (a.priority !== b.priority) return a.priority - b.priority;
          return a.name.localeCompare(b.name);
        });

        setState({ employees, error: null });
      },
      (err) => {
        console.error('[useEmployees]', err);
        setState({ employees: [], error: describeFirestoreError(err) });
      }
    );

    return () => unsubscribe();
  }, [enabled]);

  if (IS_DEMO) {
    return { employees: enabled ? demoState.employees : [], loading: false, error: null };
  }

  return {
    employees: enabled ? (state?.employees ?? []) : [],
    loading: enabled && state === null,
    error: enabled ? (state?.error ?? null) : null,
  };
}
