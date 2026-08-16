import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === 'crm_system_meta_token') {
    return new NextResponse(challenge, { status: 200 });
  } else {
    return new NextResponse('Forbidden', { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.object === "page") {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === "leadgen") {
            const leadId = change.value.leadgen_id;
            const docRef = adminDb.collection("leads").doc(leadId);
            
            // 5 minute deadline
            const deadline = new Date(Date.now() + 5 * 60000);

            await docRef.set({
              name: "Meta Lead " + leadId,
              createdAt: FieldValue.serverTimestamp(),
              status: "NEW",
              source: "META_ADS",
              campaignId: change.value.campaign_id || "unknown",
              assignedUserId: null,
              adminAssignDeadlineAt: deadline
            });
          }
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
