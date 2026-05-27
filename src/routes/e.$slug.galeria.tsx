import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyPhotos, getDownloadUrl } from "@/lib/photos.functions";
import { RequireRole } from "@/components/require-role";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FolderDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import JSZip from "jszip";

export const Route = createFileRoute("/e/$slug/galeria")({
  component: () => (
    <RequireRole role="customer">
      <CustomerGallery />
    </RequireRole>
  ),
});

function CustomerGallery() {
  const listFn = useServerFn(listMyPhotos);
  const dlFn = useServerFn(getDownloadUrl);
  const { data, isLoading } = useQuery({
    queryKey: ["my-photos"],
    queryFn: () => listFn(),
  });
  const [bulk, setBulk] = useState(false);

  async function downloadOne(photoId: string) {
    try {
      const { url } = await dlFn({ data: { photoId } });
      const res = await fetch(url);
      const blob = await res.blob();
      triggerDownload(blob, `foto-${photoId}.jpg`);
    } catch (err: any) {
      toast.error(err.message ?? "Falha no download");
    }
  }

  async function downloadAll() {
    if (!data?.length) return;
    setBulk(true);
    try {
      const zip = new JSZip();
      for (const p of data) {
        const { url } = await dlFn({ data: { photoId: p.id } });
        const res = await fetch(url);
        zip.file(`foto-${p.id}.jpg`, await res.arrayBuffer());
      }
      const blob = await zip.generateAsync({ type: "blob" });
      triggerDownload(blob, "minhas-fotos.zip");
      toast.success("Download iniciado!");
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao gerar o pacote");
    } finally {
      setBulk(false);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Minhas fotos</h1>
          <p className="text-sm text-muted-foreground">
            Todas as fotos que você adquiriu.
          </p>
        </div>
        <Button
          onClick={downloadAll}
          disabled={!data?.length || bulk}
          className="bg-gradient-sunset shadow-glow"
        >
          {bulk ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FolderDown className="mr-2 h-4 w-4" />
          )}
          Baixar todas (.zip)
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
          Você ainda não tem fotos liberadas. Procure um operador.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((p) => (
            <div
              key={p.id}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted shadow-soft"
            >
              <img
                src={p.url}
                alt=""
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                <Button
                  size="sm"
                  onClick={() => downloadOne(p.id)}
                  className="bg-white text-foreground hover:bg-white/90"
                >
                  <Download className="mr-1 h-3.5 w-3.5" />
                  Baixar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
