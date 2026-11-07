import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { onAuthStateChanged, signOut } from "@/lib/auth";
import { useEffect, useState, type ReactNode } from "react";
import {
  BotMessageSquare,
  CreditCard,
  History,
  Home,
  LogOut,
  Menu,
  Receipt,
  ScanLine,
  Search,
  Settings,
  User,
  Users,
} from "lucide-react";

import { Logo } from "@/components/skinscan/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { getAppAuth, type User as AppUser } from "@/lib/auth";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
  badge?: number;
};

const NAV: NavItem[] = [
  { to: "/app", label: "Inicio", icon: Home, exact: true },
  { to: "/app/analisis", label: "Nuevo análisis", icon: ScanLine },
  { to: "/app/historial", label: "Historial", icon: History },
  { to: "/app/perfil", label: "Perfil", icon: User },
  //{ to: "/app/configuracion", label: "Configuración", icon: Settings },
];

const MOBILE_NAV: NavItem[] = [
  { to: "/app", label: "Inicio", icon: Home, exact: true },
  { to: "/app/analisis", label: "Análisis", icon: ScanLine },
  { to: "/app/historial", label: "Historial", icon: History },
  { to: "/app/perfil", label: "Perfil", icon: User },
];

function SidebarContent() {
  const { pathname } = useLocation();
  const navItems = NAV;

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 h-16 flex items-center border-b border-sidebar-border">
        <Logo to="/app" />
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        <div className="px-2 pt-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Menú
        </div>
        {navItems.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function MobileBottomNav() {
  const { pathname } = useLocation();
  const navItems = MOBILE_NAV;

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around px-1 h-16">
        {navItems.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="relative">
                <item.icon className="h-5 w-5" />
                {item.badge != null && item.badge > 0 && (
                  <span className="absolute -top-0.5 -right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                )}
              </span>
              <span className="truncate max-w-[4.5rem]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppLayout() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const auth = getAppAuth();
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (sessionUser) => {
      if (!active) return;
      setUser(sessionUser);
      setAuthReady(true);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    const auth = getAppAuth();
    await signOut(auth);
    setUser(null);
    await navigate({ to: "/login", replace: true });
  };

  const userDisplayName = user?.displayName || user?.email?.split("@")[0] || "Vista previa";
  const avatarInitials = userDisplayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (!authReady) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-sm text-muted-foreground">Validando sesión...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-sidebar border-r border-sidebar-border flex-col">
        <SidebarContent />
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 h-16 bg-background/80 backdrop-blur-xl border-b border-border/60 flex items-center gap-3 px-4 sm:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SidebarContent />
            </SheetContent>
          </Sheet>

          <div className="ml-auto flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="relative w-full max-w-md min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en mis análisis…"
                className="pl-9 h-9 w-full bg-muted/50 border-transparent focus-visible:bg-background"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-muted transition">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                        {avatarInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:block text-left">
                      <div className="text-xs font-medium leading-tight">{userDisplayName}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {user ? "Mi cuenta" : "Sin sesión"}
                      </div>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/app/perfil">
                      <User className="h-4 w-4 mr-2" />
                      Perfil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {user ? (
                    <DropdownMenuItem onSelect={() => void handleLogout()}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Cerrar sesión
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem asChild>
                      <Link to="/login">Iniciar sesión</Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-24 lg:pb-8">
          {!user && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
              <p>
                Vista previa del panel. Inicia sesión para guardar tu historial y ejecutar análisis.
              </p>
              <Button asChild size="sm">
                <Link to="/login">Iniciar sesión</Link>
              </Button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function StatusBadge({
  status,
}: {
  status: "Benigno" | "Sospechoso" | "Maligno" | "Pendiente" | "No clasificado" | "Completado";
}) {
  const map: Record<string, string> = {
    Benigno: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20",
    Sospechoso: "bg-amber-500/15 text-amber-700 border-amber-500/20",
    Maligno: "bg-red-500/15 text-red-700 border-red-500/20",
    Pendiente: "bg-blue-500/15 text-blue-700 border-blue-500/20",
    "No clasificado": "bg-muted text-muted-foreground border-border",
    Completado: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20",
  };
  return (
    <Badge variant="outline" className={`border ${map[status]} font-medium`}>
      {status}
    </Badge>
  );
}
