import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSales } from "@/lib/photos.functions";
import { RequireRole } from "@/components/require-role";
import { formatPriceBRL } from "@/lib/photo-utils";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/operador/vendas")({
  head: () => ({ meta: [{ title: "Vendas | ParkSnap" }] }),
  component: () => (
    <RequireRole role="operator">
      <SalesPage />
    </RequireRole>
  ),
});

function SalesPage() {
  const fn = useServerFn(listSales);
  const { data, isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: () => fn(),
  });

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Vendas</h1>
        <p className="text-sm text-muted-foreground">
          Histórico das vendas registradas.
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card shadow-soft">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.length ? (
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
              {data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {new Date(s.createdAt).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="font-medium">{s.customerName}</TableCell>
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
      </div>
    </div>
  );
}
