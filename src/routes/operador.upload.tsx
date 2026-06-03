import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { uploadPhoto } from "@/lib/photos.functions";
import { RequireRole } from "@/components/require-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Upload as UploadIcon, X } from "lucide-react";

export const Route = createFileRoute("/operador/upload")({
  head: () => ({ meta: [{ title: "Enviar fotos | ParkSnap" }] }),
  component: () => (
    <RequireRole role="operator">
      <UploadPage />
    </RequireRole>
  ),
});

type Item = { file: File; previewUrl: string };

function UploadPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const uploadFn = useServerFn(uploadPhoto);
  const [items, setItems] = useState<Item[]>([]);
  const [price, setPrice] = useState("15");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: Item[] = Array.from(files).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setItems((prev) => [...prev, ...next]);
  }

  function removeAt(idx: number) {
    setItems((prev) => {
      const it = prev[idx];
      if (it) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    setBusy(true);
    setProgress({ done: 0, total: items.length });
    let success = 0;
    const failed: string[] = [];
    try {
      for (let i = 0; i < items.length; i++) {
        const { file } = items[i];
        try {
          const buf = await file.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = "";
          for (let j = 0; j < bytes.byteLength; j++)
            binary += String.fromCharCode(bytes[j]);
          const base64 = btoa(binary);
          await uploadFn({
            data: {
              fileName: file.name,
              contentType: file.type || "image/jpeg",
              base64,
              price: Number(price) || 0,
            },
          });
          success++;
        } catch (err: any) {
          failed.push(`${file.name}: ${err?.message ?? "falha"}`);
        }
        setProgress({ done: i + 1, total: items.length });
      }

      if (success > 0) {
        toast.success(
          success === 1
            ? "Foto enviada para a galeria!"
            : `${success} fotos enviadas para a galeria!`,
        );
      }
      if (failed.length > 0) {
        toast.error(`Falha em ${failed.length} envio(s)`);
      }

      qc.invalidateQueries({ queryKey: ["gallery"] });
      qc.invalidateQueries({ queryKey: ["operator-stats"] });
      qc.invalidateQueries({ queryKey: ["latest-photos"] });

      if (failed.length === 0) {
        items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
        setItems([]);
        navigate({ to: "/operador/galeria" });
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Enviar novas fotos</h1>
        <p className="text-sm text-muted-foreground">
          Suba uma ou várias imagens de uma vez. Defina o valor de venda aplicado a todas.
        </p>
      </div>
      <form
        onSubmit={onSubmit}
        className="grid max-w-5xl gap-6 rounded-3xl border border-border bg-card p-6 shadow-soft md:grid-cols-2"
      >
        <div className="space-y-3">
          <Label htmlFor="file">Imagens</Label>
          <label
            htmlFor="file"
            className="flex min-h-40 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/40 p-4 text-center transition hover:border-primary"
          >
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <UploadIcon className="h-8 w-8" />
              <span className="text-sm">
                Clique para escolher uma ou mais fotos
              </span>
            </div>
          </label>
          <Input
            id="file"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files);
              e.target.value = "";
            }}
          />
          {items.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border"
                >
                  <img
                    src={it.previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeAt(idx)}
                    className="absolute right-1 top-1 rounded-full bg-background/90 p-1 opacity-0 transition group-hover:opacity-100"
                    aria-label="Remover"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="price">Valor de venda (R$)</Label>
            <Input
              id="price"
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              O valor é aplicado a todas as fotos enviadas. Fotos não vendidas são removidas automaticamente após 30 fotos novas ou 30 dias.
            </p>
          </div>
          {progress && (
            <p className="text-sm text-muted-foreground">
              Enviando {progress.done} de {progress.total}…
            </p>
          )}
          <Button
            type="submit"
            disabled={items.length === 0 || busy}
            className="w-full bg-gradient-sunset shadow-glow"
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadIcon className="mr-2 h-4 w-4" />
            )}
            {items.length > 1 ? `Enviar ${items.length} fotos` : "Enviar foto"}
          </Button>
        </div>
      </form>
    </div>
  );
}
