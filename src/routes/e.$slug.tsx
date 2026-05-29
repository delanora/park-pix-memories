import { createFileRoute, Outlet, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicTenantBySlug } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-context";
import { useSettings } from "@/lib/settings-context";
import { Camera, LogIn, LogOut, Images, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";


export const Route = createFileRoute("/e/$slug")({
  component: TenantLayout,
});

function TenantLayout() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const fn = useServerFn(getPublicTenantBySlug);
  const navigate = useNavigate();
  const { data: tenant, isLoading } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: () => fn({ data: { slug } }),
  });
  const s = useSettings();
  const { userId, isCustomer, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-3xl font-bold">Empresa não encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A URL <code>/e/{slug}</code> não corresponde a nenhuma empresa.
          </p>
          <Button asChild className="mt-4">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (tenant.status !== "active") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-bold">{tenant.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta empresa está temporariamente indisponível.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col">
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link to="/e/$slug" params={{ slug }} className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-sunset shadow-glow">
              <Camera className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-base font-bold">{s.siteName}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.siteTagline}
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            {userId && isCustomer ? (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/e/$slug/galeria" params={{ slug }}>
                    <Images className="h-4 w-4" />
                    Minhas fotos
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/e/$slug", params: { slug } });
                  }}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login-operador">
                    <UserCog className="h-4 w-4" />
                    Área do operador
                  </Link>
                </Button>
                <Button asChild size="sm" className="bg-gradient-sunset shadow-glow">
                  <Link to="/e/$slug/login" params={{ slug }}>
                    <LogIn className="h-4 w-4" />
                    {s.ctaCustomer}
                  </Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
