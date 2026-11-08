import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Ingresa tu correo electronico.")
    .email("Ingresa un correo electronico valido."),
  password: z.string().min(1, "Ingresa tu contrasena."),
  rememberSession: z.boolean(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
