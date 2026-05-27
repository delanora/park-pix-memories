
-- ============================================================
-- MULTI-TENANT MIGRATION
-- ============================================================

-- 1. Tenants table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenants_slug ON public.tenants(slug);

GRANT SELECT ON public.tenants TO anon, authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 2. Super admins table (separate from app_role enum to avoid ALTER TYPE in transaction)
CREATE TABLE public.super_admins (
  user_id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.super_admins TO authenticated;
GRANT ALL ON public.super_admins TO service_role;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = _user_id)
$$;

-- 3. Seed default tenant (carries forward all existing data)
INSERT INTO public.tenants (id, slug, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'default', 'Empresa Padrão');

-- 4. Add tenant_id columns (nullable first, backfill, then NOT NULL)
ALTER TABLE public.user_roles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.photos ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.sales ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.sale_items ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.customer_profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

UPDATE public.user_roles SET tenant_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.photos SET tenant_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.sales SET tenant_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.sale_items SET tenant_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.customer_profiles SET tenant_id = '00000000-0000-0000-0000-000000000001';

ALTER TABLE public.user_roles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.photos ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.sales ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.sale_items ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.customer_profiles ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX idx_user_roles_tenant ON public.user_roles(tenant_id);
CREATE INDEX idx_photos_tenant_seq ON public.photos(tenant_id, sequence_number DESC);
CREATE INDEX idx_sales_tenant ON public.sales(tenant_id, created_at DESC);
CREATE INDEX idx_sale_items_tenant ON public.sale_items(tenant_id);
CREATE INDEX idx_customer_profiles_tenant ON public.customer_profiles(tenant_id);

-- 5. customer_profiles: drop global phone unique, add (tenant_id, phone) unique
ALTER TABLE public.customer_profiles DROP CONSTRAINT IF EXISTS customer_profiles_phone_key;
ALTER TABLE public.customer_profiles ADD CONSTRAINT customer_profiles_tenant_phone_key UNIQUE (tenant_id, phone);

-- 6. site_settings → per-tenant
ALTER TABLE public.site_settings DROP CONSTRAINT site_settings_pkey;
ALTER TABLE public.site_settings ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public.site_settings SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.site_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.site_settings ADD PRIMARY KEY (tenant_id);
ALTER TABLE public.site_settings DROP COLUMN id;

-- 7. New helper functions
CREATE OR REPLACE FUNCTION public.has_role_in_tenant(_user_id UUID, _role app_role, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND tenant_id = _tenant_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_my_tenant_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tenant_id FROM public.user_roles WHERE user_id = _user_id
$$;

-- 8. Rewrite RLS policies
-- tenants
CREATE POLICY "Anyone reads tenants" ON public.tenants FOR SELECT USING (true);
CREATE POLICY "Super admin manages tenants" ON public.tenants FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- super_admins
CREATE POLICY "Super admins see selves" ON public.super_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- user_roles
DROP POLICY IF EXISTS "Operators see all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users see own roles" ON public.user_roles;
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Operators see roles in their tenant" ON public.user_roles FOR SELECT
  USING (public.has_role_in_tenant(auth.uid(), 'operator'::app_role, tenant_id));
CREATE POLICY "Super admin sees all roles" ON public.user_roles FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- photos
DROP POLICY IF EXISTS "Customers see purchased photos" ON public.photos;
DROP POLICY IF EXISTS "Operators see all photos" ON public.photos;
CREATE POLICY "Operators see photos in their tenant" ON public.photos FOR SELECT
  USING (public.has_role_in_tenant(auth.uid(), 'operator'::app_role, tenant_id));
CREATE POLICY "Customers see purchased photos" ON public.photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE si.photo_id = photos.id AND s.customer_id = auth.uid()
  ));
CREATE POLICY "Super admin sees all photos" ON public.photos FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- sales
DROP POLICY IF EXISTS "Customers see own sales" ON public.sales;
DROP POLICY IF EXISTS "Operators see all sales" ON public.sales;
CREATE POLICY "Customers see own sales" ON public.sales FOR SELECT
  USING (auth.uid() = customer_id);
CREATE POLICY "Operators see sales in their tenant" ON public.sales FOR SELECT
  USING (public.has_role_in_tenant(auth.uid(), 'operator'::app_role, tenant_id));
CREATE POLICY "Super admin sees all sales" ON public.sales FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- sale_items
DROP POLICY IF EXISTS "Customers see own sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Operators see all sale items" ON public.sale_items;
CREATE POLICY "Customers see own sale items" ON public.sale_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_items.sale_id AND s.customer_id = auth.uid()));
CREATE POLICY "Operators see sale items in tenant" ON public.sale_items FOR SELECT
  USING (public.has_role_in_tenant(auth.uid(), 'operator'::app_role, tenant_id));
CREATE POLICY "Super admin sees all sale items" ON public.sale_items FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- customer_profiles
DROP POLICY IF EXISTS "Customer sees own profile" ON public.customer_profiles;
DROP POLICY IF EXISTS "Operators see all customer profiles" ON public.customer_profiles;
CREATE POLICY "Customer sees own profile" ON public.customer_profiles FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Operators see customers in tenant" ON public.customer_profiles FOR SELECT
  USING (public.has_role_in_tenant(auth.uid(), 'operator'::app_role, tenant_id));
CREATE POLICY "Super admin sees all customers" ON public.customer_profiles FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- site_settings: public read (needed for landing page), tenant operator writes, super admin writes
DROP POLICY IF EXISTS "Anyone reads settings" ON public.site_settings;
DROP POLICY IF EXISTS "Operators insert settings" ON public.site_settings;
DROP POLICY IF EXISTS "Operators update settings" ON public.site_settings;
CREATE POLICY "Anyone reads settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Operators upsert their tenant settings" ON public.site_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role_in_tenant(auth.uid(), 'operator'::app_role, tenant_id));
CREATE POLICY "Operators update their tenant settings" ON public.site_settings FOR UPDATE TO authenticated
  USING (public.has_role_in_tenant(auth.uid(), 'operator'::app_role, tenant_id))
  WITH CHECK (public.has_role_in_tenant(auth.uid(), 'operator'::app_role, tenant_id));
CREATE POLICY "Super admin manages settings" ON public.site_settings FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- 9. Tenant-scoped auto-delete trigger
CREATE OR REPLACE FUNCTION public.auto_delete_old_available_photos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.photos
     SET status = 'deleted', deleted_at = now()
   WHERE status = 'available'
     AND tenant_id = NEW.tenant_id
     AND sequence_number <= NEW.sequence_number - 30;
  RETURN NEW;
END;
$$;
