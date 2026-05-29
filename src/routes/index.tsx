import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Camera, LogIn, Upload, ShoppingCart, Download, Palette, BarChart3, ShieldCheck,
  LayoutDashboard, Images, Receipt, Settings,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listLatestPhotosBySlug } from "@/lib/photos.functions";
import { formatPriceBRL } from "@/lib/photo-utils";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "ParkSnap — Fotografia para parques" }] }),
  component: Home,
});

function Home() {
  const { loading, isOperator, tenantSlug } = useAuth();
  if (loading) return null;
  if (isOperator) return <OperatorHome slug={tenantSlug} />;
  return <Landing />;
}

function OperatorHome({ slug }: { slug: string | null }) {
  const fetchLatest = useServerFn(listLatestPhotosBySlug);
  const { data: photos } = useQuery({
    queryKey: ["operator-home-latest", slug],
    queryFn: () => fetchLatest({ data: { slug: slug! } }),
    enabled: !!slug,
  });

  const menus = [
    { icon: LayoutDashboard, title: "Dashboard", text: "Métricas e visão geral.", to: "/operador" },
    { icon: Images, title: "Galeria", text: "Fotos disponíveis e vendidas.", to: "/operador/galeria" },
    { icon: Receipt, title: "Vendas", text: "Histórico de vendas e clientes.", to: "/operador/vendas" },
    { icon: Settings, title: "Configurações", text: "Personalize sua landing.", to: "/operador/configuracoes" },
  ];

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden px-6 py-12 md:py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-sunset opacity-10" />
        <div className="mx-auto max-w-5xl">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <Camera className="h-3.5 w-3.5 text-primary" />
            Painel do operador
          </div>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-5xl">
            Olá, <span className="text-gradient-sunset">bem-vindo ao ParkSnap</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
            Acesse rapidamente as áreas do seu painel.
          </p>
        </div>
      </section>

      <section className="px-6 pb-6">
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {menus.map((m) => (
            <Link
              key={m.title}
              to={m.to}
              className="group rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:border-primary/40"
            >
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-sunset">
                <m.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-display text-base font-semibold">{m.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{m.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5">
            <h2 className="font-display text-2xl font-bold md:text-3xl">Últimas fotos</h2>
            <p className="text-sm text-muted-foreground">As 30 capturas mais recentes da sua empresa.</p>
          </div>
          {!photos?.length ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
              Ainda não há fotos por aqui. Envie a primeira em Galeria!
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
                      alt="Foto"
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

function Landing() {
  const features = [
    { icon: Upload, title: "Upload rápido", text: "Envie fotos em lote diretamente do evento com organização automática por data." },
    { icon: ShoppingCart, title: "Venda no balcão", text: "Registre vendas físicas com código da foto e acompanhe o faturamento em tempo real." },
    { icon: Download, title: "Download em alta", text: "Clientes baixam fotos em resolução original com watermark removido automaticamente." },
    { icon: Palette, title: "Galeria personalizada", text: "Cada empresa tem sua própria landing page com cores, textos e identidade visual." },
    { icon: BarChart3, title: "Painel de métricas", text: "Acompanhe fotos disponíveis, vendidas, clientes ativos e receita de forma clara." },
    { icon: ShieldCheck, title: "Isolamento por empresa", text: "Dados 100% separados entre tenants. Segurança e privacidade garantidas." },
  ];

  const steps = [
    { num: "1", title: "Fotografe", text: "Capture os melhores momentos do parque ou evento." },
    { num: "2", title: "Envie", text: "Faça upload das fotos no painel do operador em segundos." },
    { num: "3", title: "Venda", text: "Clientes acessam a galeria, compram e baixam em alta resolução." },
  ];

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
        </div>
      </section>

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
            <Button className="mt-4 bg-gradient-sunset shadow-glow">Entrar</Button>
          </Link>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center font-display text-2xl font-bold md:text-3xl">Como funciona</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.num} className="relative rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
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

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center font-display text-2xl font-bold md:text-3xl">Tudo que você precisa</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:border-primary/30">
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

      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card p-8 text-center shadow-soft md:p-12">
          <h2 className="font-display text-2xl font-bold md:text-3xl">Pronto para começar?</h2>
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
