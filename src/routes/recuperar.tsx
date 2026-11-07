import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Logo } from "@/components/skinscan/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/schemas/resetPasswordSchema";
import { resetPassword } from "@/services/auth/resetPassword";
import { AuthSidePanel } from "./login";

export const Route = createFileRoute("/recuperar")({
  head: () => ({ meta: [{ title: "Recuperar contraseña — SkinScan" }] }),
  component: Recover,
});

function Recover() {
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: ResetPasswordFormValues) => {
    try {
      await resetPassword(values);
      toast.success("Te enviamos un enlace para restablecer tu contraseña.");
      form.reset();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No pudimos enviar el enlace de recuperacion. Intenta nuevamente.";

      toast.error(message);
    }
  };

  const onInvalid = () => {
    const message =
      form.formState.errors.email?.message ?? "Revisa el correo electronico ingresado.";

    toast.error(message);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="flex flex-col p-8 lg:p-12">
        <Logo />
        <div className="flex-1 grid place-items-center">
          <Card className="w-full max-w-md p-8 border-border/70 shadow-sm">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Volver al login
            </Link>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">Recuperar contraseña</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Te enviaremos un enlace para restablecer tu contraseña.
            </p>
            <form className="space-y-4 mt-6" onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@correo.com"
                  autoComplete="email"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(form.formState.errors.email)}
                  {...form.register("email")}
                />
              </div>
              <Button className="w-full h-11" type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando enlace
                  </>
                ) : (
                  "Enviar enlace"
                )}
              </Button>
            </form>
          </Card>
        </div>
        <div className="text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} SkinScan
        </div>
      </div>
      <AuthSidePanel />
    </div>
  );
}
