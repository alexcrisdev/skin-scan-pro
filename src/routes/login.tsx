import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ShieldCheck, Activity, Brain, Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Logo } from "@/components/skinscan/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginFormValues } from "@/schemas/loginSchema";
import { loginUser } from "@/services/auth/login";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Iniciar sesión — SkinScan" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
      rememberSession: true,
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await loginUser(values);
      toast.success("Sesión iniciada");
      await navigate({ to: "/dashboard" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No pudimos iniciar sesion. Intenta nuevamente.";

      toast.error(message);
    }
  };

  const onInvalid = () => {
    const message =
      form.formState.errors.email?.message ??
      form.formState.errors.password?.message ??
      "Revisa los datos ingresados.";

    toast.error(message);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="flex flex-col p-8 lg:p-12">
        <Logo />
        <div className="flex-1 grid place-items-center">
          <Card className="w-full max-w-md p-8 border-border/70 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight">Bienvenido de vuelta</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Ingresa a tu cuenta de SkinScan</p>

            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
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
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Contraseña</Label>
                  <Link to="/recuperar" className="text-xs text-primary hover:underline">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(form.formState.errors.password)}
                  {...form.register("password")}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Controller
                  control={form.control}
                  name="rememberSession"
                  render={({ field }) => (
                    <Checkbox
                      id="remember"
                      checked={field.value}
                      disabled={isSubmitting}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  )}
                />{" "}
                Recordar sesión
              </label>
              <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Ingresando
                  </>
                ) : (
                  "Ingresar"
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              ¿No tienes cuenta?{" "}
              <Link to="/registro" className="text-primary font-medium hover:underline">
                Crear cuenta
              </Link>
            </p>
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

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function AuthSidePanel() {
  return (
    <div className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-primary/90 via-[oklch(0.48_0.18_255)] to-[oklch(0.4_0.2_270)] p-12 text-white flex-col justify-between">
      <div className="absolute inset-0">
        <div className="absolute top-20 -left-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-10 -right-10 h-80 w-80 rounded-full bg-[oklch(0.7_0.18_220)]/30 blur-3xl" />
      </div>
      <div className="relative">
        <div className="text-sm font-medium opacity-80">SkinScan</div>
      </div>
      <div className="relative space-y-8">
        <h2 className="text-3xl font-semibold leading-tight max-w-md">
          Inteligencia artificial al servicio de la dermatología.
        </h2>
        <p className="text-white/80 max-w-md leading-relaxed">
          Tus imágenes y tu historial personal de análisis en un solo lugar.
        </p>
        <div className="grid grid-cols-3 gap-4 max-w-md">
          {[
            { i: Brain, t: "Modelo CNN" },
            { i: Activity, t: "Resultados instantáneos" },
            { i: ShieldCheck, t: "Datos cifrados" },
          ].map((x) => (
            <div key={x.t} className="rounded-xl bg-white/10 backdrop-blur p-4">
              <x.i className="h-5 w-5" />
              <div className="mt-2 text-xs font-medium">{x.t}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="relative text-xs text-white/60">
        Tu espacio personal para el seguimiento de tu piel
      </div>
    </div>
  );
}
