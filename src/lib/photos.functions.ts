import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  supabaseAdmin,
  getSignedUrl,
  uploadFileToBucket,
  deleteFilesFromBucket,
} from "./photo-storage.server";
import { normalizePhone, birthdateToPassword } from "./photo-utils";
import { getOperatorTenantId, getTenantBySlug } from "./tenant.server";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

function phoneToTenantEmail(phone: string, slug: string) {
  return `${phone}@${slug}.parque.local`;
}

export type PhotoDTO = {
  id: string;
  price: number;
  takenAt: string;
  status: string;
  url: string;
  sequenceNumber: number;
};

// ------------------------------------------------------------------
// Who am I? Returns role + customer flag so the UI can route the user.
// ------------------------------------------------------------------
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const [{ data: roles }, { data: superRow }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role, tenant_id").eq("user_id", userId),
      supabaseAdmin.from("super_admins").select("user_id").eq("user_id", userId).maybeSingle(),
    ]);
    const set = new Set((roles ?? []).map((r) => r.role));
    const tenantId = (roles ?? []).find((r) => r.role === "operator")?.tenant_id
      ?? (roles ?? []).find((r) => r.role === "customer")?.tenant_id
      ?? null;
    let tenantSlug: string | null = null;
    if (tenantId) {
      const { data: t } = await supabaseAdmin
        .from("tenants").select("slug").eq("id", tenantId).maybeSingle();
      tenantSlug = t?.slug ?? null;
    }
    return {
      userId,
      isOperator: set.has("operator"),
      isCustomer: set.has("customer"),
      isSuperAdmin: !!superRow,
      tenantId,
      tenantSlug,
    };
  });

// ------------------------------------------------------------------
// Upload a photo (operator only)
// ------------------------------------------------------------------
const UploadSchema = z.object({
  fileName: z.string().min(1).max(120),
  contentType: z.string().min(3).max(100),
  base64: z.string().min(10),
  price: z.number().min(0).max(99999),
});

