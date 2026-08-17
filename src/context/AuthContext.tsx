"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, IdTokenResult } from "firebase/auth";
import { auth, db } from "@/lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  role: "admin" | "employee" | null;
  loading: boolean;
  loginAsDemo?: (role: "admin" | "employee") => void;
  logout?: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"admin" | "employee" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const tokenResult: IdTokenResult = await currentUser.getIdTokenResult();
          let userRole = (tokenResult.claims.role as "admin" | "employee") || null;
          
          if (!userRole) {
            try {
              const userSnap = await getDoc(doc(db, "users", currentUser.uid));
              if (userSnap.exists()) {
                userRole = userSnap.data()?.role || null;
              }
            } catch (e) {
              console.warn("Could not load user document fallback", e);
            }
          }
          setRole(userRole);
        } catch (error) {
          console.error("Error fetching token claims:", error);
          setRole(null);
        }
      } else {
        // Check if demo session exists in sessionStorage
        const demoRole = typeof window !== 'undefined' ? sessionStorage.getItem("demo_role") : null;
        if (demoRole === "admin" || demoRole === "employee") {
          setUser({
            uid: demoRole === "admin" ? "demo-admin-uid" : "demo-emp-1",
            email: demoRole === "admin" ? "admin@crm.com" : "sarah.sales@company.com",
            getIdToken: async () => demoRole === "admin" ? "demo-admin-token" : "demo-employee-token"
          } as any);
          setRole(demoRole);
        } else {
          setUser(null);
          setRole(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginAsDemo = (demoRole: "admin" | "employee") => {
    sessionStorage.setItem("demo_role", demoRole);
    setUser({
      uid: demoRole === "admin" ? "demo-admin-uid" : "demo-emp-1",
      email: demoRole === "admin" ? "admin@crm.com" : "sarah.sales@company.com",
      getIdToken: async () => demoRole === "admin" ? "demo-admin-token" : "demo-employee-token"
    } as any);
    setRole(demoRole);
  };

  const logout = async () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem("demo_role");
    }
    await auth.signOut();
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, loginAsDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
