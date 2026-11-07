import { getSupabaseClient } from "./supabase";

// Renew private image links on every view; stored links may have expired.
export async function resolveAnalysisImageUrl(value: string | null): Promise<string | null> {
  if (!value) return null;
  const url = new URL(value);
  const base = new URL(import.meta.env.VITE_SUPABASE_URL!);
  const prefix = "/storage/v1/object/sign/analysis-images/";
  if (url.origin !== base.origin || !url.pathname.startsWith(prefix)) return value;
  const path = decodeURIComponent(url.pathname.slice(prefix.length));
  const { data, error } = await getSupabaseClient()
    .storage.from("analysis-images")
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
