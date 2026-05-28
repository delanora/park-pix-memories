import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Camera, LogIn } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "ParkSnap — Fotografia para parques" }] }),
  component: Landing,
});

function Landing() {
  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden px-6 py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-sunset opacity-10" />
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <Camera className="h-3.5 w-3.5 text-primary" />
            Plataforma SaaS de fotografia para parques temáticos
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Sua memória, <span className="text-gradient-sunset">do parque ao bolso</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            O ParkSnap conecta cada empresa cliente a seus visitantes com galeria
            personalizada, venda no balcão e download em alta resolução.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">
            Cliente do parque? Acesse pela URL fornecida pela empresa:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">/e/&lt;empresa&gt;</code>
          </p>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto max-w-md">
          <Link
            to="/login-operador"
            className="group block rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:border-primary/40"
          >
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-sunset">
              <LogIn className="h-5 w-5 text-primary-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold">Sou operador</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Acessar o painel da minha empresa — galeria, vendas e configurações.
            </p>
            <Button className="mt-4 bg-gradient-sunset shadow-glow">
              Entrar
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

