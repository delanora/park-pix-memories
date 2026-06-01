import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Settings as SettingsIcon, Save, Loader2 } from "lucide-react";
import {
  getMySettings,
  updateSiteSettings,
  SETTINGS_DEFAULTS,
  type SiteSettings,
} from "@/lib/settings.functions";
import { RequireRole } from "@/components/require-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/operador/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — ParkSnap" }] }),
  component: () => (
    <RequireRole role="operator" fullOperator>
      <SettingsPage />
    </RequireRole>
  ),
});

function Field({
  label,
  value,
  onChange,
  textarea,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {textarea ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
      ) : (
        <Input
          type={type ?? "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <div
          className="h-9 w-9 shrink-0 rounded-md border border-border"
          style={{ background: value }}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="oklch(0.7 0.19 35) ou #ff5722"
        />
      </div>
    </div>
  );
}

function SettingsPage() {
  const fetchFn = useServerFn(getMySettings);
  const updateFn = useServerFn(updateSiteSettings);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["my-settings"],
    queryFn: () => fetchFn(),
  });

  const [form, setForm] = useState<SiteSettings>(SETTINGS_DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const set = <K extends keyof SiteSettings>(k: K) => (v: SiteSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSave = async () => {
    setSaving(true);
    try {
      await updateFn({ data: form });
      await qc.invalidateQueries({ queryKey: ["my-settings"] });
      await qc.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Configurações salvas");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-sunset shadow-glow">
            <SettingsIcon className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Configurações</h1>
            <p className="text-sm text-muted-foreground">
              Personalize identidade visual e textos do estabelecimento.
            </p>
          </div>
        </div>
        <Button onClick={onSave} disabled={saving} className="bg-gradient-sunset shadow-glow">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>

      <Tabs defaultValue="brand">
        <TabsList>
          <TabsTrigger value="brand">Marca</TabsTrigger>
          <TabsTrigger value="colors">Cores</TabsTrigger>
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="content">Conteúdo</TabsTrigger>
        </TabsList>

        <TabsContent value="brand" className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <Field label="Nome do estabelecimento" value={form.siteName} onChange={set("siteName")} />
          <Field label="Subtítulo (sob o logo)" value={form.siteTagline} onChange={set("siteTagline")} />
          <Field label="Título da aba do navegador" value={form.metaTitle} onChange={set("metaTitle")} />
          <Field label="Descrição (SEO)" value={form.metaDescription} onChange={set("metaDescription")} textarea />
        </TabsContent>

        <TabsContent value="colors" className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <p className="text-xs text-muted-foreground">
            Aceita qualquer cor CSS: <code>oklch(...)</code>, <code>#ff5722</code>, <code>rgb(...)</code>, etc.
          </p>
          <ColorField label="Cor primária" value={form.primaryColor} onChange={set("primaryColor")} />
          <ColorField label="Cor secundária" value={form.secondaryColor} onChange={set("secondaryColor")} />
          <ColorField label="Cor de destaque" value={form.accentColor} onChange={set("accentColor")} />
          <div className="my-3 border-t border-border" />
          <p className="text-xs font-medium text-muted-foreground">Cores de fundo</p>
          <ColorField label="Fundo da página" value={form.backgroundColor} onChange={set("backgroundColor")} />
          <ColorField label="Fundo dos cards" value={form.cardBackgroundColor} onChange={set("cardBackgroundColor")} />
          <ColorField label="Fundo muted" value={form.mutedBackgroundColor} onChange={set("mutedBackgroundColor")} />
          <ColorField label="Cor do texto" value={form.foregroundColor} onChange={set("foregroundColor")} />
        </TabsContent>

        <TabsContent value="hero" className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <Field label="Badge (topo do hero)" value={form.heroBadge} onChange={set("heroBadge")} />
          <Field label="Título — primeira parte" value={form.heroTitle1} onChange={set("heroTitle1")} />
          <Field label="Título — segunda parte (com gradiente)" value={form.heroTitle2} onChange={set("heroTitle2")} />
          <Field label="Subtítulo" value={form.heroSubtitle} onChange={set("heroSubtitle")} textarea />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Botão: cliente" value={form.ctaCustomer} onChange={set("ctaCustomer")} />
            <Field label="Botão: operador" value={form.ctaOperator} onChange={set("ctaOperator")} />
          </div>
        </TabsContent>

        <TabsContent value="content" className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Card 1 — título" value={form.feature1Title} onChange={set("feature1Title")} />
            <Field label="Card 1 — texto" value={form.feature1Text} onChange={set("feature1Text")} textarea />
            <Field label="Card 2 — título" value={form.feature2Title} onChange={set("feature2Title")} />
            <Field label="Card 2 — texto" value={form.feature2Text} onChange={set("feature2Text")} textarea />
          </div>
          <Field label="Galeria — título" value={form.latestTitle} onChange={set("latestTitle")} />
          <Field label="Galeria — subtítulo" value={form.latestSubtitle} onChange={set("latestSubtitle")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
