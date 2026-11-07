import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabase";

// App-facing session shape used by the existing screens.
export type User = { uid: string; email: string | null; displayName: string | null };
function mapUser(user: SupabaseUser | null): User | null {
  return user
    ? { uid: user.id, email: user.email ?? null, displayName: user.user_metadata.name ?? null }
    : null;
}
let currentUser: User | null = null;
export function getAppAuth() {
  return {
    get currentUser() {
      return currentUser;
    },
  };
}
export function onAuthStateChanged(
  _auth: ReturnType<typeof getAppAuth>,
  callback: (user: User | null) => void,
) {
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    currentUser = null;
    const timer = setTimeout(() => callback(null), 0);
    return () => clearTimeout(timer);
  }
  const client = getSupabaseClient();
  let active = true;
  let receivedEvent = false;
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    receivedEvent = true;
    currentUser = mapUser(session?.user ?? null);
    // Keep Supabase queries outside the auth callback lock.
    const snapshot = currentUser;
    setTimeout(() => {
      if (active) callback(snapshot);
    }, 0);
  });
  void client.auth
    .getSession()
    .then(({ data }) => {
      if (!active || receivedEvent) return;
      currentUser = mapUser(data.session?.user ?? null);
      callback(currentUser);
    })
    .catch(() => {
      if (active) callback(null);
    });
  return () => {
    active = false;
    data.subscription.unsubscribe();
  };
}
export async function getIdToken(_user?: User) {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error || !data.session) throw new Error("Inicia sesión nuevamente.");
  return data.session.access_token;
}
export async function signOut(_auth?: ReturnType<typeof getAppAuth>) {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
  currentUser = null;
}
