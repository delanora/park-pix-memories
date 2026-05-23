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
import { Loader2, Upload as UploadIcon } from "lucide-react";

export const Route = createFileRoute("/operador/upload")({
  head: () => ({ meta: [{ title: "Enviar foto | ParkSnap" }] }),
  component: () => (
    <RequireRole role="operator">
      <UploadPage />
    </RequireRole>
  ),
});

function UploadPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const uploadFn = useServerFn(uploadPhoto);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [price, setPrice] = useState("15");
  const [busy, setBusy] = useState(false);

  function onPick(f: File | null) {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++)
        binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      await uploadFn({
        data: {
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          base64,
          price: Number(price) || 0,
        },
      });
      toast.success("Foto enviada para a galeria!");
      qc.invalidateQueries({ queryKey: ["gallery"] });
      qc.invalidateQueries({ queryKey: ["operator-stats"] });
      qc.invalidateQueries({ queryKey: ["latest-photos"] });
      navigate({ to: "/operador/galeria" });
    } catch (err: any) {
      toast.error(err.message ?? "Falha no envio");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Enviar nova foto</h1>
        <p className="text-sm text-muted-foreground">
          Suba a imagem capturada na atração. Defina o valor de venda.
        </p>
      </div>
      <form
        onSubmit={onSubmit}
        className="grid max-w-4xl gap-6 rounded-3xl border border-border bg-card p-6 shadow-soft md:grid-cols-2"
      >
        <div className="space-y-3">
          <Label htmlFor="file">Imagem</Label>
          <label
            htmlFor="file"
            className="flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/40 text-center transition hover:border-primary"
          >
            {preview ? (
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 p-6 text-muted-foreground">
                <UploadIcon className="h-8 w-8" />
                <span className="text-sm">Clique para escolher a foto</span>
              </div>
            )}
          </label>
          <Input
            id="file"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
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
              Fotos não vendidas são removidas automaticamente após 30 fotos novas
              ou 30 dias.
            </p>
          </div>
          <Button
            type="submit"
            disabled={!file || busy}
            className="w-full bg-gradient-sunset shadow-glow"
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadIcon className="mr-2 h-4 w-4" />
            )}
            Enviar foto
          </Button>
        </div>
      </form>
    </div>
  );
}
