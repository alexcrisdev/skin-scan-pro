import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.");
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      storage:
        typeof window === "undefined"
          ? undefined
          : {
              getItem: (key) => localStorage.getItem(key) ?? sessionStorage.getItem(key),
              setItem: (key, value) => {
                const persistent = localStorage.getItem("skinscan-remember") !== "false";
                (persistent ? localStorage : sessionStorage).setItem(key, value);
                (persistent ? sessionStorage : localStorage).removeItem(key);
              },
              removeItem: (key) => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
              },
            },
    },
  });
  return supabaseClient;
}
