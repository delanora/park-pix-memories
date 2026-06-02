
-- photos
CREATE POLICY "Operators insert photos in their tenant"
ON public.photos FOR INSERT TO authenticated
WITH CHECK (has_role_in_tenant(auth.uid(), 'operator'::app_role, tenant_id));

CREATE POLICY "Operators update photos in their tenant"
ON public.photos FOR UPDATE TO authenticated
USING (has_role_in_tenant(auth.uid(), 'operator'::app_role, tenant_id))
WITH CHECK (has_role_in_tenant(auth.uid(), 'operator'::app_role, tenant_id));

-- sales
CREATE POLICY "Operators insert sales in their tenant"
ON public.sales FOR INSERT TO authenticated
WITH CHECK (has_role_in_tenant(auth.uid(), 'operator'::app_role, tenant_id));

CREATE POLICY "Operators update sales in their tenant"
ON public.sales FOR UPDATE TO authenticated
USING (has_role_in_tenant(auth.uid(), 'operator'::app_role, tenant_id))
WITH CHECK (has_role_in_tenant(auth.uid(), 'operator'::app_role, tenant_id));

-- sale_items
CREATE POLICY "Operators insert sale items in their tenant"
ON public.sale_items FOR INSERT TO authenticated
WITH CHECK (has_role_in_tenant(auth.uid(), 'operator'::app_role, tenant_id));

-- user_roles
CREATE POLICY "Super admin inserts roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admin updates roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admin deletes roles"
ON public.user_roles FOR DELETE TO authenticated
USING (is_super_admin(auth.uid()));

-- customer_profiles
CREATE POLICY "Users insert own customer profile"
ON public.customer_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own customer profile"
ON public.customer_profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
