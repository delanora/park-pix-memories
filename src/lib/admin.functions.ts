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
  feePerPhoto: number;
  monthlyRevenue: number;
  monthlyPhotos: number;
  monthlyCommission: number;
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
      .select("id, slug, name, status, created_at, fee_per_photo")
      .order("created_at", { ascending: false });
    if (error) { console.error("[internal]", error.message); throw new Error("Erro interno. Tente novamente."); }

    // Start of current month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const out: TenantDTO[] = [];
    for (const t of tenants ?? []) {
      const [ops, ph, sl, slMonth, phMonth] = await Promise.all([
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
        supabaseAdmin
          .from("sales")
          .select("total")
          .eq("tenant_id", t.id)
          .gte("created_at", monthStart.toISOString()),
        supabaseAdmin
          .from("photos")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", t.id)
          .gte("taken_at", monthStart.toISOString()),
      ]);
      const revenue = (sl.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const monthlyRevenue = (slMonth.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const monthlyPhotos = phMonth.count ?? 0;
      const feePerPhoto = Number(t.fee_per_photo ?? 0);
      out.push({
        id: t.id,
        slug: t.slug,
        name: t.name,
        status: t.status,
        createdAt: t.created_at,
        feePerPhoto,
        monthlyRevenue,
        monthlyPhotos,
        monthlyCommission: monthlyPhotos * feePerPhoto,
        operatorCount: ops.count ?? 0,
        photoCount: ph.count ?? 0,
        salesCount: sl.data?.length ?? 0,
        revenue,
      });
    }
    return out;
  });

const CnpjRegex = /^\d{14}$/;

const CreateTenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  cnpj: z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().regex(CnpjRegex, "CNPJ deve ter 14 dígitos")),
  operatorEmail: z.string().email().max(180),
  operatorPassword: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres")
    .max(120)
    .regex(/[A-Za-z]/, "A senha deve conter pelo menos uma letra")
    .regex(/[0-9]/, "A senha deve conter pelo menos um número"),
});

// Deterministic 12-char slug from cnpj+name using SHA-256 → base36
async function generateSlug(cnpj: string, name: string, attempt = 0): Promise<string> {
  const seed = `${cnpj}|${name.trim().toLowerCase()}|${attempt}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const bytes = new Uint8Array(buf);
  // Convert to base36 string, pick 12 chars
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  const big = BigInt("0x" + hex);
  const s = big.toString(36);
  return s.slice(0, 12).padStart(12, "0");
}

export const createTenantWithOperator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateTenantSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    // Check CNPJ uniqueness
    const { data: existingCnpj } = await supabaseAdmin
      .from("tenants").select("id").eq("cnpj", data.cnpj).maybeSingle();
    if (existingCnpj) throw new Error("Já existe uma empresa com este CNPJ");

    // Generate unique slug (retry on collision)
    let slug = "";
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = await generateSlug(data.cnpj, data.name, attempt);
      const { data: clash } = await supabaseAdmin
        .from("tenants").select("id").eq("slug", candidate).maybeSingle();
      if (!clash) { slug = candidate; break; }
    }
    if (!slug) throw new Error("Não foi possível gerar um slug único");

    // Create tenant
    const { data: tenant, error: tErr } = await supabaseAdmin
      .from("tenants")
      .insert({ name: data.name, slug, cnpj: data.cnpj, status: "active" })
      .select("id")
      .single();
    if (tErr || !tenant) { console.error("[internal]", tErr?.message); throw new Error("Erro interno. Tente novamente."); }


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
      console.error("[internal]", created.error?.message);
      throw new Error("Erro interno. Tente novamente.");
    }

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: created.data.user.id,
        role: "operator",
        tenant_id: tenant.id,
      });
    if (roleErr) { console.error("[internal]", roleErr.message); throw new Error("Erro interno. Tente novamente."); }

    return { tenantId: tenant.id, operatorId: created.data.user.id };
  });

const UpdateTenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(120).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  feePerPhoto: z.number().min(0).max(10000).optional(),
});

export const updateTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateTenantSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const patch: { name?: string; status?: string; fee_per_photo?: number } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.status !== undefined) patch.status = data.status;
    if (data.feePerPhoto !== undefined) patch.fee_per_photo = data.feePerPhoto;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("tenants")
      .update(patch)
      .eq("id", data.id);
    if (error) { console.error("[internal]", error.message); throw new Error("Erro interno. Tente novamente."); }
    return { ok: true };
  });

const MonthlyReportSchema = z.object({
  tenantId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

export type MonthlyReportDTO = {
  tenant: { id: string; name: string; slug: string; feePerPhoto: number };
  period: { year: number; month: number; label: string; from: string; to: string };
  photosCount: number;
  salesCount: number;
  totalRevenue: number;
  commission: number;
  netForClient: number;
  daily: { date: string; photos: number; sales: number; revenue: number }[];
};

export const getTenantMonthlyReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MonthlyReportSchema.parse(d))
  .handler(async ({ data, context }): Promise<MonthlyReportDTO> => {
    await assertSuperAdmin(context.userId);

    const { data: t, error: tErr } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug, fee_per_photo")
      .eq("id", data.tenantId)
      .maybeSingle();
    if (tErr) { console.error("[internal]", tErr.message); throw new Error("Erro interno. Tente novamente."); }
    if (!t) throw new Error("Empresa não encontrada");

    const from = new Date(Date.UTC(data.year, data.month - 1, 1));
    const to = new Date(Date.UTC(data.year, data.month, 1));
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    const [photosRes, salesRes] = await Promise.all([
      supabaseAdmin
        .from("photos")
        .select("id, taken_at")
        .eq("tenant_id", data.tenantId)
        .gte("taken_at", fromIso)
        .lt("taken_at", toIso),
      supabaseAdmin
        .from("sales")
        .select("id, total, created_at")
        .eq("tenant_id", data.tenantId)
        .gte("created_at", fromIso)
        .lt("created_at", toIso),
    ]);
    if (photosRes.error) { console.error("[internal]", photosRes.error.message); throw new Error("Erro interno. Tente novamente."); }
    if (salesRes.error) { console.error("[internal]", salesRes.error.message); throw new Error("Erro interno. Tente novamente."); }

    const photos = photosRes.data ?? [];
    const sales = salesRes.data ?? [];
    const totalRevenue = sales.reduce((s, r) => s + Number(r.total), 0);
    const feePerPhoto = Number(t.fee_per_photo ?? 0);
    const commission = photos.length * feePerPhoto;

    // Daily breakdown
    const daysInMonth = new Date(data.year, data.month, 0).getDate();
    const daily: { date: string; photos: number; sales: number; revenue: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      daily.push({
        date: `${data.year}-${String(data.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        photos: 0,
        sales: 0,
        revenue: 0,
      });
    }
    for (const p of photos) {
      const day = new Date(p.taken_at).getUTCDate();
      if (daily[day - 1]) daily[day - 1].photos += 1;
    }
    for (const s of sales) {
      const day = new Date(s.created_at).getUTCDate();
      if (daily[day - 1]) {
        daily[day - 1].sales += 1;
        daily[day - 1].revenue += Number(s.total);
      }
    }

    const label = from.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    return {
      tenant: { id: t.id, name: t.name, slug: t.slug, feePerPhoto },
      period: { year: data.year, month: data.month, label, from: fromIso, to: toIso },
      photosCount: photos.length,
      salesCount: sales.length,
      totalRevenue,
      commission,
      netForClient: totalRevenue - commission,
      daily,
    };
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

