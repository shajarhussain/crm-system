import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDXHoKoRsnqbc0iFW6XO-SeOPtyaYpi2MI",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "cms-system-crm.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "cms-system-crm",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "cms-system-crm.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "961502478386",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:961502478386:web:bdd83f7a3d0c30429a7c2b"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

async function seed() {
  console.log("Seeding Admin & Employee users and demo leads...");

  // 1. Admin User
  let adminUid = "";
  try {
    const cred = await createUserWithEmailAndPassword(auth, "admin@crm.com", "Admin@123456");
    adminUid = cred.user.uid;
    console.log("Created Admin:", adminUid);
  } catch (e: any) {
    if (e.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, "admin@crm.com", "Admin@123456");
      adminUid = cred.user.uid;
      console.log("Logged into existing Admin:", adminUid);
    } else {
      console.error("Admin creation error:", e);
    }
  }

  if (adminUid) {
    await setDoc(doc(db, "users", adminUid), {
      email: "admin@crm.com",
      role: "admin",
      status: "ACTIVE",
      createdAt: serverTimestamp()
    }, { merge: true });
  }

  // 2. Employee User
  let empUid = "";
  try {
    const cred = await createUserWithEmailAndPassword(auth, "employee1@crm.com", "Employee@123456");
    empUid = cred.user.uid;
    console.log("Created Employee 1:", empUid);
  } catch (e: any) {
    if (e.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, "employee1@crm.com", "Employee@123456");
      empUid = cred.user.uid;
      console.log("Logged into existing Employee 1:", empUid);
    } else {
      console.error("Employee creation error:", e);
    }
  }

  if (empUid) {
    await setDoc(doc(db, "users", empUid), {
      email: "employee1@crm.com",
      role: "employee",
      priority: 1,
      status: "ACTIVE",
      createdAt: serverTimestamp()
    }, { merge: true });
  }

  // 3. Seed Sample Leads
  console.log("Seeding sample leads...");
  const lead1 = await addDoc(collection(db, "leads"), {
    name: "John Doe (Meta Ad Campaign #101)",
    phone: "+1234567890",
    email: "johndoe@example.com",
    status: "NEW",
    source: "Meta Lead Ads",
    campaignId: "CAMP_SUMMER_2026",
    assignedUserId: null,
    createdAt: serverTimestamp(),
    adminAssignDeadlineAt: new Date(Date.now() + 5 * 60000)
  });
  console.log("Created NEW lead:", lead1.id);

  if (empUid) {
    const lead2 = await addDoc(collection(db, "leads"), {
      name: "Sarah Smith (Real Estate Inquiry)",
      phone: "+1987654321",
      email: "sarah.smith@example.com",
      status: "ASSIGNED",
      source: "Meta Lead Ads",
      campaignId: "CAMP_REALESTATE_Q3",
      assignedUserId: empUid,
      assignedAt: serverTimestamp(),
      distributionMethod: "MANUAL",
      createdAt: serverTimestamp(),
      acceptDeadlineAt: new Date(Date.now() + 10 * 60000)
    });
    console.log("Created ASSIGNED lead:", lead2.id);

    const lead3 = await addDoc(collection(db, "leads"), {
      name: "Michael Johnson (Consulting Client)",
      phone: "+1122334455",
      email: "michael.j@example.com",
      status: "ACCEPTED",
      source: "Meta Lead Ads",
      campaignId: "CAMP_CONSULTING_PRO",
      assignedUserId: empUid,
      assignedAt: serverTimestamp(),
      acceptedAt: serverTimestamp(),
      distributionMethod: "AUTO",
      createdAt: serverTimestamp()
    });
    console.log("Created ACCEPTED lead:", lead3.id);
  }

  // 4. Seed an Expense
  await addDoc(collection(db, "expenses"), {
    title: "Meta Ads Campaign - August Budget",
    category: "Marketing",
    amount: 750,
    description: "Paid traffic for lead acquisition across Instagram & Facebook",
    addedByUid: adminUid,
    date: serverTimestamp()
  });

  console.log("Seeding complete!");
}

seed().catch(console.error);
