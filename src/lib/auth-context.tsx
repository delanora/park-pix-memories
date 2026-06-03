import { useEffect, useState, type ReactNode } from "react";
import { createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getMyRole } from "@/lib/photos.functions";

type AuthState = {
  loading: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  isOperator: boolean;
  isCustomer: boolean;
  isSuperAdmin: boolean;
  isRestrictedOperator: boolean;
  tenantId: string | null;
  tenantSlug: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isOperator, setIsOperator] = useState(false);
  const [isCustomer, setIsCustomer] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isRestrictedOperator, setIsRestrictedOperator] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const getRoleFn = useServerFn(getMyRole);

  const loadRole = async (uid: string | null) => {
    if (!uid) {
      setIsOperator(false);
      setIsCustomer(false);
      setIsSuperAdmin(false);
      setIsRestrictedOperator(false);
      setTenantId(null);
      setTenantSlug(null);
      return;
    }
    try {
      const r = await getRoleFn();
      setIsOperator(r.isOperator);
      setIsCustomer(r.isCustomer);
      setIsSuperAdmin(r.isSuperAdmin);
      setIsRestrictedOperator(!!(r as any).isRestrictedOperator);
      setTenantId(r.tenantId);
      setTenantSlug(r.tenantSlug);
    } catch {
      setIsOperator(false);
      setIsCustomer(false);
      setIsSuperAdmin(false);
      setIsRestrictedOperator(false);
      setTenantId(null);
      setTenantSlug(null);
    }
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    setUserId(session?.user?.id ?? null);
    setEmail(session?.user?.email ?? null);
    await loadRole(session?.user?.id ?? null);
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user?.id ?? null);
        setEmail(session?.user?.email ?? null);
        setTimeout(() => loadRole(session?.user?.id ?? null), 0);
      },
    );
    refresh();
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserId(null);
    setEmail(null);
    setIsOperator(false);
    setIsCustomer(false);
    setIsSuperAdmin(false);
    setIsRestrictedOperator(false);
    setTenantId(null);
    setTenantSlug(null);
  };

  return (
    <AuthContext.Provider
      value={{
        loading, userId, email,
        isOperator, isCustomer, isSuperAdmin, isRestrictedOperator,
        tenantId, tenantSlug,
        refresh, signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
