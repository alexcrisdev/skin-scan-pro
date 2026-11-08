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

export async function resendSignupConfirmation(email: string) {
  const { error } = await getSupabaseClient().auth.resend({
    type: "signup",
    email: email.trim(),
  });
  if (error) {
    throw new RegisterError(
      authErrorMessage(
        error,
        "No se pudo reenviar el correo de confirmación. Inténtalo nuevamente.",
      ),
    );
  }
}
