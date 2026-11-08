import { useAnalysisImage } from "@/hooks/use-analysis-image";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { getAppAuth, getIdToken } from "@/lib/auth";
import { getLesionName } from "@/lib/lesion-names";
import { onAuthStateChanged } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import { PageHeader } from "@/components/skinscan/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { downloadAnalysisPdf } from "@/lib/pdf/analysis-pdf";
import {
  Download,
  Search,
  Filter,
  MoreHorizontal,
  FileX2,
  Loader2,
  X,
  CalendarDays,
  ShieldCheck,
  Brain,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/app/historial")({
  head: () => ({ meta: [{ title: "Historial — SkinScan" }] }),
  component: HistorialPage,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Analysis {
  id: string;
  image_url: string;
  confidence: number;
  analyzed_at: string | null;
  created_at: string | null;
  ai_interpretation: string | null;
  prediction_details: Record<string, number>;
  lesion_types: {
    name: string;
    description: string;
  } | null;
}

// ─── Clasificación visual por tipo de lesión ──────────────────────────────────

type LesionStatus = "Benigno" | "Maligno";

interface LesionClassification {
  status: LesionStatus;
  label: string;
}

const LESION_CLASSIFICATION_MAP: Record<string, LesionClassification> = {
  vasc: { status: "Benigno", label: "Benigno" },
  nv: { status: "Benigno", label: "Benigno" },
  df: { status: "Benigno", label: "Benigno" },
  bkl: { status: "Benigno", label: "Benigno" },
  mel: { status: "Maligno", label: "Maligno" },
  bcc: { status: "Maligno", label: "Maligno" },
  akiec: { status: "Maligno", label: "Maligno" },
};

function classifyLesion(lesionCode: string | null | undefined): LesionClassification {
  if (!lesionCode) return { status: "Benigno", label: "Benigno" };
  return (
    LESION_CLASSIFICATION_MAP[lesionCode.toLowerCase()] ?? {
      status: "Benigno",
      label: "Benigno",
    }
  );
}

// ─── Badge de estado derivado ─────────────────────────────────────────────────

const STATUS_STYLES: Record<LesionStatus, string> = {
  Benigno:
    "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800",
  Maligno:
    "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-800",
};

function DerivedStatusBadge({
  lesionName,
  size = "sm",
}: {
  lesionName: string | null | undefined;
  size?: "sm" | "md";
}) {
  const { status, label } = classifyLesion(lesionName);
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${
        size === "md" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs"
      } ${STATUS_STYLES[status]}`}
    >
      {label}
    </span>
  );
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function shortId(uuid: string): string {
  return `AN-${uuid.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

// ─── Thumbnail con fallback ────────────────────────────────────────────────────

function AnalysisThumbnail({ url, className = "h-10 w-10" }: { url: string; className?: string }) {
  const resolvedUrl = useAnalysisImage(url);
  const [error, setError] = useState(false);
  useEffect(() => setError(false), [resolvedUrl]);

  if (!resolvedUrl || error) {
    return (
      <div
        className={`rounded-lg bg-gradient-to-br from-primary/20 to-accent/40 shrink-0 ${className}`}
      />
    );
  }

  return (
    <img
      src={resolvedUrl!}
      alt="Lesión analizada"
      onError={() => setError(true)}
      className={`rounded-lg object-cover shrink-0 ${className}`}
    />
  );
}

// ─── Hook principal ────────────────────────────────────────────────────────────

function useAnalysisHistory(statusFilter: string, searchQuery: string, page: number) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("Usuario");
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAppAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setClientId(null);
        setAnalyses([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      const supabase = getSupabaseClient();
      const { data, error: clientError } = await supabase
        .from("usuarios")
        .select("id, name")
        .eq("auth_user_id", user.uid)
        .maybeSingle();

      if (clientError || !data) {
        setError("No se encontró tu perfil. Contacta soporte.");
        setLoading(false);
        return;
      }

      setClientId(data.id);
      setUserName(data.name ?? user.displayName ?? "Usuario");
    });

    return () => unsub();
  }, []);

  const fetchAnalyses = useCallback(async () => {
    if (!clientId) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("analyses")
        .select(
          `
          id,
          image_url,
          confidence,
          analyzed_at,
          created_at,
          ai_interpretation,
          prediction_details,
          lesion_types ( name, description )
        `,
        )
        .eq("client_id", clientId)
        .is("patient_id", null)
        .order("created_at", { ascending: false })
        .returns<Analysis[]>();

      if (fetchError) throw fetchError;

      let results: Analysis[] = (data ?? []).map((item) => ({
        id: item.id,
        image_url: item.image_url,
        confidence: item.confidence,
        analyzed_at: item.analyzed_at,
        created_at: item.created_at,
        ai_interpretation: item.ai_interpretation ?? null,
        prediction_details: item.prediction_details ?? {},
        lesion_types: item.lesion_types
          ? {
              name: item.lesion_types.name,
              description: item.lesion_types.description,
            }
          : null,
      }));

      if (statusFilter !== "todos") {
        results = results.filter((r) => {
          const { status } = classifyLesion(r.lesion_types?.name);
          return status.toLowerCase() === statusFilter.toLowerCase();
        });
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        results = results.filter(
          (r) =>
            getLesionName(r.lesion_types?.name, r.lesion_types?.description)
              .toLowerCase()
              .includes(q) || shortId(r.id).toLowerCase().includes(q),
        );
      }

      const filteredTotal = results.length;
      results = results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

      setAnalyses(results);
      setTotalCount(filteredTotal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el historial.");
    } finally {
      setLoading(false);
    }
  }, [clientId, statusFilter, searchQuery, page]);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  return {
    analyses,
    totalCount,
    loading,
    error,
    refetch: fetchAnalyses,
    userName,
    clientId,
  };
}

