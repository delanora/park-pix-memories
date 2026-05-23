import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOperatorStats } from "@/lib/photos.functions";
import { RequireRole } from "@/components/require-role";
import { Images, ShoppingBag, Users, DollarSign, Upload, Receipt } from "lucide-react";
import { formatPriceBRL } from "@/lib/photo-utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/operador/")({
  head: () => ({ meta: [{ title: "Dashboard | ParkSnap" }] }),
  component: () => (
    <RequireRole role="operator">
      <Dashboard />
    </RequireRole>
  ),
});

function Dashboard() {
  const statsFn = useServerFn(getOperatorStats);
  const { data } = useQuery({
    queryKey: ["operator-stats"],
    queryFn: () => statsFn(),
  });

  const cards = [
    {
      label: "Disponíveis",
      value: data?.available ?? "—",
      icon: Images,
    },
    {
      label: "Vendidas",
      value: data?.sold ?? "—",
      icon: ShoppingBag,
    },
    { label: "Clientes", value: data?.customers ?? "—", icon: Users },
    {
      label: "Receita",
      value: data ? formatPriceBRL(data.revenue) : "—",
      icon: DollarSign,
    },
  ];

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Painel do operador</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral das fotos e vendas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border bg-card p-5 shadow-soft"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {c.label}
              </span>
              <c.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <ActionCard
          icon={Upload}
          title="Enviar nova foto"
          text="Capture uma foto na atração e envie para a galeria."
          to="/operador/upload"
          cta="Enviar foto"
        />
        <ActionCard
          icon={Receipt}
          title="Vender imagens"
          text="Selecione fotos e cadastre o cliente para liberar o download."
          to="/operador/galeria"
          cta="Abrir galeria"
        />
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  text,
  to,
  cta,
}: {
  icon: any;
  title: string;
  text: string;
  to: string;
  cta: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-sunset">
        <Icon className="h-5 w-5 text-primary-foreground" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      <Button asChild className="mt-4 bg-gradient-sunset shadow-glow">
        <Link to={to}>{cta}</Link>
      </Button>
    </div>
  );
}
