import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export interface Lead {
  id: string;
  name: string;
  status: 'NEW' | 'ASSIGNED' | 'ACCEPTED' | 'CLOSED_WON' | 'UNASSIGNED_NO_CAPACITY';
  source: string;
  campaignId: string;
  assignedUserId: string | null;
  createdAt: any;
  adminAssignDeadlineAt?: any;
  acceptDeadlineAt?: any;
}

export function useLeads(role: 'admin' | 'employee', uid?: string) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!role || (role === 'employee' && !uid)) {
      setLoading(false);
      return;
    }

    const leadsRef = collection(db, 'leads');
    // We sort client-side to avoid needing a complex composite index immediately
    const q = role === 'admin' 
      ? query(leadsRef) 
      : query(leadsRef, where('assignedUserId', '==', uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Lead[];
      
      // Sort by createdAt descending
      data.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
      });

      setLeads(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching leads:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [role, uid]);

  return { leads, loading };
}
