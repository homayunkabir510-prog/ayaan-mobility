import "server-only";
import { createClient } from "@supabase/supabase-js";

export const EVIDENCE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "ayaan-evidence";

export function createEvidenceStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Evidence storage is not configured.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function evidenceObjectExists(path: string): Promise<boolean> {
  const client = createEvidenceStorageClient();
  const { data, error } = await client.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 30);
  return !error && Boolean(data?.signedUrl);
}

export async function createEvidenceSignedUrl(path: string, expiresInSeconds = 300): Promise<string | null> {
  const client = createEvidenceStorageClient();
  const { data, error } = await client.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, expiresInSeconds);
  return error ? null : data.signedUrl;
}