export const uploadPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UploadSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: hasRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "operator")
      .maybeSingle();
    if (!hasRole) throw new Error("Apenas operadores podem enviar fotos");

    const ext = data.fileName.split(".").pop()?.toLowerCase() ?? "jpg";
    const cleanExt = /^[a-z0-9]{2,5}$/.test(ext) ? ext : "jpg";
    const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${cleanExt}`;

    // Decode base64
    const binary = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    await uploadFileToBucket(path, binary.buffer as ArrayBuffer, data.contentType);

    const { data: inserted, error } = await supabaseAdmin
      .from("photos")
      .insert({
        storage_path: path,
        price: data.price,
        uploaded_by: userId,
      })
      .select("id")
      .single();
    if (error) {
      await deleteFilesFromBucket([path]);
      throw new Error(error.message);
    }
    return { id: inserted.id };
  });

// ------------------------------------------------------------------
// List photos available in the operator gallery
// ------------------------------------------------------------------
export const listGalleryPhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PhotoDTO[]> => {
    const { userId } = context;
    const { data: hasRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "operator")
      .maybeSingle();
    if (!hasRole) throw new Error("Acesso negado");

    const { data: photos, error } = await supabaseAdmin
      .from("photos")
      .select("id, storage_path, price, taken_at, status, sequence_number")
      .in("status", ["available", "sold"])
      .order("sequence_number", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);

    const rows = await Promise.all(
      (photos ?? []).map(async (p) => ({
        id: p.id,
        price: Number(p.price),
        takenAt: p.taken_at,
        status: p.status,
        sequenceNumber: Number(p.sequence_number),
        url: await getSignedUrl(p.storage_path, 60 * 10),
      })),
    );
    return rows;
  });

// ------------------------------------------------------------------
// Public: last 30 photos (carousel on landing page)
// ------------------------------------------------------------------
export const listLatestPhotos = createServerFn({ method: "GET" }).handler(
  async (): Promise<PhotoDTO[]> => {
    const { data: photos, error } = await supabaseAdmin
      .from("photos")
      .select("id, storage_path, price, taken_at, status, sequence_number")
      .in("status", ["available", "sold"])
      .order("sequence_number", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);

    return Promise.all(
      (photos ?? []).map(async (p) => ({
        id: p.id,
        price: Number(p.price),
        takenAt: p.taken_at,
        status: p.status,
        sequenceNumber: Number(p.sequence_number),
        url: await getSignedUrl(p.storage_path, 60 * 5),
      })),
    );
  },
);

// ------------------------------------------------------------------
// Sell selected photos to a (new or existing) customer
// ------------------------------------------------------------------
const SellSchema = z.object({
  phone: z.string().min(8).max(30),
  fullName: z.string().min(2).max(120),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  photoIds: z.array(z.string().uuid()).min(1).max(50),
});

export const createCustomerAndSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SellSchema.parse(d))
  .handler(async ({ data, context }) => {
    const operatorId = context.userId;

    const { data: opRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", operatorId)
      .eq("role", "operator")
      .maybeSingle();
    if (!opRole) throw new Error("Apenas operadores podem vender");

    const cleanPhone = normalizePhone(data.phone);
    if (cleanPhone.length < 8) throw new Error("Telefone inválido");

    const email = phoneToEmail(cleanPhone);
    const password = birthdateToPassword(data.birthdate);

    // Find or create customer auth user (by profile phone)
    let customerId: string | null = null;
    const { data: existingProfile } = await supabaseAdmin
      .from("customer_profiles")
      .select("user_id")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (existingProfile) {
      customerId = existingProfile.user_id;
      // Keep password in sync with birthdate (operator may correct it)
      await supabaseAdmin.auth.admin.updateUserById(customerId, { password });
    } else {
      const created = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName, phone: cleanPhone },
      });
      if (created.error || !created.data.user)
        throw new Error(created.error?.message ?? "Falha ao criar cliente");
      customerId = created.data.user.id;

      const { error: profErr } = await supabaseAdmin
        .from("customer_profiles")
        .insert({
          user_id: customerId,
          phone: cleanPhone,
          full_name: data.fullName,
          birthdate: data.birthdate,
        });
      if (profErr) throw new Error(profErr.message);

      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: customerId, role: "customer" });
      if (roleErr) throw new Error(roleErr.message);
    }

    // Fetch photo prices and confirm availability
    const { data: photos, error: photosErr } = await supabaseAdmin
      .from("photos")
      .select("id, price, status")
      .in("id", data.photoIds);
    if (photosErr) throw new Error(photosErr.message);
    if (!photos || photos.length !== data.photoIds.length)
      throw new Error("Alguma foto não foi encontrada");
    for (const p of photos) {
      if (p.status === "deleted") throw new Error("Uma das fotos foi removida");
    }
    const total = photos.reduce((sum, p) => sum + Number(p.price), 0);

    // Create the sale
    const { data: sale, error: saleErr } = await supabaseAdmin
      .from("sales")
      .insert({ customer_id: customerId, operator_id: operatorId, total })
      .select("id")
      .single();
    if (saleErr || !sale) throw new Error(saleErr?.message ?? "Falha na venda");

    const items = photos.map((p) => ({
      sale_id: sale.id,
      photo_id: p.id,
      unit_price: Number(p.price),
    }));
    const { error: itemsErr } = await supabaseAdmin.from("sale_items").insert(items);
    if (itemsErr) throw new Error(itemsErr.message);

    // Mark photos as sold (so they aren't auto-deleted)
    const { error: updErr } = await supabaseAdmin
      .from("photos")
      .update({ status: "sold" })
      .in("id", data.photoIds);
    if (updErr) throw new Error(updErr.message);

    return { saleId: sale.id, total, customerPhone: cleanPhone };
  });

// ------------------------------------------------------------------
// Customer: list my purchased photos
// ------------------------------------------------------------------
export const listMyPhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PhotoDTO[]> => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("sale_items")
      .select(
        "photo_id, unit_price, sales!inner(customer_id), photos!inner(id, storage_path, taken_at, status, sequence_number)",
      )
      .eq("sales.customer_id", userId);
    if (error) throw new Error(error.message);

    const rows = (data ?? []).filter(
      (r) => (r.photos as any)?.status !== "deleted",
    );
    return Promise.all(
      rows.map(async (r) => {
        const p: any = r.photos;
        return {
          id: p.id,
          price: Number(r.unit_price),
          takenAt: p.taken_at,
          status: p.status,
          sequenceNumber: Number(p.sequence_number),
          url: await getSignedUrl(p.storage_path, 60 * 10),
        };
      }),
    );
  });

// ------------------------------------------------------------------
// Get a fresh signed download URL for one of my photos
// ------------------------------------------------------------------
const DownloadSchema = z.object({ photoId: z.string().uuid() });

export const getDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DownloadSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Operators may download anything; customers only their purchased photos
    const { data: op } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "operator")
      .maybeSingle();

    let storagePath: string | null = null;
    if (op) {
      const { data: photo } = await supabaseAdmin
        .from("photos")
        .select("storage_path")
        .eq("id", data.photoId)
        .maybeSingle();
      storagePath = photo?.storage_path ?? null;
    } else {
      const { data: row } = await supabaseAdmin
        .from("sale_items")
        .select("photos!inner(storage_path), sales!inner(customer_id)")
        .eq("photo_id", data.photoId)
        .eq("sales.customer_id", userId)
        .maybeSingle();
      storagePath = (row?.photos as any)?.storage_path ?? null;
    }
    if (!storagePath) throw new Error("Foto não encontrada");
    return { url: await getSignedUrl(storagePath, 60 * 5) };
  });

// ------------------------------------------------------------------
// Sales history (operator)
// ------------------------------------------------------------------
export const listSales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: op } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "operator")
      .maybeSingle();
    if (!op) throw new Error("Acesso negado");

    const { data, error } = await supabaseAdmin
      .from("sales")
      .select(
        "id, total, created_at, customer_id, customer_profiles!inner(phone, full_name), sale_items(photo_id)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((s: any) => ({
      id: s.id,
      total: Number(s.total),
      createdAt: s.created_at,
      customerName: s.customer_profiles.full_name,
      customerPhone: s.customer_profiles.phone,
      photoCount: (s.sale_items ?? []).length,
    }));
  });

// ------------------------------------------------------------------
// Operator dashboard stats
// ------------------------------------------------------------------
export const getOperatorStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: op } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "operator")
      .maybeSingle();
    if (!op) throw new Error("Acesso negado");

    const [available, sold, customers, sales] = await Promise.all([
      supabaseAdmin
        .from("photos")
        .select("id", { count: "exact", head: true })
        .eq("status", "available"),
      supabaseAdmin
        .from("photos")
        .select("id", { count: "exact", head: true })
        .eq("status", "sold"),
      supabaseAdmin
        .from("customer_profiles")
        .select("user_id", { count: "exact", head: true }),
      supabaseAdmin.from("sales").select("total"),
    ]);
    const revenue = (sales.data ?? []).reduce(
      (sum, s) => sum + Number(s.total),
      0,
    );
    return {
      available: available.count ?? 0,
      sold: sold.count ?? 0,
      customers: customers.count ?? 0,
      revenue,
    };
  });

// ------------------------------------------------------------------
// Sales metrics dashboard (operator)
// ------------------------------------------------------------------
export const getSalesMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: op } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "operator")
      .maybeSingle();
    if (!op) throw new Error("Acesso negado");

    // Pull all sales with their items count
    const { data: sales, error } = await supabaseAdmin
      .from("sales")
      .select("id, total, created_at, operator_id, sale_items(photo_id)")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);

    const all = sales ?? [];
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalRevenue = all.reduce((s, r) => s + Number(r.total), 0);
    const totalSales = all.length;
    const totalPhotos = all.reduce(
      (s, r) => s + ((r as any).sale_items?.length ?? 0),
      0,
    );

    const todaySales = all.filter((r) => new Date(r.created_at) >= startOfToday);
    const monthSales = all.filter((r) => new Date(r.created_at) >= startOfMonth);
    const todayRevenue = todaySales.reduce((s, r) => s + Number(r.total), 0);
    const monthRevenue = monthSales.reduce((s, r) => s + Number(r.total), 0);

    // Hourly breakdown for the last 24 hours
    const byHour: Array<{ hour: string; revenue: number; sales: number }> = [];
    for (let i = 23; i >= 0; i--) {
      const slotEnd = new Date(now.getTime() - i * 60 * 60 * 1000);
      const slotStart = new Date(slotEnd.getTime() - 60 * 60 * 1000);
      const bucket = all.filter((r) => {
        const t = new Date(r.created_at);
        return t >= slotStart && t < slotEnd;
      });
      byHour.push({
        hour: `${String(slotEnd.getHours()).padStart(2, "0")}h`,
        revenue: bucket.reduce((s, r) => s + Number(r.total), 0),
        sales: bucket.length,
      });
    }

    // Last 14 days for context
    const byDay: Array<{ day: string; revenue: number; sales: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - i,
      );
      const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
      const bucket = all.filter((r) => {
        const t = new Date(r.created_at);
        return t >= d && t < next;
      });
      byDay.push({
        day: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
        revenue: bucket.reduce((s, r) => s + Number(r.total), 0),
        sales: bucket.length,
      });
    }

    // Group by operator
    const opMap = new Map<
      string,
      { revenue: number; sales: number; photos: number }
    >();
    for (const r of all) {
      const k = r.operator_id ?? "—";
      const cur = opMap.get(k) ?? { revenue: 0, sales: 0, photos: 0 };
      cur.revenue += Number(r.total);
      cur.sales += 1;
      cur.photos += (r as any).sale_items?.length ?? 0;
      opMap.set(k, cur);
    }
    const byOperator: Array<{
      operatorId: string;
      email: string;
      revenue: number;
      sales: number;
      photos: number;
    }> = [];
    for (const [opId, v] of opMap.entries()) {
      let email = "—";
      if (opId !== "—") {
        const u = await supabaseAdmin.auth.admin.getUserById(opId);
        email = u.data.user?.email ?? opId.slice(0, 8);
      }
      byOperator.push({ operatorId: opId, email, ...v });
    }
    byOperator.sort((a, b) => b.revenue - a.revenue);

    return {
      totalRevenue,
      totalSales,
      totalPhotos,
      todayRevenue,
      todaySalesCount: todaySales.length,
      monthRevenue,
      monthSalesCount: monthSales.length,
      byHour,
      byDay,
      byOperator,
    };
  });

// ------------------------------------------------------------------
// First-operator signup helper (used when there are zero operators)
// ------------------------------------------------------------------
const SignupSchema = z.object({
  userId: z.string().uuid(),
});

export const claimFirstOperator = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SignupSchema.parse(d))
  .handler(async ({ data }) => {
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "operator");
    if ((count ?? 0) > 0) {
      throw new Error("Já existe um operador. Peça acesso a um existente.");
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: "operator" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------------------------------------------------------------
// Create a new operator (admin = any existing operator)
// ------------------------------------------------------------------
const CreateOperatorSchema = z.object({
  email: z.string().email().max(180),
  password: z.string().min(6).max(120),
});

export const createOperator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateOperatorSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: op } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "operator")
      .maybeSingle();
    if (!op) throw new Error("Apenas operadores podem criar novos operadores");

    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "Falha ao criar operador");
    }
    const newId = created.data.user.id;
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: "operator" });
    if (roleErr) throw new Error(roleErr.message);
    return { id: newId, email: data.email };
  });

// ------------------------------------------------------------------
// List operators (operator only)
// ------------------------------------------------------------------
export const listOperators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: op } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "operator")
      .maybeSingle();
    if (!op) throw new Error("Acesso negado");

    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, created_at")
      .eq("role", "operator")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const out: Array<{ id: string; email: string | null; createdAt: string }> = [];
    for (const r of roles ?? []) {
      const u = await supabaseAdmin.auth.admin.getUserById(r.user_id);
      out.push({
        id: r.user_id,
        email: u.data.user?.email ?? null,
        createdAt: r.created_at,
      });
    }
    return out;
  });

// ------------------------------------------------------------------
// Delete a photo (operator only) — removes file from storage and marks deleted
// ------------------------------------------------------------------
const DeletePhotoSchema = z.object({ photoId: z.string().uuid() });

export const deletePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DeletePhotoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: op } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "operator")
      .maybeSingle();
    if (!op) throw new Error("Apenas operadores podem apagar fotos");

    const { data: photo, error: fetchErr } = await supabaseAdmin
      .from("photos")
      .select("storage_path")
      .eq("id", data.photoId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!photo) throw new Error("Foto não encontrada");

    await deleteFilesFromBucket([photo.storage_path]);
    const { error: updErr } = await supabaseAdmin
      .from("photos")
      .update({ status: "deleted", deleted_at: new Date().toISOString() })
      .eq("id", data.photoId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });
