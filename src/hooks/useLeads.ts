import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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

const DEMO_LEADS: Lead[] = [
  {
    id: "lead-meta-101",
    name: "Johnathan Doe (Luxury Villa Lead)",
    phone: "+15552345678",
    email: "johndoe@gmail.com",
    status: "NEW",
    source: "Meta Lead Ads",
    campaignId: "CAMP_SUMMER_LUXURY",
    assignedUserId: null,
    createdAt: { toDate: () => new Date() },
    adminAssignDeadlineAt: { toMillis: () => Date.now() + 4 * 60000 + 30000 }
  },
  {
    id: "lead-meta-102",
    name: "Sarah Miller (Commercial Property Inquiry)",
    phone: "+15559876543",
    email: "sarah.m@business.com",
    status: "ASSIGNED",
    source: "Meta Lead Ads",
    campaignId: "CAMP_COMMERCIAL_Q3",
    assignedUserId: "demo-emp-1",
    createdAt: { toDate: () => new Date(Date.now() - 3600000) },
    acceptDeadlineAt: { toMillis: () => Date.now() + 8 * 60000 + 15000 }
  },
  {
    id: "lead-meta-103",
    name: "Alexander Wright (Consulting Client)",
    phone: "+15551122334",
    email: "a.wright@firm.com",
    status: "ACCEPTED",
    source: "Meta Lead Ads",
    campaignId: "CAMP_CONSULTING_PRO",
    assignedUserId: "demo-emp-1",
    createdAt: { toDate: () => new Date(Date.now() - 86400000) },
    distributionMethod: "AUTO"
  },
  {
    id: "lead-meta-104",
    name: "David Chen (Closed Deal)",
    phone: "+15554433221",
    email: "d.chen@investments.com",
    status: "CLOSED_WON",
    source: "Meta Lead Ads",
    campaignId: "CAMP_SUMMER_LUXURY",
    assignedUserId: "demo-emp-1",
    createdAt: { toDate: () => new Date(Date.now() - 172800000) }
  }
];

const DEMO_FOLLOWUPS: FollowUpRecord[] = [
  {
    id: "fu-1",
    message: "Called client regarding commercial property portfolio. Client expressed high interest in Q3 options.",
    callMade: true,
    callCount: 2,
    whatsappNote: "Sent catalog link via WhatsApp chat",
    occurredAt: { toDate: () => new Date() },
    createdAt: { toDate: () => new Date() },
    authorUid: "sarah.sales"
  }
];

const DEMO_EVENTS: AuditEventRecord[] = [
  {
    id: "ev-1",
    type: "LEAD_INGESTED",
    actorUid: "system_meta_webhook",
    at: { toDate: () => new Date(Date.now() - 3600000) },
    meta: { source: "Meta Lead Ads", campaign: "CAMP_COMMERCIAL_Q3" }
  },
  {
    id: "ev-2",
    type: "MANUALLY_ASSIGNED",
    actorUid: "admin",
    at: { toDate: () => new Date(Date.now() - 3300000) },
    meta: { assignedTo: "demo-emp-1" }
  }
];

export function useLeads(role: 'admin' | 'employee', uid?: string) {
  const [leads, setLeads] = useState<Lead[]>(DEMO_LEADS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!role || (role === 'employee' && !uid)) {
      setLoading(false);
      return;
    }

    try {
      const leadsRef = collection(db, 'leads');
      const q = role === 'admin' 
        ? query(leadsRef) 
        : query(leadsRef, where('assignedUserId', '==', uid));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
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
        } else {
          // If Firestore is empty, show demo leads filtered by role
          if (role === 'employee') {
            setLeads(DEMO_LEADS.filter(l => l.assignedUserId === "demo-emp-1" || l.assignedUserId === uid));
          } else {
            setLeads(DEMO_LEADS);
          }
        }
        setLoading(false);
      }, (error) => {
        console.warn("Firestore leads listener fallback:", error.message);
        if (role === 'employee') {
          setLeads(DEMO_LEADS.filter(l => l.assignedUserId === "demo-emp-1" || l.assignedUserId === uid));
        } else {
          setLeads(DEMO_LEADS);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (e) {
      setLoading(false);
    }
  }, [role, uid]);

  return { leads, loading };
}

export function useLeadHistory(leadId: string | null) {
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>(DEMO_FOLLOWUPS);
  const [events, setEvents] = useState<AuditEventRecord[]>(DEMO_EVENTS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId) {
      setFollowUps([]);
      setEvents([]);
      return;
    }

    setLoading(true);

    try {
      const fuRef = collection(db, 'leads', leadId, 'followUps');
      const unsubFu = onSnapshot(fuRef, (snap) => {
        if (!snap.empty) {
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
        } else {
          setFollowUps(DEMO_FOLLOWUPS);
        }
        setLoading(false);
      }, () => {
        setFollowUps(DEMO_FOLLOWUPS);
        setLoading(false);
      });

      const eventsRef = collection(db, 'leads', leadId, 'events');
      const unsubEvents = onSnapshot(eventsRef, (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as AuditEventRecord[];
          setEvents(list);
        } else {
          setEvents(DEMO_EVENTS);
        }
      }, () => {
        setEvents(DEMO_EVENTS);
      });

      return () => {
        unsubFu();
        unsubEvents();
      };
    } catch (e) {
      setFollowUps(DEMO_FOLLOWUPS);
      setEvents(DEMO_EVENTS);
      setLoading(false);
    }
  }, [leadId]);

  return { followUps, events, loading };
}
