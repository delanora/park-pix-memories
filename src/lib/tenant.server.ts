import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Returns the tenant_id that the given operator user belongs to.
 * Throws if the user is not an operator.
 */
export async function getOperatorTenantId(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("role", "operator")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado: usuário não é operador");
  return data.tenant_id;
}

/** Returns true if this operator is a "photo-only" (restricted) operator. */
export async function isRestrictedOperator(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("restricted")
    .eq("user_id", userId)
    .eq("role", "operator")
    .maybeSingle();
  return !!(data as any)?.restricted;
}

/** Throws unless the user is a full (non-restricted) operator. Returns tenant_id. */
export async function assertFullOperator(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("tenant_id, restricted")
    .eq("user_id", userId)
    .eq("role", "operator")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado: usuário não é operador");
  if ((data as any).restricted) {
    throw new Error("Acesso negado: operador de fotos não tem permissão para esta ação");
  }
  return data.tenant_id;
}

/** Returns the tenant_id of a customer user (their own role row). */
export async function getCustomerTenantId(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("role", "customer")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Cliente sem empresa vinculada");
  return data.tenant_id;
}

export async function assertSuperAdmin(userId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("super_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Acesso negado: apenas super admin");
}

export async function getTenantBySlug(slug: string) {
  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select("id, slug, name, status")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
