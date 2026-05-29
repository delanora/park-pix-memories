import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGlobalStats, getAdminAnalytics } from "@/lib/admin.functions";
import { Building2, Users, Images, ShoppingBag, DollarSign } from "lucide-react";
import { formatPriceBRL } from "@/lib/photo-utils";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function monthLabel(ym: string) {
  const [, m] = ym.split("-");
  return MONTH_LABELS[Number(m) - 1] ?? ym;
}

function AdminDashboard() {
  const statsFn = useServerFn(getGlobalStats);
  const analyticsFn = useServerFn(getAdminAnalytics);
  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: () => statsFn() });
  const { data: analytics } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => analyticsFn(),
  });

  const cards = [
    { label: "Empresas", value: stats?.tenants ?? "—", icon: Building2 },
    { label: "Operadores", value: stats?.operators ?? "—", icon: Users },
    { label: "Fotos", value: stats?.photos ?? "—", icon: Images },
    { label: "Vendas", value: stats?.sales ?? "—", icon: ShoppingBag },
    {
      label: "Receita total",
      value: stats ? formatPriceBRL(stats.revenue) : "—",
      icon: DollarSign,
    },
  ];

  // Build per-tenant revenue chart data (one bar per tenant)
  const revenueByTenant = (analytics?.perTenant ?? []).map((t) => ({
    name: t.name,
    revenue: t.revenue,
    sales: t.sales,
    photos: t.photos,
  }));

  // Monthly stacked series: months on X, one column per tenant
  const monthly = (() => {
    if (!analytics) return [];
    const months = analytics.revenueByMonth.map((p) => p.month);
    return months.map((m) => {
      const row: Record<string, number | string> = { month: monthLabel(m) };
      for (const t of analytics.revenueByMonthByTenant) {
        const point = t.points.find((p) => p.month === m);
        row[t.name] = point?.total ?? 0;
      }
      return row;
    });
  })();

  const palette = [
    "oklch(0.7 0.19 35)",
    "oklch(0.55 0.2 285)",
    "oklch(0.65 0.22 0)",
    "oklch(0.7 0.17 150)",
    "oklch(0.65 0.18 220)",
    "oklch(0.6 0.2 320)",
    "oklch(0.72 0.16 80)",
    "oklch(0.58 0.19 250)",
  ];

  const tenantChartConfig: ChartConfig = (analytics?.revenueByMonthByTenant ?? []).reduce(
    (acc, t, i) => {
      acc[t.name] = { label: t.name, color: palette[i % palette.length] };
      return acc;
    },
    {} as ChartConfig,
  );

  const revenueBarConfig: ChartConfig = {
    revenue: { label: "Receita", color: "oklch(0.7 0.19 35)" },
  };

  const totalConfig: ChartConfig = {
    total: { label: "Receita", color: "oklch(0.55 0.2 285)" },
  };

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

      {/* Charts */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="mb-4">
            <h2 className="font-display text-lg font-bold">Receita por empresa</h2>
            <p className="text-xs text-muted-foreground">Total acumulado</p>
          </div>
          {revenueByTenant.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <ChartContainer config={revenueBarConfig} className="h-72 w-full">
              <BarChart data={revenueByTenant}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatPriceBRL(Number(v))}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(v) => formatPriceBRL(Number(v))}
                    />
                  }
                />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="mb-4">
            <h2 className="font-display text-lg font-bold">Receita total — últimos 6 meses</h2>
            <p className="text-xs text-muted-foreground">Soma de todas as empresas</p>
          </div>
          {!analytics ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <ChartContainer config={totalConfig} className="h-72 w-full">
              <AreaChart
                data={analytics.revenueByMonth.map((p) => ({
                  month: monthLabel(p.month),
                  total: p.total,
                }))}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatPriceBRL(Number(v))}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(v) => formatPriceBRL(Number(v))}
                    />
                  }
                />
                <Area
                  dataKey="total"
                  type="monotone"
                  stroke="var(--color-total)"
                  fill="var(--color-total)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-4">
          <h2 className="font-display text-lg font-bold">Receita mensal por empresa</h2>
          <p className="text-xs text-muted-foreground">
            Comparativo dos últimos 6 meses
          </p>
        </div>
        {monthly.length === 0 || !analytics ? (
          <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
        ) : (
          <ChartContainer config={tenantChartConfig} className="h-80 w-full">
            <BarChart data={monthly}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatPriceBRL(Number(v))}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(v) => formatPriceBRL(Number(v))}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {analytics.revenueByMonthByTenant.map((t) => (
                <Bar
                  key={t.id}
                  dataKey={t.name}
                  stackId="rev"
                  fill={`var(--color-${t.name})`}
                  radius={[0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-4">
          <h2 className="font-display text-lg font-bold">Desempenho por empresa</h2>
          <p className="text-xs text-muted-foreground">
            Receita, vendas, fotos e operadores
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-4">Empresa</th>
                <th className="py-2 pr-4">Receita</th>
                <th className="py-2 pr-4">Vendas</th>
                <th className="py-2 pr-4">Fotos</th>
                <th className="py-2 pr-4">Operadores</th>
              </tr>
            </thead>
            <tbody>
              {(analytics?.perTenant ?? []).map((t) => (
                <tr key={t.id} className="border-b border-border/60">
                  <td className="py-2 pr-4 font-medium">{t.name}</td>
                  <td className="py-2 pr-4">{formatPriceBRL(t.revenue)}</td>
                  <td className="py-2 pr-4">{t.sales}</td>
                  <td className="py-2 pr-4">{t.photos}</td>
                  <td className="py-2 pr-4">{t.operators}</td>
                </tr>
              ))}
              {(!analytics || analytics.perTenant.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-muted-foreground">
                    Sem empresas cadastradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
