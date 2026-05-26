import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SiteSettings = {
  siteName: string;
  siteTagline: string;
  metaTitle: string;
  metaDescription: string;
  heroBadge: string;
  heroTitle1: string;
  heroTitle2: string;
  heroSubtitle: string;
  ctaCustomer: string;
  ctaOperator: string;
  feature1Title: string;
  feature1Text: string;
  feature2Title: string;
  feature2Text: string;
  latestTitle: string;
  latestSubtitle: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

const DEFAULTS: SiteSettings = {
  siteName: "ParkSnap",
  siteTagline: "Parque Temático",
  metaTitle: "ParkSnap — Suas memórias do parque em um clique",
  metaDescription:
    "Encontre, compre e baixe as fotos das atrações do parque temático em segundos.",
  heroBadge: "Memórias inesquecíveis, prontas em segundos",
  heroTitle1: "Suas fotos do parque,",
  heroTitle2: "do jeito que aconteceu.",
  heroSubtitle:
    "Fotografamos você nas atrações. Você escolhe quais quer levar, paga com o operador e baixa todas em alta resolução.",
  ctaCustomer: "Já comprei — entrar",
  ctaOperator: "Sou operador",
  feature1Title: "Suas fotos, protegidas",
  feature1Text: "Acesso só com seu telefone e senha. Sem compartilhamento.",
  feature2Title: "Download em alta",
  feature2Text: "Baixe individualmente ou todas de uma vez em um único arquivo.",
  latestTitle: "Últimas fotos",
  latestSubtitle: "As 30 capturas mais recentes do parque.",
  primaryColor: "oklch(0.7 0.19 35)",
  secondaryColor: "oklch(0.55 0.2 285)",
  accentColor: "oklch(0.65 0.22 0)",
};

function rowToDTO(row: any): SiteSettings {
  if (!row) return DEFAULTS;
  return {
    siteName: row.site_name,
    siteTagline: row.site_tagline,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    heroBadge: row.hero_badge,
    heroTitle1: row.hero_title_1,
    heroTitle2: row.hero_title_2,
    heroSubtitle: row.hero_subtitle,
    ctaCustomer: row.cta_customer,
    ctaOperator: row.cta_operator,
    feature1Title: row.feature_1_title,
    feature1Text: row.feature_1_text,
    feature2Title: row.feature_2_title,
    feature2Text: row.feature_2_text,
    latestTitle: row.latest_title,
    latestSubtitle: row.latest_subtitle,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
  };
}

export const getSiteSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<SiteSettings> => {
    const { data } = await supabaseAdmin
      .from("site_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    return rowToDTO(data);
  },
);

const UpdateSchema = z.object({
  siteName: z.string().min(1).max(80),
  siteTagline: z.string().min(1).max(80),
  metaTitle: z.string().min(1).max(160),
  metaDescription: z.string().min(1).max(300),
  heroBadge: z.string().min(1).max(160),
  heroTitle1: z.string().min(1).max(160),
  heroTitle2: z.string().min(1).max(160),
  heroSubtitle: z.string().min(1).max(400),
  ctaCustomer: z.string().min(1).max(60),
  ctaOperator: z.string().min(1).max(60),
  feature1Title: z.string().min(1).max(80),
  feature1Text: z.string().min(1).max(240),
  feature2Title: z.string().min(1).max(80),
  feature2Text: z.string().min(1).max(240),
  latestTitle: z.string().min(1).max(80),
  latestSubtitle: z.string().min(1).max(240),
  primaryColor: z.string().min(3).max(80),
  secondaryColor: z.string().min(3).max(80),
  accentColor: z.string().min(3).max(80),
});

export const updateSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: op } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "operator")
      .maybeSingle();
    if (!op) throw new Error("Acesso negado");

    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({
        id: true,
        site_name: data.siteName,
        site_tagline: data.siteTagline,
        meta_title: data.metaTitle,
        meta_description: data.metaDescription,
        hero_badge: data.heroBadge,
        hero_title_1: data.heroTitle1,
        hero_title_2: data.heroTitle2,
        hero_subtitle: data.heroSubtitle,
        cta_customer: data.ctaCustomer,
        cta_operator: data.ctaOperator,
        feature_1_title: data.feature1Title,
        feature_1_text: data.feature1Text,
        feature_2_title: data.feature2Title,
        feature_2_text: data.feature2Text,
        latest_title: data.latestTitle,
        latest_subtitle: data.latestSubtitle,
        primary_color: data.primaryColor,
        secondary_color: data.secondaryColor,
        accent_color: data.accentColor,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export { DEFAULTS as SETTINGS_DEFAULTS };
