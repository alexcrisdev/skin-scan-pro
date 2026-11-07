import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/skinscan/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { getAppAuth, type User as AppUser } from "@/lib/auth";
import { onAuthStateChanged } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";

export const Route = createFileRoute("/app/perfil")({
  head: () => ({ meta: [{ title: "Perfil — SkinScan" }] }),
  component: PerfilPage,
});

type Profile = { name: string; email: string; created_at: string | null };

function PerfilPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const auth = getAppAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setProfile(null);

      if (currentUser) {
        try {
          const supabase = getSupabaseClient();

          // Usamos la tabla 'usuarios' con la columna 'auth_user_id' para enlazar con Supabase Auth
          const { data, error } = await supabase
            .from("usuarios")
            .select("name,email,created_at")
            .eq("auth_user_id", currentUser.uid)
            .maybeSingle();

          if (error) {
            console.warn("Aviso controlado de Supabase:", error.message);
          }

          if (data) {
            setProfile(data);
          }
        } catch (err) {
          console.error("Error al obtener perfil de Supabase:", err);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    const formData = new FormData(e.currentTarget);

    // Mapeamos los datos únicamente a las columnas reales de tu tabla 'usuarios'
    const updatedData = {
      name: formData.get("name") as string,
    };

    try {
      const supabase = getSupabaseClient();

      const { error } = await supabase
        .from("usuarios")
        .update({
          name: formData.get("name") as string,
        })
        .eq("auth_user_id", user.uid);

      if (error) throw error;

      setProfile((prev) => (prev ? { ...prev, name: String(formData.get("name") ?? "") } : null));
      toast.success("Perfil actualizado con éxito");
    } catch (err) {
      console.error("Error al actualizar el perfil:", err);
      toast.error("Hubo un error al guardar los cambios.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] grid place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const name = profile?.name || user?.displayName || "Mi cuenta";
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div>
      <PageHeader title="Mi perfil" description="Administra tu información personal y de cuenta." />

      <div className="grid lg:grid-cols-3 gap-5">
        {/* TARJETA IZQUIERDA */}
        <Card className="lg:col-span-1 p-6 border-border/70 text-center">
          <div className="relative inline-block">
            <Avatar className="h-24 w-24 mx-auto">
              <AvatarFallback className="bg-primary/15 text-primary text-2xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-md">
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <h3 className="mt-4 font-semibold">{name}</h3>
          <Separator className="my-5" />
          <div className="space-y-3 text-left text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Miembro desde</span>
              <span className="font-medium">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString("es-ES", {
                      month: "short",
                      year: "numeric",
                    })
                  : "---"}
              </span>
            </div>
          </div>
        </Card>

        {/* TARJETA DERECHA - FORMULARIO AJUSTADO A TU BASE DE DATOS */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-6 border-border/70">
            <h3 className="font-semibold">Información personal</h3>
            <form className="mt-5 space-y-4" onSubmit={handleSave}>
              <div className="space-y-2">
                <Label htmlFor="name">Nombre Completo</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={name}
                  placeholder="Tu nombre"
                  disabled={!user}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={user?.email || profile?.email || ""}
                  disabled
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                />
              </div>
              <div className="pt-2">
                <Button type="submit" disabled={saving || !user}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