// ─── Sheet de detalle ─────────────────────────────────────────────────────────

function AnalysisDetailSheet({
  analysis,
  userName,
  open,
  onClose,
  onExportPDF,
}: {
  analysis: Analysis | null;
  userName: string;
  open: boolean;
  onClose: () => void;
  onExportPDF: (id: string) => void;
}) {
  if (!analysis) return null;

  const { status } = classifyLesion(analysis.lesion_types?.name);
  const ownerLabel = userName;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col p-0 gap-0 [&>button:first-child]:hidden"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/70 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-semibold">Detalle del análisis</SheetTitle>
            <button
              onClick={onClose}
              className="h-7 w-7 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{shortId(analysis.id)}</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pt-5">
            <AnalysisThumbnail url={analysis.image_url} className="w-full h-52 rounded-xl" />
          </div>

          <div className="px-6 pt-5 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="h-9 w-9 rounded-full bg-primary/15 grid place-items-center shrink-0">
                <span className="text-sm font-semibold text-primary">
                  {ownerLabel.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Titular de la cuenta</p>
                <p className="text-sm font-medium">{ownerLabel}</p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wide font-medium">
                Resultado
              </p>
              <p className="font-semibold text-base">
                {getLesionName(analysis.lesion_types?.name, analysis.lesion_types?.description)}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Confianza del modelo
                </p>
                <span className="text-sm font-semibold tabular-nums">
                  {Number(analysis.confidence).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    status === "Maligno" ? "bg-red-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${analysis.confidence}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <p className="text-xs uppercase tracking-wide font-medium">Fecha</p>
                </div>
                <p className="text-sm font-medium">
                  {formatDate(analysis.analyzed_at ?? analysis.created_at)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <p className="text-xs uppercase tracking-wide font-medium">Estado</p>
                </div>
                <DerivedStatusBadge lesionName={analysis.lesion_types?.name} size="md" />
              </div>
            </div>

            <Separator />

            {Object.keys(analysis.prediction_details ?? {}).length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium">
                  Métricas
                </p>
                <div className="space-y-3">
                  {Object.entries(analysis.prediction_details)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([label, value]) => (
                      <div key={label}>
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="min-w-0 break-words text-sm font-medium">
                            {getLesionName(label)}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {Number(value).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              label.toLowerCase().includes("mel") ||
                              label.toLowerCase().includes("bcc")
                                ? "bg-red-500"
                                : "bg-primary"
                            }`}
                            style={{ width: `${Math.max(Number(value), 5)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <Separator />

            {analysis.ai_interpretation && (
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-3">
                  <Brain className="h-3.5 w-3.5" />
                  <p className="text-xs uppercase tracking-wide font-medium">Interpretación IA</p>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed prose-headings:text-sm prose-headings:font-semibold prose-li:my-0.5 prose-p:my-1.5">
                  <ReactMarkdown>{analysis.ai_interpretation}</ReactMarkdown>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              ⚠️ Este análisis es orientativo y no reemplaza un diagnóstico médico profesional.
              Consulta siempre con un dermatólogo.
            </div>

            <div className="h-4" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border/70 shrink-0">
          <Button
            className="w-full gap-2"
            variant="outline"
            onClick={() => onExportPDF(analysis.id)}
          >
            <Download className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

function HistorialPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [page, setPage] = useState(0);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // ── NUEVO: estado para confirmación de eliminación ──
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(0);
  };
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(0);
  };
  const openDetail = (analysis: Analysis) => {
    setSelectedAnalysis(analysis);
    setSheetOpen(true);
  };

  const { analyses, totalCount, loading, error, refetch, userName, clientId } = useAnalysisHistory(
    statusFilter,
    searchQuery,
    page,
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const queryAnalysesForExport = async (clientId: string) => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("analyses")
      .select(
        `
        id,
        image_url,
        confidence,
        analyzed_at,
        created_at,
        ai_interpretation,
        prediction_details,
        lesion_types ( name, description )
      `,
      )
      .eq("client_id", clientId)
      .is("patient_id", null)
      .order("created_at", { ascending: false })
      .returns<Analysis[]>();

    if (error) throw error;

    return (data ?? []).map((item) => ({
      id: item.id,
      image_url: item.image_url,
      confidence: item.confidence,
      analyzed_at: item.analyzed_at,
      created_at: item.created_at,
      ai_interpretation: item.ai_interpretation ?? null,
      prediction_details: item.prediction_details ?? {},
      lesion_types: item.lesion_types
        ? {
            name: item.lesion_types.name,
            description: item.lesion_types.description,
          }
        : null,
    })) as Analysis[];
  };

  const handleExportHistoryPDF = async () => {
    if (!clientId) {
      toast.error("No se pudo identificar tu perfil para exportar el historial.");
      return;
    }

    const loadingToast = toast.loading("Generando PDF del historial…");

    try {
      const allAnalyses = await queryAnalysesForExport(clientId);

      if (!allAnalyses.length) {
        toast.error("No hay análisis para exportar.");
        return;
      }

      await downloadAnalysisPdf({
        title: "Historial de Análisis",
        subtitle: "Exportación completa con datos reales desde Supabase",
        userName,
        analyses: allAnalyses,
        fileName: "historial-de-analisis.pdf",
      });

      toast.success("PDF del historial generado.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo generar el PDF.";
      toast.error(message);
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleExportSinglePDF = async (analysisId: string) => {
    const loadingToast = toast.loading("Generando PDF del análisis…");

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("analyses")
        .select(
          `
          id,
          client_id,
          image_url,
          confidence,
          analyzed_at,
          created_at,
          ai_interpretation,
          prediction_details,
          lesion_types ( name, description )
        `,
        )
        .eq("id", analysisId)
        .is("patient_id", null)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error("No se encontró el análisis solicitado.");
        return;
      }

      if (clientId && data.client_id && data.client_id !== clientId) {
        toast.error("No tienes permisos para exportar este análisis.");
        return;
      }

      const lesionType = Array.isArray(data.lesion_types)
        ? (data.lesion_types[0] ?? null)
        : data.lesion_types;

      await downloadAnalysisPdf({
        title: "Detalle del Análisis",
        subtitle: shortId(analysisId),
        userName,
        analyses: [
          {
            id: data.id,
            image_url: data.image_url,
            confidence: data.confidence,
            analyzed_at: data.analyzed_at,
            created_at: data.created_at,
            ai_interpretation: data.ai_interpretation ?? null,
            prediction_details: data.prediction_details ?? {},
            lesion_types: lesionType
              ? {
                  name: lesionType.name,
                  description: lesionType.description,
                }
              : null,
          },
        ],
        fileName: `${shortId(analysisId).toLowerCase()}.pdf`,
      });

      toast.success("PDF del análisis generado.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo generar el PDF.";
      toast.error(message);
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  // ── NUEVO: abre el dialog de confirmación ──
  const requestDelete = (analysisId: string) => setDeleteId(analysisId);

  // ── NUEVO: ejecuta el borrado tras confirmar ──
  const confirmDelete = async () => {
    if (!deleteId || deleting) return;
    setDeleting(true);
    try {
      const token = await getIdToken();
      const response = await fetch(`/api/analyses/${deleteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.status !== "success") {
        throw new Error(
          result?.message || "No se pudo eliminar el análisis. Inténtalo nuevamente.",
        );
      }
      toast.success("Análisis eliminado.");
      if (selectedAnalysis?.id === deleteId) {
        setSheetOpen(false);
        setSelectedAnalysis(null);
      }
      setDeleteId(null);
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el análisis.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Historial de análisis"
        description="Consulta, busca y exporta tus análisis previos."
        actions={
          <Button variant="outline" className="gap-2" onClick={handleExportHistoryPDF}>
            <Download className="h-4 w-4" />
            Exportar PDF
          </Button>
        }
      />

      <Card className="border-border/70">
        {/* Barra de filtros */}
        <div className="p-4 flex flex-col md:flex-row gap-3 md:items-center justify-between border-b border-border/70">
          <div className="relative md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-9"
              placeholder="Buscar por lesión o ID…"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="Benigno">Benigno</SelectItem>
                <SelectItem value="Maligno">Maligno</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cargando */}
        {loading && (
          <div className="py-20 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Cargando historial…</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="py-20 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-destructive/10 grid place-items-center text-destructive">
              <FileX2 className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-medium">Ocurrió un error</h3>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        )}

        {/* Sin resultados */}
        {!loading && !error && analyses.length === 0 && (
          <div className="py-20 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-muted grid place-items-center text-muted-foreground">
              <FileX2 className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-medium">Sin resultados</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery || statusFilter !== "todos"
                ? "Ajusta los filtros o realiza un nuevo análisis."
                : "Aún no tienes análisis. ¡Comienza tu primer escaneo!"}
            </p>
          </div>
        )}

        {/* Tabla desktop */}
        {!loading && !error && analyses.length > 0 && (
          <>
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imagen</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Confianza</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analyses.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => openDetail(r)}>
                      <TableCell>
                        <AnalysisThumbnail url={r.image_url} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {getLesionName(r.lesion_types?.name, r.lesion_types?.description)}
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {shortId(r.id)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 w-32">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${r.confidence}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium tabular-nums">
                            {Number(r.confidence).toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(r.analyzed_at ?? r.created_at)}
                      </TableCell>
                      <TableCell>
                        <DerivedStatusBadge lesionName={r.lesion_types?.name} />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetail(r)}>
                              Ver detalle
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportSinglePDF(r.id)}>
                              Exportar PDF
                            </DropdownMenuItem>
                            {/* ── CAMBIADO: llama a requestDelete en vez de handleDelete ── */}
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => requestDelete(r.id)}
                            >
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Lista móvil */}
            <div className="md:hidden divide-y divide-border/70">
              {analyses.map((r) => (
                <div
                  key={r.id}
                  className="p-4 flex gap-3 cursor-pointer active:bg-muted/50"
                  onClick={() => openDetail(r)}
                >
                  <AnalysisThumbnail url={r.image_url} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 break-words font-medium text-sm">
                        {getLesionName(r.lesion_types?.name, r.lesion_types?.description)}
                      </div>
                      <DerivedStatusBadge lesionName={r.lesion_types?.name} />
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                      {shortId(r.id)}
                    </div>
                    {<div className="text-xs text-muted-foreground mt-1 truncate">{userName}</div>}
                    <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                      <span>{formatDate(r.analyzed_at ?? r.created_at)}</span>
                      <span>{Number(r.confidence).toFixed(1)}% confianza</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Paginación */}
            <div className="p-4 border-t border-border/70 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{totalCount} análisis en total</p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setPage((p) => Math.max(0, p - 1));
                      }}
                      aria-disabled={page === 0}
                      className={page === 0 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink
                        href="#"
                        isActive={i === page}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(i);
                        }}
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setPage((p) => Math.min(totalPages - 1, p + 1));
                      }}
                      aria-disabled={page >= totalPages - 1}
                      className={page >= totalPages - 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </>
        )}
      </Card>

      {/* Sheet de detalle — sin cambios */}
      <AnalysisDetailSheet
        analysis={selectedAnalysis}
        userName={userName}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onExportPDF={handleExportSinglePDF}
      />

      {/* ── NUEVO: Dialog de confirmación de eliminación ── */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && !deleting && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar análisis</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar el análisis{" "}
              <span className="font-semibold text-foreground font-mono">
                {deleteId ? shortId(deleteId) : ""}
              </span>
              ? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deleting ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
