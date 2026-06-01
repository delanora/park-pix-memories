import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

type Role = "operator" | "customer" | "super_admin";

export function RequireRole({
  role,
  fullOperator,
  children,
}: {
  role: Role;
  /** When true and role is "operator", restricted (photo-only) operators are denied. */
  fullOperator?: boolean;
  children: ReactNode;
}) {
  const { loading, userId, isOperator, isCustomer, isSuperAdmin, isRestrictedOperator } = useAuth();
  const navigate = useNavigate();
  const baseOk =
    role === "operator"
      ? isOperator
      : role === "customer"
      ? isCustomer
      : isSuperAdmin;
  const ok =
    baseOk && (role !== "operator" || !fullOperator || !isRestrictedOperator);

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
      // Restricted operator trying to access a full-operator-only area:
      // send them back to their dashboard instead of the home page.
      if (role === "operator" && isOperator && isRestrictedOperator) {
        navigate({ to: "/operador" });
      } else {
        navigate({ to: "/" });
      }
    }
  }, [loading, userId, ok, role, isOperator, isRestrictedOperator, navigate]);

  if (loading || !userId || !ok) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <>{children}</>;
}
