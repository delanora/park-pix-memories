CREATE OR REPLACE FUNCTION public.auto_delete_old_available_photos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.photos
     SET status = 'deleted', deleted_at = now()
   WHERE status = 'available'
     AND tenant_id = NEW.tenant_id
     AND sequence_number <= NEW.sequence_number - 100;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_purchased_photos(_days integer DEFAULT 45)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected integer;
BEGIN
  WITH expired AS (
    SELECT DISTINCT si.photo_id
      FROM public.sale_items si
      JOIN public.sales s ON s.id = si.sale_id
     WHERE s.created_at < (now() - make_interval(days => _days))
  )
  UPDATE public.photos p
     SET status = 'deleted', deleted_at = now()
    FROM expired e
   WHERE p.id = e.photo_id
     AND p.status <> 'deleted';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.expire_purchased_photos(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_purchased_photos(integer) TO service_role;