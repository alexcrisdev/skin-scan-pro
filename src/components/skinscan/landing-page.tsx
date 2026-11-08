import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Logo } from "@/components/skinscan/logo";
import {
  Upload,
  ScanLine,
  Sparkles,
  ShieldCheck,
  Smartphone,
  History,
  Users,
  Activity,
  ArrowRight,
  Stethoscope,
  Brain,
  Zap,
  Lock,
  BarChart3,
  ChevronRight,
} from "lucide-react";

function Nav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <a href="#inicio" className="hover:text-foreground transition">
            Inicio
          </a>
          <a href="#como-funciona" className="hover:text-foreground transition">
            Cómo funciona
          </a>
          <a href="#beneficios" className="hover:text-foreground transition">
            Beneficios
          </a>
          <a href="#preguntas-frecuentes" className="hover:text-foreground transition">
            Preguntas frecuentes
          </a>
          <a href="#contacto" className="hover:text-foreground transition">
            Contacto
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="shadow-sm shadow-primary/30">
            <Link to="/login">Iniciar sesión</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link to="/registro">Crear cuenta</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="inicio" className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[1100px] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/15 via-accent/30 to-transparent blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,160,255,0.08),transparent_50%)]" />
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-24 lg:pt-24 lg:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Badge
              variant="secondary"
              className="mb-5 gap-1.5 rounded-full border border-border/80 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              IA dermatológica de nueva generación
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground leading-[1.05]">
              Análisis preliminar de{" "}
              <span className="bg-gradient-to-r from-primary to-[oklch(0.6_0.2_260)] bg-clip-text text-transparent">
                lesiones cutáneas
              </span>{" "}
              mediante IA
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
              Analiza imágenes de lesiones cutáneas con inteligencia artificial y consulta tu
              historial personal para facilitar el seguimiento de tu piel.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 px-6 shadow-md shadow-primary/30">
                <Link to="/login">
                  Iniciar sesión <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6">
                <Link to="/registro">Crear cuenta</Link>
              </Button>
            </div>
            <p className="mt-4 max-w-xl text-sm text-muted-foreground">
              Evaluación orientativa. No sustituye el diagnóstico de un dermatólogo.
            </p>
            <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
              {[
                { v: "7", l: "Categorías de lesión" },
                { v: "CNN", l: "Análisis con IA" },
                { v: "Personal", l: "Tu historial" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="text-2xl font-semibold tracking-tight text-foreground">{s.v}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}

function DashboardMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-gradient-to-tr from-primary/10 to-accent/40 rounded-3xl blur-2xl" />
      <Card className="relative overflow-hidden rounded-2xl border-border/70 shadow-2xl shadow-primary/10 p-0">
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border/70 bg-muted/40">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
          <div className="ml-3 text-xs text-muted-foreground">Vista ilustrativa del panel</div>
        </div>
        <div className="p-5 grid sm:grid-cols-5 gap-4 bg-background">
          <div className="sm:col-span-2 rounded-xl border border-border/70 bg-muted/30 aspect-square grid place-items-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[conic-gradient(from_120deg_at_50%_50%,oklch(0.85_0.08_240),oklch(0.7_0.13_30),oklch(0.85_0.08_240))] opacity-60" />
            <div className="absolute inset-6 rounded-full bg-[radial-gradient(circle,oklch(0.55_0.18_30),oklch(0.35_0.12_25))] shadow-inner" />
            <div className="relative z-10 h-full w-full border-2 border-dashed border-primary/60 rounded-xl" />
          </div>
          <div className="min-w-0 sm:col-span-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Resultado del análisis</div>
                <div className="text-base font-semibold mt-0.5">Nevo melanocítico</div>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 border border-emerald-500/20">
                Benigno
              </Badge>
            </div>
            <div className="rounded-lg border border-border/70 p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Confianza</span>
                <span className="font-medium text-foreground">94.2%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full w-[94%] rounded-full bg-gradient-to-r from-primary to-[oklch(0.65_0.16_200)]" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { l: "Lesiones", v: "248" },
                { l: "Este mes", v: "32" },
                { l: "Mi perfil", v: "Personal" },
              ].map((x) => (
                <div key={x.l} className="rounded-lg border border-border/70 p-2.5">
                  <div className="text-sm font-semibold">{x.v}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{x.l}</div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-border/70 p-3 space-y-1.5">
              {[
                ["Queratosis benigna", 3.2],
                ["Carcinoma basocelular", 1.5],
                ["Melanoma", 1.1],
              ].map(([l, w]) => (
                <div key={l as string} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 break-words text-muted-foreground">{l}</span>
                  <div className="w-12 shrink-0 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${w}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-foreground/70">{w}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
      <Card className="absolute -bottom-6 -left-6 hidden md:flex items-center gap-3 px-4 py-3 shadow-xl shadow-primary/10 border-border/70 rounded-xl">
        <div className="h-9 w-9 rounded-lg bg-emerald-500/15 grid place-items-center text-emerald-600">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Tus imágenes</div>
          <div className="text-sm font-medium">Almacenamiento privado</div>
        </div>
      </Card>
      <Card className="absolute -top-4 -right-4 hidden md:flex items-center gap-3 px-4 py-3 shadow-xl shadow-primary/10 border-border/70 rounded-xl">
        <div className="h-9 w-9 rounded-lg bg-primary/15 grid place-items-center text-primary">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Resultado</div>
          <div className="text-sm font-medium">Orientativo</div>
        </div>
      </Card>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      i: Upload,
      t: "Sube la imagen",
      d: "Arrastra y suelta la fotografía de la lesión, o captúrala desde la cámara del móvil.",
    },
    {
      i: Brain,
      t: "La IA analiza",
      d: "Una red neuronal convolucional analiza la imagen y calcula las probabilidades por categoría.",
    },
    {
      i: ScanLine,
      t: "Obtén el resultado",
      d: "Recibe el tipo de lesión detectada, porcentaje de confianza y registro automático.",
    },
  ];
  return (
    <section id="como-funciona" className="py-24 border-t border-border/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <Badge variant="secondary" className="rounded-full">
            Cómo funciona
          </Badge>
          <h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight">
            Tres pasos para tu análisis preliminar
          </h2>
          <p className="mt-4 text-muted-foreground">
            Un flujo simple para llevar un registro personal de tu piel.
          </p>
        </div>
        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {steps.map((s, idx) => (
            <Card
              key={s.t}
              className="p-6 border-border/70 relative group hover:shadow-lg hover:shadow-primary/5 transition"
            >
              <div className="absolute top-6 right-6 text-5xl font-bold text-muted/60">
                0{idx + 1}
              </div>
              <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center">
                <s.i className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.d}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  const items = [
    {
      i: Zap,
      t: "Análisis accesible",
      d: "Sube una imagen y consulta su clasificación orientativa.",
    },
    { i: Smartphone, t: "Acceso móvil", d: "Captura imágenes directamente desde el celular." },
    { i: History, t: "Historial personal", d: "Tus análisis centralizados y accesibles." },
    { i: Users, t: "Mi perfil", d: "Tu cuenta y tus análisis en un solo lugar." },
    {
      i: Brain,
      t: "Inteligencia artificial",
      d: "Modelo CNN para clasificar siete categorías de lesiones.",
    },
    { i: Activity, t: "Interfaz intuitiva", d: "Diseñada para tu seguimiento personal." },
  ];
  return (
    <section
      id="beneficios"
      className="py-24 bg-gradient-to-b from-transparent to-muted/30 border-t border-border/60"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <Badge variant="secondary" className="rounded-full">
            Beneficios
          </Badge>
          <h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight">
            Diseñado para tu seguimiento personal
          </h2>
        </div>
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((b) => (
            <Card key={b.t} className="p-6 border-border/70 hover:border-primary/40 transition">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <b.i className="h-5 w-5" />
              </div>
              <div className="mt-4 font-semibold">{b.t}</div>
              <div className="mt-1.5 text-sm text-muted-foreground">{b.d}</div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function PreviewSection() {
  return (
    <section className="py-24 border-t border-border/60 bg-gradient-to-b from-muted/30 to-transparent">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <Badge variant="secondary" className="rounded-full">
            Plataforma
          </Badge>
          <h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight">
            Un panel para tu seguimiento personal
          </h2>
          <p className="mt-4 text-muted-foreground">
            Tus análisis y tu historial en una sola vista.
          </p>
        </div>
        <div className="mt-14 grid lg:grid-cols-3 gap-5">
          {[
            {
              i: BarChart3,
              t: "Panel personal",
              d: "Resumen de tus análisis y actividad reciente.",
            },
            { i: Stethoscope, t: "Mi perfil", d: "Tus datos personales y tu historial." },
            { i: History, t: "Historial", d: "Búsqueda, filtros y exportación PDF." },
          ].map((c) => (
            <Card key={c.t} className="p-6 border-border/70 overflow-hidden">
              <div className="aspect-[4/3] rounded-xl border border-border/70 bg-gradient-to-br from-muted/40 to-background grid place-items-center mb-5">
                <c.i className="h-14 w-14 text-primary/70" strokeWidth={1.3} />
              </div>
              <div className="font-semibold">{c.t}</div>
              <div className="mt-1 text-sm text-muted-foreground">{c.d}</div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    {
      q: "¿Cómo funciona el análisis de IA?",
      a: "Subes una imagen de la lesión y nuestro modelo basado en redes neuronales convolucionales procesa la imagen para clasificarla, devolviendo el tipo detectado y un porcentaje de confianza.",
    },
    {
      q: "¿Qué tan precisa es la IA?",
      a: "La precisión debe evaluarse con imágenes independientes del entrenamiento. La clasificación es una herramienta de apoyo y no reemplaza la evaluación de un profesional de salud.",
    },
    {
      q: "¿Mis datos están seguros?",
      a: "Tus imágenes se guardan en almacenamiento privado y el historial está asociado a tu cuenta. Debes iniciar sesión para consultar tus análisis.",
    },
    {
      q: "¿Funciona en el móvil?",
      a: "Sí. Puedes capturar imágenes directamente desde la cámara de tu celular y todo el panel está optimizado para móvil.",
    },
  ];
  return (
    <section id="preguntas-frecuentes" className="py-24 border-t border-border/60">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Badge variant="secondary" className="rounded-full">
            FAQ
          </Badge>
          <h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight">
            Preguntas frecuentes
          </h2>
        </div>
        <Accordion type="single" collapsible className="mt-10 w-full">
          {items.map((it, i) => (
            <AccordionItem key={i} value={`it-${i}`} className="border-border/70">
              <AccordionTrigger className="text-left text-base font-medium hover:no-underline">
                {it.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {it.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-20 border-t border-border/60">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Card className="relative overflow-hidden p-10 md:p-14 border-border/70 bg-gradient-to-br from-primary/10 via-background to-accent/40">
          <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <h3 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Empieza a analizar imágenes hoy
              </h3>
              <p className="mt-2 text-muted-foreground">
                Crea tu cuenta personal para analizar tus imágenes y consultar tu historial.
              </p>
            </div>
            <Button asChild size="lg" className="h-12 px-7">
              <Link to="/registro">
                Crear cuenta <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="contacto" className="border-t border-border/60 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 grid md:grid-cols-4 gap-10">
        <div>
          <Logo />
          <p className="mt-4 text-sm text-muted-foreground max-w-xs">
            Plataforma de apoyo al análisis preliminar de lesiones cutáneas mediante inteligencia
            artificial.
          </p>
        </div>
        {[
          {
            t: "Plataforma",
            l: [
              { label: "Cómo funciona", href: "#como-funciona" },
              { label: "Beneficios", href: "#beneficios" },
            ],
          },
          {
            t: "Tu cuenta",
            l: [
              { label: "Iniciar sesión", href: "/login" },
              { label: "Crear cuenta", href: "/registro" },
            ],
          },
          {
            t: "Información",
            l: [
              { label: "Propósito", href: "#inicio" },
              { label: "Preguntas frecuentes", href: "#preguntas-frecuentes" },
            ],
          },
        ].map((c) => (
          <div key={c.t}>
            <div className="text-sm font-semibold">{c.t}</div>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              {c.l.map((x) => (
                <li key={x.href}>
                  <a href={x.href} className="hover:text-foreground">
                    {x.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} SkinScan. Todos los derechos reservados.</span>
          <div className="flex items-center gap-4">
            <Lock className="h-3.5 w-3.5" />
            <span>Historial personal e imágenes privadas</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <HowItWorks />
      <Benefits />
      <PreviewSection />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}
