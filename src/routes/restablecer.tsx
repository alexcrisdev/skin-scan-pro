import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/restablecer")({ component: ResetPasswordPage });
function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const client = getSupabaseClient();
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <main className="max-w-md mx-auto p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Restablecer contraseña</h1>
      {!ready && (
        <p>Abre el enlace de recuperación enviado a tu correo. Si expiró, solicita uno nuevo.</p>
      )}
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            const { error } = await getSupabaseClient().auth.updateUser({ password });
            if (error) throw error;
            await getSupabaseClient().auth.signOut();
            await navigate({ to: "/login" });
          } catch {
            setError(
              "No se pudo actualizar la contraseña. Solicita un enlace nuevo o usa una contraseña más segura.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="new-password">Nueva contraseña (mínimo 8 caracteres)</label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={!ready || busy}
        />
        {error && <p role="alert">{error}</p>}
        <Button type="submit" disabled={!ready || busy}>
          Guardar contraseña
        </Button>
      </form>
    </main>
  );
}
