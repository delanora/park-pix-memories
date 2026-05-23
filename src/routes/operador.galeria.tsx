import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listGalleryPhotos,
  createCustomerAndSale,
} from "@/lib/photos.functions";
import { RequireRole } from "@/components/require-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatPriceBRL } from "@/lib/photo-utils";
import { toast } from "sonner";
import { Check, Loader2, ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/operador/galeria")({
  head: () => ({ meta: [{ title: "Galeria | ParkSnap" }] }),
  component: () => (
    <RequireRole role="operator">
      <Gallery />
    </RequireRole>
  ),
});

function Gallery() {
  const qc = useQueryClient();
  const listFn = useServerFn(listGalleryPhotos);
  const sellFn = useServerFn(createCustomerAndSale);

  const { data: photos, isLoading } = useQuery({
    queryKey: ["gallery"],
    queryFn: () => listFn(),
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", birthdate: "" });

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const selectedPhotos = (photos ?? []).filter((p) => selected.has(p.id));
  const total = selectedPhotos.reduce((sum, p) => sum + p.price, 0);

  async function handleSell() {
    setSubmitting(true);
    try {
      const res = await sellFn({
        data: {
          fullName: form.fullName,
          phone: form.phone,
          birthdate: form.birthdate,
          photoIds: Array.from(selected),
        },
      });
      toast.success(
        `Venda registrada! Total ${formatPriceBRL(res.total)}. Cliente: ${res.customerPhone}`,
      );
      setSelected(new Set());
      setOpen(false);
      setForm({ fullName: "", phone: "", birthdate: "" });
      qc.invalidateQueries({ queryKey: ["gallery"] });
      qc.invalidateQueries({ queryKey: ["operator-stats"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao registrar a venda");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Galeria</h1>
          <p className="text-sm text-muted-foreground">
            Selecione as fotos do cliente e registre a venda.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              disabled={selected.size === 0}
              className="bg-gradient-sunset shadow-glow"
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Vender imagens ({selected.size}) — {formatPriceBRL(total)}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastro do cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input
                  value={form.fullName}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone (usuário de acesso)</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data de nascimento (senha)</Label>
                <Input
                  type="date"
                  value={form.birthdate}
                  onChange={(e) =>
                    setForm({ ...form, birthdate: e.target.value })
                  }
                />
              </div>
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fotos</span>
                  <span className="font-medium">{selected.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-display text-lg font-bold">
                    {formatPriceBRL(total)}
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleSell}
                disabled={
                  submitting ||
                  !form.fullName ||
                  !form.phone ||
                  !form.birthdate
                }
                className="bg-gradient-sunset shadow-glow"
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Confirmar venda
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !photos?.length ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {photos.map((p) => {
            const on = selected.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`group relative aspect-square overflow-hidden rounded-2xl border bg-muted text-left shadow-soft transition ${
                  on
                    ? "border-primary ring-2 ring-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <img
                  src={p.url}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-2 text-xs text-white">
                  <span className="font-medium">{formatPriceBRL(p.price)}</span>
                  <span>#{p.sequenceNumber}</span>
                </div>
                {on && (
                  <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow">
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
      <p className="text-sm text-muted-foreground">
        Nenhuma foto disponível. Envie fotos pela seção "Enviar foto".
      </p>
    </div>
  );
}
