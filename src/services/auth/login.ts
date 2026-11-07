import { getSupabaseClient } from "@/lib/supabase";
import type { LoginFormValues } from "@/schemas/loginSchema";
export class LoginError extends Error {}
export async function loginUser(values: LoginFormValues) {
  localStorage.setItem("skinscan-remember", String(values.rememberSession));
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email: values.email,
    password: values.password,
  });
  if (error) throw new LoginError("No se pudo iniciar sesión. Verifica tu correo y contraseña.");
  return data.user;
}
