import { initializeApp, getApps } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  collection, 
  addDoc, 
  Timestamp,
  getDocs 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDXHoKoRsnqbc0iFW6XO-SeOPtyaYpi2MI",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "cms-system-crm.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "cms-system-crm",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "cms-system-crm.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "961502478386",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:961502478386:web:bdd83f7a3d0c30429a7c2b"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

async function seedLiveDatabase() {
  console.log("=== POPULATING LIVE CLOUD FIRESTORE: cms-system-crm ===");

  const now = new Date();
  const adminUid = "admin-master-uid";

  // 1. SEED USERS COLLECTION
  console.log("1. Creating Users collection...");
  await setDoc(doc(db, "users", adminUid), {
    email: "admin@crm.com",
    role: "admin",
    status: "ACTIVE",
    createdAt: Timestamp.fromDate(now)
  });

  await setDoc(doc(db, "users", "emp-sarah-1"), {
    email: "sarah.sales@company.com",
    role: "employee",
    priority: 1,
    status: "ACTIVE",
    createdAt: Timestamp.fromDate(now)
  });

  await setDoc(doc(db, "users", "emp-michael-2"), {
    email: "michael.advisor@company.com",
    role: "employee",
    priority: 2,
    status: "ACTIVE",
    createdAt: Timestamp.fromDate(now)
  });

  await setDoc(doc(db, "users", "emp-james-3"), {
    email: "james.closer@company.com",
    role: "employee",
    priority: 3,
    status: "ACTIVE",
    createdAt: Timestamp.fromDate(now)
  });
  console.log("-> 4 Users created in /users.");

  // 2. SEED EXPENSES COLLECTION
  console.log("2. Creating Expenses collection...");
  await setDoc(doc(db, "expenses", "exp-meta-ads"), {
    title: "Meta Lead Ads - Summer Acquisition Campaign",
    category: "Marketing",
    amount: 1250,
    description: "Paid social lead campaign across Facebook & Instagram",
    addedByUid: adminUid,
    date: Timestamp.fromDate(now)
  });

  await setDoc(doc(db, "expenses", "exp-fiber-net"), {
    title: "Dedicated Office Fiber Internet",
    category: "Internet",
    amount: 150,
    description: "Monthly enterprise internet connection",
    addedByUid: adminUid,
    date: Timestamp.fromDate(now)
  });

  await setDoc(doc(db, "expenses", "exp-software"), {
    title: "CRM Infrastructure & Software Licenses",
    category: "Software",
    amount: 300,
    description: "Cloud tooling and communication software",
    addedByUid: adminUid,
    date: Timestamp.fromDate(now)
  });
  console.log("-> 3 Expenses created in /expenses.");

  // 3. SEED LEADS & SUBCOLLECTIONS
  console.log("3. Creating Leads collection and subcollections...");
  
  // Lead 1: NEW with 5-minute Admin SLA
  const lead1Id = "lead-meta-101";
  await setDoc(doc(db, "leads", lead1Id), {
    name: "Johnathan Doe (Luxury Villa Lead)",
    phone: "+15552345678",
    email: "johndoe@gmail.com",
    status: "NEW",
    source: "Meta Lead Ads",
    campaignId: "CAMP_SUMMER_LUXURY",
    assignedUserId: null,
    createdAt: Timestamp.fromDate(now),
    adminAssignDeadlineAt: Timestamp.fromMillis(Date.now() + 5 * 60000)
  });

  await addDoc(collection(db, "leads", lead1Id, "events"), {
    type: "LEAD_INGESTED",
    actorUid: "system_meta_webhook",
    at: Timestamp.fromDate(now),
    meta: { source: "Meta Lead Ads", campaign: "CAMP_SUMMER_LUXURY" }
  });

  // Lead 2: ASSIGNED to sarah.sales with 10-minute Acceptance SLA
  const lead2Id = "lead-meta-102";
  await setDoc(doc(db, "leads", lead2Id), {
    name: "Sarah Miller (Commercial Property Inquiry)",
    phone: "+15559876543",
    email: "sarah.m@business.com",
    status: "ASSIGNED",
    source: "Meta Lead Ads",
    campaignId: "CAMP_COMMERCIAL_Q3",
    assignedUserId: "emp-sarah-1",
    assignedAt: Timestamp.fromDate(new Date(Date.now() - 60000)),
    distributionMethod: "MANUAL",
    createdAt: Timestamp.fromDate(new Date(Date.now() - 3600000)),
    acceptDeadlineAt: Timestamp.fromMillis(Date.now() + 9 * 60000)
  });

  await addDoc(collection(db, "leads", lead2Id, "events"), {
    type: "LEAD_INGESTED",
    actorUid: "system_meta_webhook",
    at: Timestamp.fromDate(new Date(Date.now() - 3600000)),
    meta: { campaign: "CAMP_COMMERCIAL_Q3" }
  });

  await addDoc(collection(db, "leads", lead2Id, "events"), {
    type: "MANUALLY_ASSIGNED",
    actorUid: adminUid,
    at: Timestamp.fromDate(new Date(Date.now() - 60000)),
    meta: { assignedTo: "emp-sarah-1" }
  });

  // Lead 3: ACCEPTED by sarah.sales with immutable follow-up timeline
  const lead3Id = "lead-meta-103";
  await setDoc(doc(db, "leads", lead3Id), {
    name: "Alexander Wright (Consulting Client)",
    phone: "+15551122334",
    email: "a.wright@firm.com",
    status: "ACCEPTED",
    source: "Meta Lead Ads",
    campaignId: "CAMP_CONSULTING_PRO",
    assignedUserId: "emp-sarah-1",
    assignedAt: Timestamp.fromDate(new Date(Date.now() - 86400000)),
    acceptedAt: Timestamp.fromDate(new Date(Date.now() - 85000000)),
    distributionMethod: "AUTO",
    createdAt: Timestamp.fromDate(new Date(Date.now() - 86400000))
  });

  await addDoc(collection(db, "leads", lead3Id, "followUps"), {
    message: "Initial discovery discussion completed. Client requested corporate consulting proposal.",
    callMade: true,
    callCount: 1,
    whatsappNote: "Sent executive summary via WhatsApp",
    occurredAt: Timestamp.fromDate(new Date(Date.now() - 80000000)),
    createdAt: Timestamp.fromDate(new Date(Date.now() - 80000000)),
    authorUid: "sarah.sales@company.com"
  });

  await addDoc(collection(db, "leads", lead3Id, "events"), {
    type: "LEAD_ACCEPTED",
    actorUid: "emp-sarah-1",
    at: Timestamp.fromDate(new Date(Date.now() - 85000000)),
    meta: { acceptedBy: "emp-sarah-1" }
  });

  // Lead 4: CLOSED_WON
  const lead4Id = "lead-meta-104";
  await setDoc(doc(db, "leads", lead4Id), {
    name: "David Chen (Closed Deal)",
    phone: "+15554433221",
    email: "d.chen@investments.com",
    status: "CLOSED_WON",
    source: "Meta Lead Ads",
    campaignId: "CAMP_SUMMER_LUXURY",
    assignedUserId: "emp-sarah-1",
    createdAt: Timestamp.fromDate(new Date(Date.now() - 172800000))
  });
  console.log("-> 4 Leads created with subcollections.");

  // 4. SEED CLOSED DEALS COLLECTION
  console.log("4. Creating Closed Deals collection...");
  await setDoc(doc(db, "closedDeals", "deal-chen-104"), {
    leadId: lead4Id,
    userId: "emp-sarah-1",
    amountReceived: 8500,
    payableAmount: 5000,
    profit: 3500,
    enteredAt: Timestamp.fromDate(new Date(Date.now() - 170000000))
  });
  console.log("-> 1 Closed Deal created in /closedDeals.");

  // 5. SEED NOTIFICATIONS COLLECTION
  console.log("5. Creating Notifications collection...");
  await setDoc(doc(db, "notifications", "notif-sla-102"), {
    type: "RED_FLAG",
    leadId: lead2Id,
    targetUid: adminUid,
    payload: {
      message: "Lead Sarah Miller acceptance timer is active.",
      leadName: "Sarah Miller (Commercial Property Inquiry)"
    },
    createdAt: Timestamp.fromDate(now),
    readAt: null
  });
  console.log("-> 1 Notification created in /notifications.");

  // 6. VERIFY ALL COLLECTIONS LIVE
  console.log("\n--- VERIFYING LIVE FIRESTORE COLLECTIONS ---");
  const usersSnap = await getDocs(collection(db, "users"));
  const leadsSnap = await getDocs(collection(db, "leads"));
  const expensesSnap = await getDocs(collection(db, "expenses"));
  const dealsSnap = await getDocs(collection(db, "closedDeals"));
  const notifsSnap = await getDocs(collection(db, "notifications"));

  console.log(`Live Users count: ${usersSnap.size}`);
  console.log(`Live Leads count: ${leadsSnap.size}`);
  console.log(`Live Expenses count: ${expensesSnap.size}`);
  console.log(`Live Closed Deals count: ${dealsSnap.size}`);
  console.log(`Live Notifications count: ${notifsSnap.size}`);

  console.log("\n*** LIVE CLOUD FIRESTORE SEEDING & VERIFICATION COMPLETE! ***\n");
}

seedLiveDatabase().catch(err => {
  console.error("Seeding failed:", err);
});
