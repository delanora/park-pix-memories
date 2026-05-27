import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLatestPhotosBySlug } from "@/lib/photos.functions";
import { Button } from "@/components/ui/button";
import { Sparkles, ShieldCheck, Download } from "lucide-react";
import { formatPriceBRL } from "@/lib/photo-utils";
import { useSettings } from "@/lib/settings-context";

export const Route = createFileRoute("/e/$slug/")({
  component: TenantLanding,
});

function TenantLanding() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const fetchLatest = useServerFn(listLatestPhotosBySlug);
  const { data: photos } = useQuery({
    queryKey: ["latest-photos", slug],
    queryFn: () => fetchLatest({ data: { slug } }),
  });
  const s = useSettings();

  const features = [
    { icon: ShieldCheck, title: s.feature1Title, text: s.feature1Text },
    { icon: Download, title: s.feature2Title, text: s.feature2Text },
  ];

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden px-6 py-16 md:py-24">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-sunset opacity-10" />
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {s.heroBadge}
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            {s.heroTitle1}{" "}
            <span className="text-gradient-sunset">{s.heroTitle2}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            {s.heroSubtitle}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-sunset shadow-glow">
              <Link to="/e/$slug/login" params={{ slug }}>{s.ctaCustomer}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="px-6 pb-12">
        <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
          {features.map((f) => (
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

      <section className="px-6 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5">
            <h2 className="font-display text-2xl font-bold md:text-3xl">{s.latestTitle}</h2>
            <p className="text-sm text-muted-foreground">{s.latestSubtitle}</p>
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
