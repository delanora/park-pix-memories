ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS cnpj TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS tenants_cnpj_unique ON public.tenants (cnpj) WHERE cnpj IS NOT NULL;