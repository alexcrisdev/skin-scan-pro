import { useEffect, useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resendSignupConfirmation } from "@/services/auth/register";

export function EmailConfirmationNotice({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    if (sending || cooldown > 0) return;
    setSending(true);
    setFeedback("");
    setFailed(false);
    try {
      await resendSignupConfirmation(email);
      setFeedback("Solicitud enviada. Revisa tu bandeja de entrada y spam.");
      setCooldown(60);
    } catch (error) {
      setFailed(true);
      setFeedback(error instanceof Error ? error.message : "No se pudo reenviar el correo.");
      setCooldown(60);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-primary/20 bg-primary/5 p-4 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <MailCheck className="h-4 w-4 shrink-0" /> Confirma tu correo antes de ingresar
      </p>
      <p className="text-muted-foreground">
        Busca el correo de confirmación en <strong className="break-all">{email}</strong> y abre su
        enlace. Revisa también la carpeta de spam.
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={() => void resend()}
        disabled={sending || cooldown > 0}
        className="h-auto min-h-9 w-full whitespace-normal"
      >
        {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {sending
          ? "Solicitando correo…"
          : cooldown > 0
            ? `Volver a solicitar en ${cooldown} s`
            : "Reenviar correo de confirmación"}
      </Button>
      {feedback && (
        <p
          role={failed ? "alert" : "status"}
          className={failed ? "text-destructive" : "text-muted-foreground"}
        >
          {feedback}
        </p>
      )}
    </div>
  );
}
