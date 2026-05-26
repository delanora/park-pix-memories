import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  supabaseAdmin,
  uploadFileToBucket,
  deleteFilesFromBucket,
} from "./photo-storage.server";
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
 * Reads all new files from the local "photos-inbox" folder (or the path in
 * PHOTOS_INBOX_DIR), uploads them to the storage bucket, inserts a row in
 * `photos` and then moves the processed file to `<inbox>/processed/`.
 *
 * Use this when running the project on your own server with an FTP folder
 * pointing into `photos-inbox/`. Files that fail to ingest are moved to
 * `<inbox>/failed/` so the operator can inspect them.
 */
export const ingestLocalPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const { data: hasRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "operator")
      .maybeSingle();
    if (!hasRole) throw new Error("Apenas operadores podem importar fotos");

    const inboxDir = path.resolve(
      process.env.PHOTOS_INBOX_DIR ?? "./photos-inbox",
    );
    const processedDir = path.join(inboxDir, "processed");
    const failedDir = path.join(inboxDir, "failed");
    const defaultPrice = Number(process.env.PHOTOS_DEFAULT_PRICE ?? "15");

    try {
      await ensureDir(inboxDir);
      await ensureDir(processedDir);
      await ensureDir(failedDir);
    } catch (err: any) {
      throw new Error(
        `Não foi possível acessar a pasta de inbox (${inboxDir}): ${err.message}`,
      );
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
      const storagePath = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
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
        });
        if (error) {
          await deleteFilesFromBucket([storagePath]);
          throw new Error(error.message);
        }
        // Move to processed/ to avoid reimport
        const ts = new Date()
          .toISOString()
          .replace(/[:.]/g, "-");
        await fs.rename(
          fullPath,
          path.join(processedDir, `${ts}__${fileName}`),
        );
        imported++;
      } catch (err: any) {
        errors.push(`${fileName}: ${err.message}`);
        // Move to failed/ so it doesn't keep retrying every poll
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
