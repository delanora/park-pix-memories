
CREATE TABLE public.site_settings (
  id boolean PRIMARY KEY DEFAULT true,
  site_name text NOT NULL DEFAULT 'ParkSnap',
  site_tagline text NOT NULL DEFAULT 'Parque Temático',
  meta_title text NOT NULL DEFAULT 'ParkSnap — Suas memórias do parque em um clique',
  meta_description text NOT NULL DEFAULT 'Encontre, compre e baixe as fotos das atrações do parque temático em segundos.',
  hero_badge text NOT NULL DEFAULT 'Memórias inesquecíveis, prontas em segundos',
  hero_title_1 text NOT NULL DEFAULT 'Suas fotos do parque,',
  hero_title_2 text NOT NULL DEFAULT 'do jeito que aconteceu.',
  hero_subtitle text NOT NULL DEFAULT 'Fotografamos você nas atrações. Você escolhe quais quer levar, paga com o operador e baixa todas em alta resolução.',
  cta_customer text NOT NULL DEFAULT 'Já comprei — entrar',
  cta_operator text NOT NULL DEFAULT 'Sou operador',
  feature_1_title text NOT NULL DEFAULT 'Suas fotos, protegidas',
  feature_1_text text NOT NULL DEFAULT 'Acesso só com seu telefone e senha. Sem compartilhamento.',
  feature_2_title text NOT NULL DEFAULT 'Download em alta',
  feature_2_text text NOT NULL DEFAULT 'Baixe individualmente ou todas de uma vez em um único arquivo.',
  latest_title text NOT NULL DEFAULT 'Últimas fotos',
  latest_subtitle text NOT NULL DEFAULT 'As 30 capturas mais recentes do parque.',
  primary_color text NOT NULL DEFAULT 'oklch(0.7 0.19 35)',
  secondary_color text NOT NULL DEFAULT 'oklch(0.55 0.2 285)',
  accent_color text NOT NULL DEFAULT 'oklch(0.65 0.22 0)',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_singleton CHECK (id = true)
);

GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Operators update settings" ON public.site_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'operator')) WITH CHECK (public.has_role(auth.uid(), 'operator'));
CREATE POLICY "Operators insert settings" ON public.site_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'operator'));

INSERT INTO public.site_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
