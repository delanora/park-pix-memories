import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Camera, LogIn, Upload, ShoppingCart, Download, Palette, BarChart3, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "ParkSnap — Fotografia para parques" }] }),
  component: Landing,
});

function Landing() {
  const features = [
    {
      icon: Upload,
      title: "Upload rápido",
      text: "Envie fotos em lote diretamente do evento com organização automática por data.",
    },
    {
      icon: ShoppingCart,
      title: "Venda no balcão",
      text: "Registre vendas físicas com código da foto e acompanhe o faturamento em tempo real.",
    },
    {
      icon: Download,
      title: "Download em alta",
      text: "Clientes baixam fotos em resolução original com watermark removido automaticamente.",
    },
    {
      icon: Palette,
      title: "Galeria personalizada",
      text: "Cada empresa tem sua própria landing page com cores, textos e identidade visual.",
    },
    {
      icon: BarChart3,
      title: "Painel de métricas",
      text: "Acompanhe fotos disponíveis, vendidas, clientes ativos e receita de forma clara.",
    },
    {
      icon: ShieldCheck,
      title: "Isolamento por empresa",
      text: "Dados 100% separados entre tenants. Segurança e privacidade garantidas.",
    },
  ];

  const steps = [
    { num: "1", title: "Fotografe", text: "Capture os melhores momentos do parque ou evento." },
    { num: "2", title: "Envie", text: "Faça upload das fotos no painel do operador em segundos." },
    { num: "3", title: "Venda", text: "Clientes acessam a galeria, compram e baixam em alta resolução." },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero */}
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
        </div>
      </section>

      {/* Login card */}
      <section className="px-6 pb-16">
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

      {/* Como funciona */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center font-display text-2xl font-bold md:text-3xl">
            Como funciona
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.num}
                className="relative rounded-2xl border border-border bg-card p-6 text-center shadow-soft"
              >
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-sunset text-sm font-bold text-primary-foreground">
                  {s.num}
                </div>
                <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center font-display text-2xl font-bold md:text-3xl">
            Tudo que você precisa
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:border-primary/30"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-sunset">
                  <f.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="font-display text-base font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card p-8 text-center shadow-soft md:p-12">
          <h2 className="font-display text-2xl font-bold md:text-3xl">
            Pronto para começar?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground md:text-base">
            Entre no painel do operador para gerenciar fotos, vendas e clientes da sua empresa.
          </p>
          <Button asChild size="lg" className="mt-6 bg-gradient-sunset shadow-glow">
            <Link to="/login-operador">Acessar painel</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}


