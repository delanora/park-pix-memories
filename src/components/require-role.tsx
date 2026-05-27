import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

type Role = "operator" | "customer" | "super_admin";

export function RequireRole({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const { loading, userId, isOperator, isCustomer, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const ok =
    role === "operator"
      ? isOperator
      : role === "customer"
      ? isCustomer
      : isSuperAdmin;

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      navigate({
        to:
          role === "customer"
            ? "/login-cliente"
            : "/login-operador",
      });
      return;
    }
    if (!ok) {
      navigate({ to: "/" });
    }
  }, [loading, userId, ok, role, navigate]);

  if (loading || !userId || !ok) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <>{children}</>;
}
