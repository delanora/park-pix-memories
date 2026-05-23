import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  supabaseAdmin,
  getSignedUrl,
  uploadFileToBucket,
  deleteFilesFromBucket,
} from "./photo-storage.server";
import { normalizePhone, phoneToEmail, birthdateToPassword } from "./photo-utils";

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
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const set = new Set((roles ?? []).map((r) => r.role));
    return {
      userId,
      isOperator: set.has("operator"),
      isCustomer: set.has("customer"),
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
      .eq("status", "available")
      .order("taken_at", { ascending: false })
      .limit(200);
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
