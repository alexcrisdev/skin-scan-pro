import { z } from "zod";

const passwordRules = {
  minLength: (value: string) => value.length >= 8,
  uppercase: (value: string) => /[A-Z]/.test(value),
  lowercase: (value: string) => /[a-z]/.test(value),
  number: (value: string) => /\d/.test(value),
  special: (value: string) => /[^A-Za-z0-9]/.test(value),
};

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Ingresa tu nombre completo."),
    email: z
      .string()
      .trim()
      .min(1, "Ingresa tu correo electronico.")
      .email("Ingresa un correo electronico valido."),
    password: z
      .string()
      .min(8, "La contrasena debe tener minimo 8 caracteres.")
      .refine(passwordRules.uppercase, "Incluye al menos una mayuscula.")
      .refine(passwordRules.lowercase, "Incluye al menos una minuscula.")
      .refine(passwordRules.number, "Incluye al menos un numero.")
      .refine(passwordRules.special, "Incluye al menos un caracter especial."),
    confirmPassword: z.string().min(1, "Confirma tu contrasena."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contrasenas no coinciden.",
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const getPasswordChecklist = (password: string) => [
  {
    id: "minLength",
    label: "Minimo 8 caracteres",
    met: passwordRules.minLength(password),
  },
  {
    id: "uppercase",
    label: "Mayuscula",
    met: passwordRules.uppercase(password),
  },
  {
    id: "lowercase",
    label: "Minuscula",
    met: passwordRules.lowercase(password),
  },
  {
    id: "number",
    label: "Numero",
    met: passwordRules.number(password),
  },
  {
    id: "special",
    label: "Caracter especial",
    met: passwordRules.special(password),
  },
];
