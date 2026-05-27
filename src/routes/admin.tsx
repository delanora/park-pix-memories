import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { RequireRole } from "@/components/require-role";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Shield, LayoutDashboard, Building2, LogOut } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Super Admin — ParkSnap" }] }),
  component: () => (
    <RequireRole role="super_admin">
      <AdminLayout />
    </RequireRole>
  ),
});

function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { email, signOut } = useAuth();
  const navigate = useNavigate();

  const nav = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/admin/empresas", label: "Empresas", icon: Building2 },
  ];

  const isActive = (to: string, exact?: boolean) =>
    exact ? path === to : path.startsWith(to);

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold leading-none">
                ParkSnap Admin
              </h1>
              <p className="text-[11px] text-muted-foreground">Painel global</p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {nav.map((n) => (
              <Button
                key={n.to}
                asChild
                variant={isActive(n.to, n.exact) ? "default" : "ghost"}
                size="sm"
              >
                <Link to={n.to}>
                  <n.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{n.label}</span>
                </Link>
              </Button>
            ))}
            <span className="ml-3 hidden text-xs text-muted-foreground md:inline">
              {email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
