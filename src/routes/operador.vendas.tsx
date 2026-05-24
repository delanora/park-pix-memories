import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSalesMetrics, listSales } from "@/lib/photos.functions";
import { RequireRole } from "@/components/require-role";
import { formatPriceBRL } from "@/lib/photo-utils";
import { Camera, DollarSign, Loader2, Receipt, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/operador/vendas")({
  head: () => ({ meta: [{ title: "Vendas | ParkSnap" }] }),
  component: () => (
    <RequireRole role="operator">
      <SalesPage />
    </RequireRole>
  ),
});

function SalesPage() {
  const metricsFn = useServerFn(getSalesMetrics);
  const listFn = useServerFn(listSales);

  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ["sales-metrics"],
    queryFn: () => metricsFn(),
  });
  const { data: sales, isLoading: loadingSales } = useQuery({
    queryKey: ["sales"],
    queryFn: () => listFn(),
  });

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Vendas</h1>
        <p className="text-sm text-muted-foreground">
          Métricas em tempo real e histórico completo de vendas.
        </p>
      </div>

      {loadingMetrics || !metrics ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<DollarSign className="h-5 w-5" />}
              label="Receita total"
              value={formatPriceBRL(metrics.totalRevenue)}
              hint={`${metrics.totalSales} vendas`}
            />
            <StatCard
              icon={<Receipt className="h-5 w-5" />}
              label="Hoje"
              value={formatPriceBRL(metrics.todayRevenue)}
              hint={`${metrics.todaySalesCount} vendas`}
            />
            <StatCard
              icon={<Camera className="h-5 w-5" />}
              label="No mês"
              value={formatPriceBRL(metrics.monthRevenue)}
              hint={`${metrics.monthSalesCount} vendas`}
            />
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="Fotos vendidas"
              value={String(metrics.totalPhotos)}
              hint="acumulado"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-3 font-display text-lg font-semibold">
                Vendas por hora (últimas 24h)
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.byHour}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="hour" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip
                      formatter={(v: number, name) =>
                        name === "revenue" ? formatPriceBRL(v) : v
                      }
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar
                      dataKey="revenue"
                      name="Receita"
                      fill="var(--primary)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="mb-3 font-display text-lg font-semibold">
                Vendas dos últimos 14 dias
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.byDay}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="day" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip
                      formatter={(v: number) => formatPriceBRL(v)}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name="Receita"
                      stroke="var(--primary)"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <h2 className="mb-3 font-display text-lg font-semibold">
              Desempenho por operador
            </h2>
            {!metrics.byOperator.length ? (
              <p className="text-sm text-muted-foreground">
                Sem vendas registradas.
              </p>
            ) : (
              <>
                <div className="mb-4 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.byOperator} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis type="number" fontSize={11} />
                      <YAxis
                        type="category"
                        dataKey="email"
                        width={160}
                        fontSize={11}
                      />
                      <Tooltip
                        formatter={(v: number) => formatPriceBRL(v)}
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                        }}
                      />
                      <Bar
                        dataKey="revenue"
                        name="Receita"
                        fill="var(--primary)"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operador</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Fotos</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.byOperator.map((o) => (
                      <TableRow key={o.operatorId}>
                        <TableCell className="font-medium">{o.email}</TableCell>
                        <TableCell className="text-right">{o.sales}</TableCell>
                        <TableCell className="text-right">{o.photos}</TableCell>
                        <TableCell className="text-right font-display font-bold">
                          {formatPriceBRL(o.revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </Card>
        </>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-border p-5">
          <h2 className="font-display text-lg font-semibold">
            Histórico de vendas
          </h2>
          <p className="text-xs text-muted-foreground">
            Últimas 100 transações registradas.
          </p>
        </div>
        {loadingSales ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !sales?.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma venda registrada ainda.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Fotos</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {new Date(s.createdAt).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="font-medium">
                    {s.customerName}
                  </TableCell>
                  <TableCell>{s.customerPhone}</TableCell>
                  <TableCell className="text-right">{s.photoCount}</TableCell>
                  <TableCell className="text-right font-display font-bold">
                    {formatPriceBRL(s.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-sunset text-primary-foreground shadow-glow">
          {icon}
        </div>
      </div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
      {hint ? (
        <div className="text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </Card>
  );
}
