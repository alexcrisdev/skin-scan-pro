import { z } from "zod";

export const resetPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Ingresa tu correo electronico.")
    .email("Ingresa un correo electronico valido."),
});

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
