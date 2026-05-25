import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLatestPhotos } from "@/lib/photos.functions";
import { Button } from "@/components/ui/button";
import { Sparkles, ShieldCheck, Download } from "lucide-react";
import { formatPriceBRL } from "@/lib/photo-utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ParkSnap — Suas memórias do parque em um clique" },
      {
        name: "description",
        content:
          "Encontre, compre e baixe as fotos das atrações do parque temático em segundos.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const fetchLatest = useServerFn(listLatestPhotos);
  const { data: photos } = useQuery({
    queryKey: ["latest-photos"],
    queryFn: () => fetchLatest(),
  });

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-16 md:py-24">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-sunset opacity-10" />
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Memórias inesquecíveis, prontas em segundos
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Suas fotos do parque,{" "}
            <span className="text-gradient-sunset">do jeito que aconteceu.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            Fotografamos você nas atrações. Você escolhe quais quer levar,
            paga com o operador e baixa todas em alta resolução.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-sunset shadow-glow">
              <Link to="/login-cliente">Já comprei — entrar</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login-operador">Sou operador</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-12">
        <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
          {[
            {
              icon: ShieldCheck,
              title: "Suas fotos, protegidas",
              text: "Acesso só com seu telefone e senha. Sem compartilhamento.",
            },
            {
              icon: Download,
              title: "Download em alta",
              text: "Baixe individualmente ou todas de uma vez em um único arquivo.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-soft"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-sunset">
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Latest photos carousel */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold md:text-3xl">
                Últimas fotos
              </h2>
              <p className="text-sm text-muted-foreground">
                As 30 capturas mais recentes do parque.
              </p>
            </div>
          </div>
          {!photos?.length ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
              Ainda não há fotos por aqui. Volte em breve!
            </div>
          ) : (
            <div className="overflow-hidden">
              <div className="flex w-max gap-3 animate-marquee">
                {[...photos, ...photos].map((p, i) => (
                  <figure
                    key={`${p.id}-${i}`}
                    className="group relative h-56 w-72 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted shadow-soft"
                  >
                    <img
                      src={p.url}
                      alt="Foto do parque"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <figcaption className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-xs font-medium text-white">
                      {formatPriceBRL(p.price)}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
