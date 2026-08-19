import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { IS_DEMO, useDemoState } from '@/lib/demo/store';
import type { LeadStatus } from '@/lib/leadStatus';

export type { LeadStatus };

/**
 * Live lead data.
 *
 * These hooks return real Firestore state and nothing else. An earlier version
 * fell back to hardcoded sample leads whenever a query returned empty or
 * errored, which meant a permissions failure looked like a working dashboard
 * full of fictional customers and fictional revenue. Errors now surface as
 * errors.
 *
 * Each hook stamps its results with the subscription key they came from, and
 * `loading` is derived by comparing that stamp to the current key. That keeps
 * every setState inside an async snapshot callback — resetting state from the
 * effect body instead would trigger a cascading render on every change of role
 * or selected lead.
 */

export interface Lead {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  status: LeadStatus;
  source: string;
  campaignId?: string | null;
  campaignName?: string | null;
  adName?: string | null;
  assignedUserId: string | null;
  attemptedAssignees?: string[];
  createdAt?: FirestoreTimestamp;
  assignedAt?: FirestoreTimestamp;
  acceptedAt?: FirestoreTimestamp;
  closedAt?: FirestoreTimestamp;
  lastActivityAt?: FirestoreTimestamp;
  lastFollowUpAt?: FirestoreTimestamp;
  followUpCount?: number;
  callCount?: number;
  adminAssignDeadlineAt?: FirestoreTimestamp;
  acceptDeadlineAt?: FirestoreTimestamp;
  distributionMethod?: 'MANUAL' | 'AUTO' | 'AUTO_REASSIGN';
  intakeWarning?: string | null;
  customFields?: Record<string, string>;
}

/** Firestore Timestamps as they arrive on the client. */
export interface FirestoreTimestamp {
  toDate: () => Date;
  toMillis: () => number;
  seconds?: number;
}

export interface FollowUpRecord {
  id: string;
  message: string;
  callMade: boolean;
  callCount?: number;
  whatsappNote?: string | null;
  occurredAt?: FirestoreTimestamp;
  createdAt?: FirestoreTimestamp;
  authorUid: string;
  authorEmail?: string | null;
}

export interface AuditEventRecord {
  id: string;
  type: string;
  actorUid: string;
  at?: FirestoreTimestamp;
  meta?: Record<string, unknown>;
}

/** Guards against unbounded reads on the admin dashboard. */
const LEAD_PAGE_SIZE = 500;

interface LeadState {
  key: string;
  leads: Lead[];
  error: string | null;
}

export function useLeads(role: 'admin' | 'employee' | null, uid?: string) {
  const [state, setState] = useState<LeadState | null>(null);
  const demoState = useDemoState();

  const key = !role || (role === 'employee' && !uid) ? 'idle' : role === 'admin' ? 'admin' : `employee:${uid}`;

  useEffect(() => {
    if (IS_DEMO || key === 'idle') return;

    const leadsRef = collection(db, 'leads');
    const q =
      key === 'admin'
        ? query(leadsRef, orderBy('createdAt', 'desc'), limit(LEAD_PAGE_SIZE))
        : query(
            leadsRef,
            where('assignedUserId', '==', uid),
            orderBy('createdAt', 'desc'),
            limit(LEAD_PAGE_SIZE)
          );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setState({
          key,
          leads: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Lead[],
          error: null,
        });
      },
      (err) => {
        console.error('[useLeads]', err);
        setState({ key, leads: [], error: describeFirestoreError(err) });
      }
    );

    return () => unsubscribe();
    // `uid` is encoded in `key`, so the key alone identifies the subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (IS_DEMO) {
    const leads =
      role === 'admin'
        ? demoState.leads
        : demoState.leads.filter((lead) => lead.assignedUserId === uid);
    return { leads, loading: false, error: null };
  }

  const current = state?.key === key ? state : null;

  return {
    leads: current?.leads ?? [],
    loading: key !== 'idle' && current === null,
    error: current?.error ?? null,
  };
}

interface HistoryState {
  key: string;
  followUps: FollowUpRecord[];
  events: AuditEventRecord[];
  error: string | null;
}

export function useLeadHistory(leadId: string | null) {
  const [state, setState] = useState<HistoryState | null>(null);
  const demoState = useDemoState();
  const key = leadId ?? 'idle';

  useEffect(() => {
    if (IS_DEMO || !leadId) return;

    let followUps: FollowUpRecord[] = [];
    let events: AuditEventRecord[] = [];
    let error: string | null = null;

    const publish = () => setState({ key: leadId, followUps, events, error });

    const unsubFollowUps = onSnapshot(
      query(collection(db, 'leads', leadId, 'followUps'), orderBy('occurredAt', 'desc')),
      (snap) => {
        followUps = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as FollowUpRecord[];
        publish();
      },
      (err) => {
        console.error('[useLeadHistory:followUps]', err);
        followUps = [];
        error = describeFirestoreError(err);
        publish();
      }
    );

    const unsubEvents = onSnapshot(
      query(collection(db, 'leads', leadId, 'events'), orderBy('at', 'desc')),
      (snap) => {
        events = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as AuditEventRecord[];
        publish();
      },
      (err) => {
        console.error('[useLeadHistory:events]', err);
        events = [];
        publish();
      }
    );

    return () => {
      unsubFollowUps();
      unsubEvents();
    };
  }, [leadId]);

  if (IS_DEMO) {
    return {
      followUps: leadId ? (demoState.followUps[leadId] ?? []) : [],
      events: leadId ? (demoState.events[leadId] ?? []) : [],
      loading: false,
      error: null,
    };
  }

  const current = state?.key === key ? state : null;

  return {
    followUps: current?.followUps ?? [],
    events: current?.events ?? [],
    loading: Boolean(leadId) && current === null,
    error: current?.error ?? null,
  };
}

export function describeFirestoreError(err: { code?: string; message?: string }): string {
  if (err?.code === 'permission-denied') {
    return 'You do not have access to this data. If you were recently given a role, sign out and sign in again.';
  }
  if (err?.code === 'failed-precondition') {
    return 'This view needs a database index that has not been created yet. Deploy the Firestore indexes and try again.';
  }
  if (err?.code === 'unavailable') {
    return 'Cannot reach the database. Check your connection.';
  }
  return err?.message ?? 'Could not load data.';
}
