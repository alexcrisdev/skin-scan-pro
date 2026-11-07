import { useAnalysisImage } from "@/hooks/use-analysis-image";
import { Link } from "@tanstack/react-router";
import { onAuthStateChanged } from "@/lib/auth";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  Plus,
  ScanLine,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAppAuth } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type TimeRange = "7d" | "30d" | "90d" | "12m";
type LesionStatus = "Benigno" | "Maligno";

type RecentAnalysis = {
  id: string;
  image_url: string | null;
  confidence: number;
  analyzed_at: string | null;
  created_at: string | null;
  prediction_details: Record<string, number> | null;
  lesion_types: {
    name: string;
    description: string;
  } | null;
};

type AnalysisAttempt = {
  status: string;
  message: string;
  mime: string;
  attempted_at: string;
};

type DashboardData = {
  clientId: string | null;
  userName: string;
  analyses: RecentAnalysis[];
  attempts: AnalysisAttempt[];
  analysesCount: number;
  lastSyncAt: string | null;
};

type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
  icon: typeof ScanLine;
  iconClassName: string;
  progress?: number;
  trend?: string;
  to?: string;
  actionButton?: { label: string; to: string };
};

const LESION_CLASSIFICATION_MAP: Record<string, LesionStatus> = {
  vasc: "Benigno",
  nv: "Benigno",
  df: "Benigno",
  bkl: "Benigno",
  mel: "Maligno",
  bcc: "Maligno",
  akiec: "Maligno",
};

const CHART_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function classifyLesion(code: string | null | undefined): LesionStatus {
  if (!code) return "Benigno";
  return LESION_CLASSIFICATION_MAP[code.toLowerCase()] ?? "Benigno";
}

const STATUS_STYLES: Record<LesionStatus, string> = {
  Benigno:
    "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800",
  Maligno:
    "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-800",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "Ahora mismo";
  if (minutes < 60) return `Hace ${minutes} min`;
  if (hours < 24) return `Hace ${hours} hora${hours > 1 ? "s" : ""}`;
  if (days < 7) return `Hace ${days} día${days > 1 ? "s" : ""}`;

  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function Thumbnail({ url }: { url: string | null }) {
  const resolvedUrl = useAnalysisImage(url);
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [resolvedUrl]);
  if (!resolvedUrl || err) {
    return (
      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/20 to-accent/40 shrink-0" />
    );
  }
  return (
    <img
      src={resolvedUrl!}
      alt="Lesión"
      onError={() => setErr(true)}
      className="h-9 w-9 rounded-lg object-cover shrink-0"
    />
  );
}