export type TenantPerformance = {
  id: string;
  name: string;
  slug: string;
  revenue: number;
  sales: number;
  photos: number;
  operators: number;
};

export type RevenuePoint = { month: string; total: number };

export type TenantRevenueSeries = {
  id: string;
  name: string;
  slug: string;
  points: RevenuePoint[];
};

export const getAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    perTenant: TenantPerformance[];
    revenueByMonth: RevenuePoint[];
    revenueByMonthByTenant: TenantRevenueSeries[];
  }> => {
    await assertSuperAdmin(context.userId);

    const { data: tenants, error } = await supabaseAdmin
      .from("tenants")
      .select("id, slug, name");
    if (error) { console.error("[internal]", error.message); throw new Error("Erro interno. Tente novamente."); }

    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - 5);
    sinceDate.setDate(1);
    sinceDate.setHours(0, 0, 0, 0);

    // Build last 6 months keys (YYYY-MM)
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const perTenant: TenantPerformance[] = [];
    const revenueByMonthByTenant: TenantRevenueSeries[] = [];
    const globalByMonth = new Map<string, number>(months.map((m) => [m, 0]));

    for (const t of tenants ?? []) {
      const [ops, ph, salesAll, salesRecent] = await Promise.all([
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
        supabaseAdmin
          .from("sales")
          .select("total, created_at")
          .eq("tenant_id", t.id)
          .gte("created_at", sinceDate.toISOString()),
      ]);
      const revenue = (salesAll.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      perTenant.push({
        id: t.id,
        name: t.name,
        slug: t.slug,
        revenue,
        sales: salesAll.data?.length ?? 0,
        photos: ph.count ?? 0,
        operators: ops.count ?? 0,
      });

      const tenantByMonth = new Map<string, number>(months.map((m) => [m, 0]));
      for (const s of salesRecent.data ?? []) {
        const d = new Date(s.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (tenantByMonth.has(key)) {
          tenantByMonth.set(key, (tenantByMonth.get(key) ?? 0) + Number(s.total));
          globalByMonth.set(key, (globalByMonth.get(key) ?? 0) + Number(s.total));
        }
      }
      revenueByMonthByTenant.push({
        id: t.id,
        name: t.name,
        slug: t.slug,
        points: months.map((m) => ({ month: m, total: tenantByMonth.get(m) ?? 0 })),
      });
    }

    return {
      perTenant: perTenant.sort((a, b) => b.revenue - a.revenue),
      revenueByMonth: months.map((m) => ({ month: m, total: globalByMonth.get(m) ?? 0 })),
      revenueByMonthByTenant,
    };
  });

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
    if (error) { console.error("[internal]", error.message); throw new Error("Erro interno. Tente novamente."); }

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
    if (error) { console.error("[internal]", error.message); throw new Error("Erro interno. Tente novamente."); }
    return { ok: true };
  });
