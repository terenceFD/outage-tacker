"use client";

import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import { createClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

// Tiny client-side session context: exposes the signed-in user (or null)
// to client components. Mounted once from app/[locale]/layout.tsx.
const SessionContext = createContext<{
  user: User | null;
  loading: boolean;
}>({ user: null, loading: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseBrowserConfigured());

  useEffect(() => {
    if (!isSupabaseBrowserConfigured()) {
      return;
    }
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <SessionContext.Provider value={{ user, loading }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext() {
  return useContext(SessionContext);
}
