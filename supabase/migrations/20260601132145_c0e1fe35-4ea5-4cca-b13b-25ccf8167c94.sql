DROP POLICY IF EXISTS "Operators read tenant photo files" ON storage.objects;
DROP POLICY IF EXISTS "Operators upload tenant photo files" ON storage.objects;
DROP POLICY IF EXISTS "Operators update tenant photo files" ON storage.objects;
DROP POLICY IF EXISTS "Operators delete tenant photo files" ON storage.objects;

CREATE POLICY "Operators read tenant photo files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'photos' AND EXISTS (
    SELECT 1 FROM public.tenants t
    JOIN public.user_roles ur ON ur.tenant_id = t.id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'operator'::public.app_role
      AND t.slug = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Operators upload tenant photo files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'photos' AND EXISTS (
    SELECT 1 FROM public.tenants t
    JOIN public.user_roles ur ON ur.tenant_id = t.id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'operator'::public.app_role
      AND t.slug = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Operators update tenant photo files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'photos' AND EXISTS (
    SELECT 1 FROM public.tenants t
    JOIN public.user_roles ur ON ur.tenant_id = t.id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'operator'::public.app_role
      AND t.slug = (storage.foldername(storage.objects.name))[1]
  )
)
WITH CHECK (
  bucket_id = 'photos' AND EXISTS (
    SELECT 1 FROM public.tenants t
    JOIN public.user_roles ur ON ur.tenant_id = t.id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'operator'::public.app_role
      AND t.slug = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Operators delete tenant photo files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'photos' AND EXISTS (
    SELECT 1 FROM public.tenants t
    JOIN public.user_roles ur ON ur.tenant_id = t.id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'operator'::public.app_role
      AND t.slug = (storage.foldername(storage.objects.name))[1]
  )
);