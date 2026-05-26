import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  listGalleryPhotos,
  createCustomerAndSale,
  deletePhoto,
} from "@/lib/photos.functions";
import { ingestLocalPhotos } from "@/lib/photos-inbox.functions";
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
import { Check, FolderDown, Loader2, Play, ShoppingCart, Trash2, X } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const deleteFn = useServerFn(deletePhoto);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: photos, isLoading } = useQuery({
    queryKey: ["gallery"],
    queryFn: () => listFn(),
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", birthdate: "" });
  const [slideshow, setSlideshow] = useState(false);
  const [slideIdx, setSlideIdx] = useState(0);

  const toggle = (id: string, status: string) => {
    if (status === "sold") return;
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  useEffect(() => {
    if (!slideshow || !photos?.length) return;
    const t = setInterval(
      () => setSlideIdx((i) => (i + 1) % photos.length),
      8000,
    );
    return () => clearInterval(t);
  }, [slideshow, photos]);

  useEffect(() => {
    if (!slideshow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSlideshow(false);
      if (e.key === "ArrowRight")
        setSlideIdx((i) => (i + 1) % (photos?.length ?? 1));
      if (e.key === "ArrowLeft")
        setSlideIdx((i) => (i - 1 + (photos?.length ?? 1)) % (photos?.length ?? 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slideshow, photos]);

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

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteFn({ data: { photoId: pendingDelete } });
      toast.success("Foto apagada");
      setSelected((s) => {
        const n = new Set(s);
        n.delete(pendingDelete);
        return n;
      });
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["gallery"] });
      qc.invalidateQueries({ queryKey: ["operator-stats"] });
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao apagar a foto");
    } finally {
      setDeleting(false);
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
        <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={!photos?.length}
          onClick={() => {
            setSlideIdx(0);
            setSlideshow(true);
          }}
        >
          <Play className="mr-2 h-4 w-4" />
          Modo exibição
        </Button>
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
            const sold = p.status === "sold";
            return (
              <div
                key={p.id}
                className={`group relative aspect-square overflow-hidden rounded-2xl border bg-muted text-left shadow-soft transition ${
                  on
                    ? "border-primary ring-2 ring-primary"
                    : "border-border hover:border-primary/50"
                } ${sold ? "opacity-80" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => toggle(p.id, p.status)}
                  disabled={sold}
                  className={`absolute inset-0 z-0 ${sold ? "cursor-not-allowed" : "cursor-pointer"}`}
                  aria-label="Selecionar foto"
                >
                  <img
                    src={p.url}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                </button>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-2 text-xs text-white">
                  <span className="font-medium">{formatPriceBRL(p.price)}</span>
                  <span>#{p.sequenceNumber}</span>
                </div>
                {sold && (
                  <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold uppercase text-white shadow">
                    Vendida
                  </div>
                )}
                {on && (
                  <div className="pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow">
                    <Check className="h-4 w-4" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete(p.id);
                  }}
                  className="absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-destructive/90 text-destructive-foreground opacity-0 shadow transition hover:bg-destructive group-hover:opacity-100 focus:opacity-100"
                  aria-label="Apagar foto"
                  title="Apagar foto"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {slideshow && photos?.length ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <img
            src={photos[slideIdx % photos.length].url}
            alt=""
            className="max-h-full max-w-full object-contain animate-fade-in"
            key={photos[slideIdx % photos.length].id}
          />
          <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1 text-xs text-white">
            {(slideIdx % photos.length) + 1} / {photos.length} - troca a cada 8s - Esc para sair
          </div>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-4 top-4 bg-background/80"
            onClick={() => setSlideshow(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar esta foto?</AlertDialogTitle>
            <AlertDialogDescription>
              A foto será removida do armazenamento. Se já tiver sido vendida,
              o cliente perderá o acesso. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
