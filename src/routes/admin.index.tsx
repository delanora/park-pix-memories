import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGlobalStats } from "@/lib/admin.functions";
import { Building2, Users, Images, ShoppingBag, DollarSign } from "lucide-react";
import { formatPriceBRL } from "@/lib/photo-utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const fn = useServerFn(getGlobalStats);
  const { data } = useQuery({ queryKey: ["admin-stats"], queryFn: () => fn() });

  const cards = [
    { label: "Empresas", value: data?.tenants ?? "—", icon: Building2 },
    { label: "Operadores", value: data?.operators ?? "—", icon: Users },
    { label: "Fotos", value: data?.photos ?? "—", icon: Images },
    { label: "Vendas", value: data?.sales ?? "—", icon: ShoppingBag },
    {
      label: "Receita total",
      value: data ? formatPriceBRL(data.revenue) : "—",
      icon: DollarSign,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Dashboard global</h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada de todas as empresas do ParkSnap.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/empresas">Gerenciar empresas</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border bg-card p-5 shadow-soft"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {c.label}
              </span>
              <c.icon className="h-4 w-4 text-foreground" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
