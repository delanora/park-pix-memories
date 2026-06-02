import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  supabaseAdmin,
  uploadFileToBucket,
  deleteFilesFromBucket,
} from "./photo-storage.server";
import { getOperatorTenantId } from "./tenant.server";
import { promises as fs } from "node:fs";
import path from "node:path";

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

function contentTypeFor(ext: string): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Reads new files from the local inbox folder and imports them as photos
 * belonging to the operator's tenant.
 *
 * Folder layout (multi-tenant):
 *   photos-inbox/
 *     {tenant_slug}/        ← files dropped here by FTP
 *     {tenant_slug}/processed/
 *     {tenant_slug}/failed/
 *
 * The operator only sees and imports files from their own tenant's subfolder.
 */
export const ingestLocalPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const tenantId = await getOperatorTenantId(userId);
    const { data: tenant } = await supabaseAdmin
      .from("tenants").select("slug").eq("id", tenantId).single();
    const slug = tenant?.slug ?? "default";

    const rootDir = path.resolve(
      process.env.PHOTOS_INBOX_DIR ?? "./photos-inbox",
    );
    const inboxDir = path.join(rootDir, slug);
    const processedDir = path.join(inboxDir, "processed");
    const failedDir = path.join(inboxDir, "failed");
    const defaultPrice = Number(process.env.PHOTOS_DEFAULT_PRICE ?? "15");

    try {
      await ensureDir(inboxDir);
      await ensureDir(processedDir);
      await ensureDir(failedDir);
    } catch (err: any) {
      console.error("[internal]", `inbox dir ${inboxDir}: ${err.message}`);
      throw new Error("Erro interno. Tente novamente.");
    }

    const entries = await fs.readdir(inboxDir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((name) => {
        const ext = name.split(".").pop()?.toLowerCase() ?? "";
        return ALLOWED_EXT.has(ext) && !name.startsWith(".");
      });

    let imported = 0;
    const errors: string[] = [];

    for (const fileName of files) {
      const fullPath = path.join(inboxDir, fileName);
      const ext = fileName.split(".").pop()!.toLowerCase();
      const storagePath = `${slug}/${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
      try {
        const bytes = await fs.readFile(fullPath);
        await uploadFileToBucket(
          storagePath,
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ) as ArrayBuffer,
          contentTypeFor(ext),
        );
        const { error } = await supabaseAdmin.from("photos").insert({
          storage_path: storagePath,
          price: defaultPrice,
          uploaded_by: userId,
          tenant_id: tenantId,
        });
        if (error) {
          await deleteFilesFromBucket([storagePath]);
          console.error("[internal]", error.message);
          throw new Error("Erro interno. Tente novamente.");
        }
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        await fs.rename(
          fullPath,
          path.join(processedDir, `${ts}__${fileName}`),
        );
        imported++;
      } catch (err: any) {
        errors.push(`${fileName}: ${err.message}`);
        try {
          await fs.rename(fullPath, path.join(failedDir, fileName));
        } catch {
          /* ignore */
        }
      }
    }

    return {
      inboxDir,
      scanned: files.length,
      imported,
      errors,
    };
  });

