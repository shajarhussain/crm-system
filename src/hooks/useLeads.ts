import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export type LeadStatus = 
  | 'NEW'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'CONTACTED'
  | 'FOLLOW_UP'
  | 'INTERESTED'
  | 'NEGOTIATION'
  | 'CLOSED_WON'
  | 'CLOSED_LOST'
  | 'NOT_INTERESTED'
  | 'NO_RESPONSE'
  | 'UNASSIGNED_NO_CAPACITY';

export interface Lead {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  status: LeadStatus;
  source: string;
  campaignId: string;
  assignedUserId: string | null;
  createdAt: any;
  assignedAt?: any;
  acceptedAt?: any;
  adminAssignDeadlineAt?: any;
  acceptDeadlineAt?: any;
  distributionMethod?: 'MANUAL' | 'AUTO' | 'AUTO_REASSIGN';
}

export interface FollowUpRecord {
  id: string;
  message: string;
  callMade: boolean;
  callCount?: number;
  whatsappNote?: string;
  occurredAt: any;
  createdAt: any;
  authorUid: string;
}

export interface AuditEventRecord {
  id: string;
  type: string;
  actorUid: string;
  at: any;
  meta?: any;
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
    const q = role === 'admin' 
      ? query(leadsRef) 
      : query(leadsRef, where('assignedUserId', '==', uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Lead[];
      
      data.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
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

export function useLeadHistory(leadId: string | null) {
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  const [events, setEvents] = useState<AuditEventRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId) {
      setFollowUps([]);
      setEvents([]);
      return;
    }

    setLoading(true);

    const fuRef = collection(db, 'leads', leadId, 'followUps');
    const unsubFu = onSnapshot(fuRef, (snap) => {
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FollowUpRecord[];
      
      list.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
      });
      setFollowUps(list);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching follow-ups:", err);
      setLoading(false);
    });

    const eventsRef = collection(db, 'leads', leadId, 'events');
    const unsubEvents = onSnapshot(eventsRef, (snap) => {
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AuditEventRecord[];
      
      list.sort((a, b) => {
        const aTime = a.at?.toMillis ? a.at.toMillis() : 0;
        const bTime = b.at?.toMillis ? b.at.toMillis() : 0;
        return bTime - aTime;
      });
      setEvents(list);
    }, (err) => {
      console.error("Error fetching events:", err);
    });

    return () => {
      unsubFu();
      unsubEvents();
    };
  }, [leadId]);

  return { followUps, events, loading };
}
