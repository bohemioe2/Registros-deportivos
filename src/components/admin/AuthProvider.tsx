"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: User | null;
  role: "SUPERADMIN" | "ORGANIZER" | "STAFF" | null;
  assignedEventId: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: null, assignedEventId: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"SUPERADMIN" | "ORGANIZER" | "STAFF" | null>(null);
  const [assignedEventId, setAssignedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'your_api_key') {
      setUser({ uid: 'mock-admin', email: 'admin@local' } as User);
      setRole("SUPERADMIN");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && currentUser.email) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.email));
          let finalRole = null;
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            finalRole = data.role || "ORGANIZER";
            setRole(finalRole as any);
            setAssignedEventId(data.assignedEventId || null);
          } else {
            // Absolute master lock
            if (currentUser.email === "eder.beltran.acosta@gmail.com") {
              finalRole = "SUPERADMIN";
              setRole("SUPERADMIN");
              setAssignedEventId(null);
            } else {
              setRole(null);
              setAssignedEventId(null);
            }
          }
          
          if (!finalRole && pathname.startsWith('/admin')) {
             await auth.signOut();
             router.push('/login?error=unauthorized');
          }
          
        } catch (e) {
          console.error("Error fetching user role", e);
          if (currentUser.email === "eder.beltran.acosta@gmail.com") {
             setRole("SUPERADMIN");
          } else {
             setRole(null);
             if (pathname.startsWith('/admin')) router.push('/login?error=error');
          }
        }
      } else {
        setUser(null);
        setRole(null);
        setAssignedEventId(null);
        if (pathname.startsWith('/admin')) {
          router.push('/login');
        }
      }
      
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname]);

  return (
    <AuthContext.Provider value={{ user, role, assignedEventId, loading }}>
      {!loading ? children : <div className="flex h-screen items-center justify-center bg-[#1b1c27] text-white">Cargando Plataforma...</div>}
    </AuthContext.Provider>
  );
}