function shortId(uuid: string) {
  return `AN-${uuid.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function formatRelative(iso: string | null) {
  if (!iso) return "—";

  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Ahora mismo";
  if (minutes < 60) return `Hace ${minutes} min`;
  if (hours < 24) return `Hace ${hours} h`;
  if (days < 7) return `Hace ${days} d`;

  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short" }).format(new Date(iso));
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toIsoDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getRangeDays(range: TimeRange) {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return 365;
}

function groupAnalysesByDay(analyses: RecentAnalysis[], range: TimeRange) {
  const days = getRangeDays(range);
  const end = new Date();
  const start = addDays(new Date(end), -(days - 1));
  const map = new Map<string, number>();
  const labels: Array<{ date: string; label: string }> = [];

  for (let index = 0; index < days; index += 1) {
    const current = addDays(start, index);
    const key = toIsoDayKey(current);
    map.set(key, 0);
    labels.push({
      date: key,
      label: new Intl.DateTimeFormat("es-PE", { month: "short", day: "numeric" }).format(current),
    });
  }

  analyses.forEach((analysis) => {
    const timestamp = analysis.analyzed_at ?? analysis.created_at;
    if (!timestamp) return;
    const date = new Date(timestamp);
    if (date < start || date > end) return;
    const key = toIsoDayKey(date);
    map.set(key, (map.get(key) ?? 0) + 1);
  });

  return labels.map((item) => ({ ...item, count: map.get(item.date) ?? 0 }));
}

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

function formatSupabaseError(error: SupabaseErrorLike) {
  return [error.code, error.message, error.details, error.hint].filter(Boolean).join(" - ");
}

function getErrorMessage(caught: unknown) {
  if (caught instanceof Error) return caught.message;
  if (caught && typeof caught === "object" && "message" in caught) {
    const message = (caught as SupabaseErrorLike).message;
    if (typeof message === "string" && message.length > 0) {
      return formatSupabaseError(caught as SupabaseErrorLike);
    }
  }
  return "No se pudo cargar el inicio.";
}

function getDistribution(analyses: RecentAnalysis[]) {
  const statusCounts = analyses.reduce(
    (acc, analysis) => {
      const status = classifyLesion(analysis.lesion_types?.name);
      acc[status] += 1;
      return acc;
    },
    { Benigno: 0, Maligno: 0 } as Record<LesionStatus, number>,
  );

  const lesionCounts = analyses.reduce<Record<string, number>>((acc, analysis) => {
    const label = analysis.lesion_types?.description ?? "Desconocido";
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  return {
    statusSeries: [
      { label: "Benigno", value: statusCounts.Benigno },
      { label: "Maligno", value: statusCounts.Maligno },
    ],
    lesionSeries: Object.entries(lesionCounts)
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 5),
  };
}

const EMPTY_DASHBOARD: DashboardData = {
  clientId: null,
  userName: "Usuario",
  analyses: [],
  attempts: [],
  analysesCount: 0,
  lastSyncAt: null,
};

function useDashboardOverview() {
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let generation = 0;
    const unsubscribe = onAuthStateChanged(getAppAuth(), async (user) => {
      const version = ++generation;
      setData(EMPTY_DASHBOARD);
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabaseClient();
        const { data: profile, error: profileError } = await supabase
          .from("usuarios")
          .select("id,name")
          .eq("auth_user_id", user.uid)
          .single();
        if (profileError || !profile) throw new Error("No se pudo cargar tu perfil.");
        const [analysesResult, attemptsResult] = await Promise.all([
          supabase
            .from("analyses")
            .select(
              "id,image_url,confidence,analyzed_at,created_at,prediction_details,lesion_types(name,description)",
              { count: "exact" },
            )
            .eq("client_id", profile.id)
            .is("patient_id", null)
            .order("created_at", { ascending: false })
            .limit(500),
          supabase
            .from("analysis_attempts")
            .select("status,message,mime,attempted_at")
            .eq("client_id", profile.id)
            .is("patient_id", null)
            .order("attempted_at", { ascending: false })
            .limit(10),
        ]);
        if (analysesResult.error) throw analysesResult.error;
        const analyses = (analysesResult.data ?? []).map((item) => ({
          ...item,
          confidence: Number(item.confidence),
          lesion_types: Array.isArray(item.lesion_types)
            ? (item.lesion_types[0] ?? null)
            : item.lesion_types,
        })) as RecentAnalysis[];
        if (active && version === generation)
          setData({
            clientId: profile.id,
            userName: profile.name ?? user.displayName ?? "Usuario",
            analyses,
            analysesCount: analysesResult.count ?? analyses.length,
            attempts: (attemptsResult.data ?? []) as AnalysisAttempt[],
            lastSyncAt: new Date().toISOString(),
          });
      } catch (caught) {
        if (active && version === generation) setError(getErrorMessage(caught));
      } finally {
        if (active && version === generation) setLoading(false);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return { data, loading, error };
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  iconClassName,
  progress,
  trend,
  to,
  actionButton,
}: MetricCardProps) {
  const body = (
    <Card className="group relative flex h-full flex-col overflow-hidden border-border/70 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-start justify-between gap-4">
        <div
          className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", iconClassName)}
        >
          <Icon className="h-5 w-5" />
        </div>
        {trend ? (
          <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">
            {trend}
          </Badge>
        ) : null}
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 text-sm text-muted-foreground">{label}</div>
      {detail ? <div className="mt-2 text-xs text-muted-foreground">{detail}</div> : null}
      {typeof progress === "number" ? (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Progreso</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={Math.min(100, Math.max(progress, 0))} className="h-2" />
        </div>
      ) : null}
      {actionButton ? (
        <Link to={actionButton.to} className="mt-auto pt-4">
          <Button size="sm" variant="outline" className="h-8 w-full text-xs">
            {actionButton.label}
          </Button>
        </Link>
      ) : null}
      {to ? (
        <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-muted-foreground/70 transition group-hover:text-primary" />
      ) : null}
    </Card>
  );

  if (actionButton) return body;

  return to ? (
    <Link to={to} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="border-border/70 p-5 shadow-sm shadow-black/[0.02] sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <Skeleton className="h-44 w-full rounded-2xl sm:h-52" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="border-border/70 p-5">
            <Skeleton className="h-11 w-11 rounded-2xl" />
            <Skeleton className="mt-4 h-6 w-28" />
            <Skeleton className="mt-2 h-4 w-24" />
            <Skeleton className="mt-4 h-2 w-full rounded-full" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="border-border/70 p-6 lg:col-span-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-56" />
          <Skeleton className="mt-6 h-[220px] w-full rounded-2xl sm:h-[280px]" />
        </Card>
        <Card className="border-border/70 p-6">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-2 h-4 w-48" />
          <Skeleton className="mt-6 h-[200px] w-full rounded-2xl sm:h-[240px]" />
        </Card>
      </div>
      <Card className="border-border/70 p-6">
        <Skeleton className="h-5 w-36" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </Card>
    </div>
  );
}

function WeeklyAnalysesChart({ analyses }: { analyses: RecentAnalysis[] }) {
  const [range, setRange] = useState<TimeRange>("30d");
  const data = useMemo(() => groupAnalysesByDay(analyses, range), [analyses, range]);
  const maxValue = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Análisis por día</p>
          <p className="text-xs text-muted-foreground">Evolución de tus análisis</p>
        </div>
        <Select value={range} onValueChange={(value) => setRange(value as TimeRange)}>
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 días</SelectItem>
            <SelectItem value="30d">Últimos 30 días</SelectItem>
            <SelectItem value="90d">Últimos 90 días</SelectItem>
            <SelectItem value="12m">Último año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="h-[220px] rounded-2xl border border-border/70 bg-gradient-to-br from-background to-muted/20 p-3 sm:h-[280px] lg:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,.24)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              tickMargin={10}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              width={24}
              domain={[0, Math.max(5, Math.ceil(maxValue / 5) * 5)]}
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const value = payload[0].value as number;
                return (
                  <div className="rounded-xl border border-border/70 bg-background/95 px-3 py-2 shadow-xl backdrop-blur-sm">
                    <p className="text-xs font-medium">{label}</p>
                    <p className="text-sm text-primary">{value} análisis</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="count" radius={[10, 10, 6, 6]} maxBarSize={28}>
              {data.map((entry, index) => (
                <Cell key={entry.date} fill={index === data.length - 1 ? "#2563eb" : "#60a5fa"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DistributionPanel({ analyses }: { analyses: RecentAnalysis[] }) {
  const { statusSeries, lesionSeries } = useMemo(() => getDistribution(analyses), [analyses]);
  const total = analyses.length;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Distribución de análisis</p>
        <p className="text-xs text-muted-foreground">Clasificación y tipos detectados</p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-background to-muted/20 p-3">
        <div className="h-[260px] sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusSeries}
                dataKey="value"
                nameKey="label"
                innerRadius={72}
                outerRadius={105}
                paddingAngle={4}
              >
                {statusSeries.map((entry, index) => (
                  <Cell key={entry.label} fill={index === 0 ? CHART_COLORS[1] : CHART_COLORS[3]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as { label: string; value: number };
                  const pct = total ? Math.round((item.value / total) * 100) : 0;
                  return (
                    <div className="rounded-xl border border-border/70 bg-background/95 px-3 py-2 shadow-xl backdrop-blur-sm">
                      <p className="text-xs font-medium">{item.label}</p>
                      <p className="text-sm text-primary">
                        {item.value} análisis · {pct}%
                      </p>
                    </div>
                  );
                }}
              />
              <Legend verticalAlign="bottom" height={28} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-2">
        {lesionSeries.length > 0 ? (
          lesionSeries.map((item, index) => {
            const pct = total ? Math.round((item.value / total) * 100) : 0;
            return (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2.5 transition hover:border-primary/30 hover:shadow-sm"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  <span className="text-sm">{item.label}</span>
                </div>
                <span className="whitespace-nowrap text-xs font-medium text-muted-foreground shrink-0">
                  {item.value} ({pct}%)
                </span>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            Aún no hay análisis suficientes para mostrar la distribución.
          </div>
        )}
      </div>
    </div>
  );
}

function RecentActivitySection() {
  const [analyses, setAnalyses] = useState<RecentAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAppAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAnalyses([]);
        setLoading(false);
        return;
      }

      const supabase = getSupabaseClient();

      const { data: userData } = await supabase
        .from("usuarios")
        .select("id")
        .eq("auth_user_id", user.uid)
        .maybeSingle();

      if (!userData?.id) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("analyses")
        .select(
          `
          id,
          image_url,
          confidence,
          analyzed_at,
          created_at,
          lesion_types ( name, description )
        `,
        )
        .eq("client_id", userData.id)
        .is("patient_id", null)
        .order("created_at", { ascending: false })
        .limit(5);

      setAnalyses(
        (data ?? []).map((item: any) => ({
          id: item.id,
          image_url: item.image_url ?? null,
          confidence: item.confidence,
          analyzed_at: item.analyzed_at,
          created_at: item.created_at,
          prediction_details: null,
          lesion_types: item.lesion_types
            ? { name: item.lesion_types.name, description: item.lesion_types.description }
            : null,
        })),
      );
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <Card className="border-border/70 p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Actividad reciente</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Tus últimos análisis</p>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!loading && analyses.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aún no tienes análisis. ¡Comienza tu primer escaneo!
        </p>
      )}

      {!loading && analyses.length > 0 && (
        <div className="divide-y divide-border/70">
          {analyses.map((r) => {
            const status = classifyLesion(r.lesion_types?.name);
            const timestamp = r.analyzed_at ?? r.created_at;

            return (
              <div key={r.id} className="flex items-center gap-3 py-2.5 sm:gap-4">
                <Thumbnail url={r.image_url} />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {r.lesion_types?.description ?? "Desconocido"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {Number(r.confidence).toFixed(1)}% confianza
                  </div>
                </div>

                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
                >
                  {status}
                </span>

                <div className="hidden whitespace-nowrap text-xs text-muted-foreground sm:block">
                  {timeAgo(timestamp)}
                </div>

                <Link
                  to="/app/historial"
                  className="shrink-0 whitespace-nowrap text-xs font-medium text-primary hover:underline"
                >
                  Ver
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 border-t border-border/70 pt-3 text-center">
        <Link
          to="/app/historial"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Ver historial completo
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}

export function DashboardHome() {
  const { data, loading, error } = useDashboardOverview();
  const monthCount = useMemo(
    () =>
      data.analyses.filter((item) => {
        const timestamp = item.analyzed_at ?? item.created_at;
        if (!timestamp) return false;
        const date = new Date(timestamp),
          now = new Date();
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      }).length,
    [data.analyses],
  );
  if (loading) return <LoadingSkeleton />;
  if (error)
    return (
      <Card className="border-destructive/20 p-6">
        <p role="alert">{error}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </Card>
    );
  const metrics: MetricCardProps[] = [
    {
      label: "Análisis registrados",
      value: String(data.analysesCount),
      detail: "Historial de tu cuenta",
      icon: ScanLine,
      iconClassName: "bg-primary/10 text-primary",
      to: "/app/historial",
    },
    {
      label: "Actividad de este mes",
      value: String(monthCount),
      detail: "En los últimos 500 registros",
      icon: Activity,
      iconClassName: "bg-emerald-500/10 text-emerald-600",
      to: "/app/historial",
    },
    {
      label: "Mi perfil",
      value: data.userName,
      detail: "Mi información personal",
      icon: Users,
      iconClassName: "bg-violet-500/10 text-violet-600",
      to: "/app/perfil",
    },
  ];
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-blue-800 via-blue-700 to-blue-600 p-6 sm:p-8 text-white">
        <Badge className="bg-white/10 text-white border-white/20">Panel de control</Badge>
        <h1 className="mt-4 text-3xl font-semibold">Hola, {data.userName}</h1>
        <p className="mt-3 max-w-2xl text-blue-100">
          Analiza tus imágenes de la piel y consulta tu historial personal en un solo lugar.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild className="bg-white text-blue-900 hover:bg-blue-50">
            <Link to="/app/analisis">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo análisis
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="bg-blue-900/40 border-blue-300/30 text-white"
          >
            <Link to="/app/historial">Mi historial</Link>
          </Button>
        </div>
      </section>
      <div className="grid sm:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 p-5">
          <WeeklyAnalysesChart analyses={data.analyses} />
        </Card>
        <Card className="p-5">
          <DistributionPanel analyses={data.analyses} />
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">
        Los gráficos muestran hasta los últimos 500 análisis. Los resultados de la CNN requieren
        evaluación profesional.
      </p>
      <RecentActivitySection />
    </div>
  );
}
