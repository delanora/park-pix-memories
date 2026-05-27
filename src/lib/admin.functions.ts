import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertSuperAdmin } from "./tenant.server";

export type TenantDTO = {
  id: string;
  slug: string;
  name: string;
  status: string;
  createdAt: string;
  operatorCount: number;
  photoCount: number;
  salesCount: number;
  revenue: number;
};

export const listTenants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TenantDTO[]> => {
    await assertSuperAdmin(context.userId);
    const { data: tenants, error } = await supabaseAdmin
      .from("tenants")
      .select("id, slug, name, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const out: TenantDTO[] = [];
    for (const t of tenants ?? []) {
      const [ops, ph, sl] = await Promise.all([
        supabaseAdmin
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", t.id)
          .eq("role", "operator"),
        supabaseAdmin
          .from("photos")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", t.id),
        supabaseAdmin
          .from("sales")
          .select("total")
          .eq("tenant_id", t.id),
      ]);
      const revenue = (sl.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      out.push({
        id: t.id,
        slug: t.slug,
        name: t.name,
        status: t.status,
        createdAt: t.created_at,
        operatorCount: ops.count ?? 0,
        photoCount: ph.count ?? 0,
        salesCount: sl.data?.length ?? 0,
        revenue,
      });
    }
    return out;
  });

const SlugRegex = /^[a-z0-9][a-z0-9-]{1,40}$/;

const CreateTenantSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().regex(SlugRegex, "Slug inválido (use letras minúsculas, números e -)"),
  operatorEmail: z.string().email().max(180),
  operatorPassword: z.string().min(6).max(120),
});

export const createTenantWithOperator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateTenantSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    // Check slug uniqueness
    const { data: existing } = await supabaseAdmin
      .from("tenants").select("id").eq("slug", data.slug).maybeSingle();
    if (existing) throw new Error("Slug já está em uso");

    // Create tenant
    const { data: tenant, error: tErr } = await supabaseAdmin
      .from("tenants")
      .insert({ name: data.name, slug: data.slug, status: "active" })
      .select("id")
      .single();
    if (tErr || !tenant) throw new Error(tErr?.message ?? "Falha ao criar empresa");

    // Create default site_settings row
    await supabaseAdmin
      .from("site_settings")
      .insert({ tenant_id: tenant.id, site_name: data.name });

    // Create operator user
    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.operatorEmail,
      password: data.operatorPassword,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      // best-effort rollback
      await supabaseAdmin.from("tenants").delete().eq("id", tenant.id);
      throw new Error(created.error?.message ?? "Falha ao criar operador");
    }

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: created.data.user.id,
        role: "operator",
        tenant_id: tenant.id,
      });
    if (roleErr) throw new Error(roleErr.message);

    return { tenantId: tenant.id, operatorId: created.data.user.id };
  });

const UpdateTenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(120),
  status: z.enum(["active", "suspended"]),
});

export const updateTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateTenantSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("tenants")
      .update({ name: data.name, status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getGlobalStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const [tenants, ops, ph, sales] = await Promise.all([
      supabaseAdmin.from("tenants").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "operator"),
      supabaseAdmin.from("photos").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("sales").select("total"),
    ]);
    const revenue = (sales.data ?? []).reduce((s, r) => s + Number(r.total), 0);
    return {
      tenants: tenants.count ?? 0,
      operators: ops.count ?? 0,
      photos: ph.count ?? 0,
      sales: sales.data?.length ?? 0,
      revenue,
    };
  });

// Public lookup used by /e/$slug/* routes
const SlugInput = z.object({ slug: z.string().min(1).max(80) });

export const getPublicTenantBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => SlugInput.parse(d))
  .handler(async ({ data }) => {
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id, slug, name, status")
      .eq("slug", data.slug)
      .maybeSingle();
    return tenant;
  });

const TenantIdInput = z.object({ tenantId: z.string().uuid() });

export type OperatorDTO = {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
};

export const listTenantOperators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TenantIdInput.parse(d))
  .handler(async ({ data, context }): Promise<OperatorDTO[]> => {
    await assertSuperAdmin(context.userId);
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, created_at")
      .eq("tenant_id", data.tenantId)
      .eq("role", "operator");
    if (error) throw new Error(error.message);

    const out: OperatorDTO[] = [];
    for (const r of roles ?? []) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
      out.push({
        id: r.user_id,
        email: u.user?.email ?? null,
        createdAt: r.created_at,
        lastSignInAt: u.user?.last_sign_in_at ?? null,
      });
    }
    return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });

const ResetPasswordSchema = z.object({
  operatorId: z.string().uuid(),
  newPassword: z.string().min(6).max(120),
});

export const resetOperatorPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResetPasswordSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    // Confirm the target is actually an operator (not a super admin or customer)
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", data.operatorId)
      .eq("role", "operator")
      .maybeSingle();
    if (!role) throw new Error("Usuário não é operador");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      data.operatorId,
      { password: data.newPassword },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
