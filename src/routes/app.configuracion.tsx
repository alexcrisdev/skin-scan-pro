import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/skinscan/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export const Route = createFileRoute("/app/configuracion")({
  head: () => ({ meta: [{ title: "Configuración — SkinScan" }] }),
  component: ConfigPage,
});

const TOGGLES = [
  { t: "Notificaciones por correo", d: "Resultados de análisis y resumen semanal." },
  { t: "Notificaciones push", d: "Alertas en tiempo real en el navegador." },
  { t: "Boletines médicos", d: "Novedades de IA y dermatología." },
  { t: "Autenticación en dos pasos", d: "Añade una capa extra de seguridad a tu cuenta." },
];

function ConfigPage() {
  return (
    <div>
      <PageHeader title="Configuración" description="Personaliza la plataforma a tu medida." />

      <Card className="p-6 border-border/70">
        <h3 className="font-semibold">Preferencias</h3>
        <div className="mt-5 divide-y divide-border/70">
          {TOGGLES.map((x, i) => (
            <div key={x.t} className="flex items-start justify-between py-4 gap-4">
              <div>
                <Label className="font-medium">{x.t}</Label>
                <p className="text-xs text-muted-foreground mt-1">{x.d}</p>
              </div>
              <Switch defaultChecked={i < 2} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 border-border/70 mt-5">
        <h3 className="font-semibold">Idioma y región</h3>
        <Separator className="my-4" />
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div><div className="text-muted-foreground text-xs">Idioma</div><div className="mt-1 font-medium">Español (Perú)</div></div>
          <div><div className="text-muted-foreground text-xs">Zona horaria</div><div className="mt-1 font-medium">GMT-5 Lima</div></div>
        </div>
      </Card>

      <Card className="p-6 border-destructive/30 mt-5">
        <h3 className="font-semibold text-destructive">Zona de peligro</h3>
        <p className="text-sm text-muted-foreground mt-1">Eliminar la cuenta es permanente. Toda tu información se borrará.</p>
        <Button variant="destructive" className="mt-4" onClick={() => toast.error("Acción simulada")}>Eliminar cuenta</Button>
      </Card>
    </div>
  );
}
