import { getSupabaseClient } from "@/lib/supabase";
import type { LoginFormValues } from "@/schemas/loginSchema";
import { authErrorMessage } from "./errors";
export class LoginError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "LoginError";
    this.code = code;
  }
}
export async function loginUser(values: LoginFormValues) {
  localStorage.setItem("skinscan-remember", String(values.rememberSession));
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email: values.email.trim(),
    password: values.password,
  });
  if (error) {
    throw new LoginError(
      authErrorMessage(error, "No se pudo iniciar sesión. Inténtalo nuevamente."),
      error.code,
    );
  }
  return data.user;
}
