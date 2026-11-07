import { getSupabaseClient } from "@/lib/supabase";
import type { ResetPasswordFormValues } from "@/schemas/resetPasswordSchema";
export class ResetPasswordError extends Error {}
export async function resetPassword(values: ResetPasswordFormValues) {
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(values.email, {
    redirectTo: `${window.location.origin}/restablecer`,
  });
  if (error) throw new ResetPasswordError("No se pudo enviar el enlace de recuperación.");
}
