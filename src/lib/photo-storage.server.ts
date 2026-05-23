// Server-only helpers. Never imported from the client.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "photos";

export async function getSignedUrl(path: string, expiresIn = 60): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) throw new Error(error?.message ?? "Falha ao gerar URL");
  return data.signedUrl;
}

export async function uploadFileToBucket(
  path: string,
  bytes: ArrayBuffer,
  contentType: string,
) {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(error.message);
}

export async function deleteFilesFromBucket(paths: string[]) {
  if (paths.length === 0) return;
  await supabaseAdmin.storage.from(BUCKET).remove(paths);
}

export { supabaseAdmin, BUCKET };
