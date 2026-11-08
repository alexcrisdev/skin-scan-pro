import { getSupabaseClient } from "@/lib/supabase";
import type { RegisterFormValues } from "@/schemas/registerSchema";
import { authErrorMessage } from "./errors";
export class RegisterError extends Error {}
export async function registerUser(values: RegisterFormValues) {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email: values.email,
    password: values.password,
    options: { data: { name: values.name } },
  });
  if (error)
    throw new RegisterError(
      authErrorMessage(error, "No se pudo crear la cuenta. Inténtalo nuevamente."),
    );
  return data;
}
