-- 1) Lock down SECURITY DEFINER helpers: revoke broad EXECUTE, keep only what RLS needs
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role_in_tenant(uuid, public.app_role, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_tenant_ids(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auto_delete_old_available_photos() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role_in_tenant(uuid, public.app_role, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auto_delete_old_available_photos() TO service_role;

-- 2) Storage RLS: lock down the private 'photos' bucket
-- All client downloads use signed URLs generated server-side via service role.
-- Operators may access files in their tenant folder (slug-prefixed path).

DROP POLICY IF EXISTS "Operators read tenant photo files" ON storage.objects;
DROP POLICY IF EXISTS "Operators upload tenant photo files" ON storage.objects;
DROP POLICY IF EXISTS "Operators update tenant photo files" ON storage.objects;
DROP POLICY IF EXISTS "Operators delete tenant photo files" ON storage.objects;
DROP POLICY IF EXISTS "Super admin manages photo files" ON storage.objects;

CREATE POLICY "Operators read tenant photo files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'photos'
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    JOIN public.user_roles ur ON ur.tenant_id = t.id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'operator'::public.app_role
      AND t.slug = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Operators upload tenant photo files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    JOIN public.user_roles ur ON ur.tenant_id = t.id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'operator'::public.app_role
      AND t.slug = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Operators update tenant photo files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos'
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    JOIN public.user_roles ur ON ur.tenant_id = t.id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'operator'::public.app_role
      AND t.slug = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Operators delete tenant photo files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'
  AND EXISTS (
    SELECT 1
    FROM public.tenants t
    JOIN public.user_roles ur ON ur.tenant_id = t.id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'operator'::public.app_role
      AND t.slug = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Super admin manages photo files"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'photos' AND public.is_super_admin(auth.uid()))
WITH CHECK (bucket_id = 'photos' AND public.is_super_admin(auth.uid()));
