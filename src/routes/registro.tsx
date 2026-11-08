import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useState } from "react";

import { Logo } from "@/components/skinscan/logo";
import { EmailConfirmationNotice } from "@/components/skinscan/email-confirmation-notice";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { registerUser } from "@/services/auth/register";
import {
  getPasswordChecklist,
  registerSchema,
  type RegisterFormValues,
} from "@/schemas/registerSchema";
import { AuthSidePanel } from "./login";

export const Route = createFileRoute("/registro")({
  head: () => ({ meta: [{ title: "Crear cuenta - SkinScan" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const password = form.watch("password");
  const passwordChecklist = getPasswordChecklist(password);
  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      const result = await registerUser(values);
      toast.success(
        result.session
          ? "Cuenta creada correctamente."
          : "Revisa tu correo para confirmar tu cuenta.",
      );
      if (result.session) {
        await navigate({ to: "/app" });
      } else {
        setConfirmationEmail(values.email);
        form.reset();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No pudimos crear tu cuenta. Intenta nuevamente.";

      toast.error(message);
    }
  };

  if (confirmationEmail) {
    return (
      <div className="min-h-screen grid lg:grid-cols-2 bg-background">
        <div className="flex flex-col p-8 lg:p-12">
          <Logo />
          <div className="flex-1 grid place-items-center py-6">
            <Card className="w-full max-w-md space-y-5 p-8 border-border/70 shadow-sm">
              <h1 className="text-2xl font-semibold tracking-tight">Revisa tu correo</h1>
              <EmailConfirmationNotice email={confirmationEmail} />
              <Button asChild className="w-full">
                <Link to="/login">Ya confirmé mi correo: iniciar sesión</Link>
              </Button>
            </Card>
          </div>
        </div>
        <AuthSidePanel />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="flex flex-col p-8 lg:p-12">
        <Logo />
        <div className="flex-1 grid place-items-center py-6">
          <Card className="w-full max-w-md p-8 border-border/70 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight">Crea tu cuenta personal</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Lleva un registro personal de tus imágenes y análisis de la piel
            </p>

            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre completo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ana López"
                          autoComplete="name"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo electronico</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="tu@correo.com"
                          autoComplete="email"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contrasena</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            disabled={isSubmitting}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            disabled={isSubmitting}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-2 rounded-md border border-border/70 p-3">
                  {passwordChecklist.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center gap-2 text-xs transition-colors",
                        item.met ? "text-emerald-600" : "text-muted-foreground",
                      )}
                    >
                      {item.met ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Circle className="h-3.5 w-3.5" />
                      )}
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>

                <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creando cuenta
                    </>
                  ) : (
                    "Crear cuenta"
                  )}
                </Button>
              </form>
            </Form>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              Al crear una cuenta aceptas nuestros{" "}
              <a className="underline" href="#">
                Terminos
              </a>{" "}
              y{" "}
              <a className="underline" href="#">
                Privacidad
              </a>
              .
            </p>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Ya tienes cuenta?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Iniciar sesion
              </Link>
            </p>
          </Card>
        </div>
        <div className="text-xs text-muted-foreground text-center">
          (c) {new Date().getFullYear()} SkinScan
        </div>
      </div>
      <AuthSidePanel />
    </div>
  );
}
