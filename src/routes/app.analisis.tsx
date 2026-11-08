import { createFileRoute } from "@tanstack/react-router";
import { getIdToken } from "@/lib/auth";
import { MAX_ANALYSIS_IMAGE_BYTES } from "@/lib/analysis-limits";
import { getLesionName } from "@/lib/lesion-names";
import {
  Camera,
  Calendar,
  CheckCircle2,
  Circle,
  ImageIcon,
  Loader2,
  RotateCcw,
  Shield,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader, StatusBadge } from "@/components/skinscan/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import type { AnalysisCreateResponseDto, AnalysisResponseDto } from "@/services/analysis/dtos";

export const Route = createFileRoute("/app/analisis")({
  head: () => ({ meta: [{ title: "Nuevo analisis - SkinScan" }] }),
  component: AnalysisPage,
});

type Phase = "idle" | "preview" | "analyzing" | "done";

const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_ORIGINAL_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const COMPRESSED_IMAGE_MIME = "image/jpeg";
const COMPRESSED_IMAGE_QUALITY = 0.8;
const COMPRESSED_IMAGE_MAX_WIDTH = 800;

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.readAsDataURL(file);
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo cargar la imagen para comprimirla."));
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo comprimir la imagen."));
          return;
        }

        resolve(blob);
      },
      type,
      quality,
    );
  });
}

async function compressImage(file: File): Promise<File> {
  const image = await loadImage(file);
  const scale =
    image.width > COMPRESSED_IMAGE_MAX_WIDTH ? COMPRESSED_IMAGE_MAX_WIDTH / image.width : 1;
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("El navegador no permite comprimir la imagen con canvas.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, COMPRESSED_IMAGE_MIME, COMPRESSED_IMAGE_QUALITY);
  const outputName = file.name.replace(/\.[^.]+$/, "") || "lesion";

  return new File([blob], `${outputName}.jpg`, {
    type: COMPRESSED_IMAGE_MIME,
    lastModified: Date.now(),
  });
}

async function procesarYEnviarImagen(file: File) {
  if (file.size > MAX_ORIGINAL_IMAGE_SIZE_BYTES) {
    throw new Error("Maximo 5 MB.");
  }

  const compressedFile = await compressImage(file);
  if (compressedFile.size > MAX_ANALYSIS_IMAGE_BYTES) {
    throw new Error("La imagen comprimida excede 3 MiB. Utiliza una imagen de menor tamaño.");
  }
  const base64 = await fileToBase64(compressedFile);
  return {
    base64,
    optimizedFile: compressedFile,
  };
}

async function uploadOptimizedAnalysisImage(file: File, userUid: string) {
  const client = getSupabaseClient();
  const path = `${userUid}/${crypto.randomUUID()}.jpg`;
  const { error } = await client.storage
    .from("analysis-images")
    .upload(path, file, { contentType: COMPRESSED_IMAGE_MIME });
  if (error) throw new Error("No se pudo guardar la imagen del análisis.");
  const { data, error: signedError } = await client.storage
    .from("analysis-images")
    .createSignedUrl(path, 3600);
  if (signedError) throw new Error("No se pudo acceder a la imagen.");
  return data.signedUrl;
}

function formatPercent(value: number) {
  return `${Number(value.toFixed(2))}%`;
}

function AnalysisPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [image, setImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResponseDto | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFile = (file?: File) => {
    if (!file) return;

    if (!allowedMimeTypes.includes(file.type)) {
      toast.error("Formato no permitido. Usa JPG, JPEG o WEBP.");
      return;
    }

    if (file.size > MAX_ORIGINAL_IMAGE_SIZE_BYTES) {
      toast.error("Maximo 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      setSelectedFile(file);
      setResult(null);
      setPhase("preview");
    };
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (!selectedFile) return;

    const sessionUser = getAppAuth().currentUser;

    if (!sessionUser) {
      toast.error("Inicia sesion para crear un analisis.");
      return;
    }

    setPhase("analyzing");

    try {
      const { base64, optimizedFile } = await procesarYEnviarImagen(selectedFile);
      const [token, imageUrl] = await Promise.all([
        getIdToken(sessionUser),
        uploadOptimizedAnalysisImage(optimizedFile, sessionUser.uid),
      ]);
      const response = await fetch("/api/analyses", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          mime: COMPRESSED_IMAGE_MIME,
          image: base64,
          image_url: imageUrl,
        }),
      });

      const payload = (await response.json()) as AnalysisCreateResponseDto;

      if (payload.status === "error") {
        toast.error(payload.message);
        setPhase("preview");
        return;
      }

      if (!response.ok) {
        toast.error("No se pudo completar el analisis.");
        setPhase("preview");
        return;
      }

      setResult(payload.data);
      setPhase("done");
      toast.success("Analisis completado y guardado.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo procesar la imagen.";
      toast.error(message);
      setPhase("preview");
    }
  };

  const reset = () => {
    setImage(null);
    setSelectedFile(null);
    setResult(null);
    setPhase("idle");
  };

  const predictionEntries = result
    ? Object.entries(result.prediction_details).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div>
      <PageHeader
        title="Nuevo analisis"
        description="Sube o captura una imagen dermatologica para iniciar el analisis IA."
        actions={
          phase === "done" && (
            <Button variant="outline" onClick={reset} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Nuevo
            </Button>
          )
        }
      />

      <div className="grid lg:grid-cols-5 gap-5">
        <Card className="lg:col-span-3 p-6 border-border/70">
          <h3 className="font-semibold">Imagen</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Formatos: JPG, JPEG, WEBP. Max 5 MB.
          </p>

          {!image && (
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleFile(event.dataTransfer.files?.[0]);
              }}
              className="mt-5 rounded-md border-2 border-dashed border-border bg-muted/30 p-10 text-center transition hover:border-primary/60 hover:bg-primary/5"
            >
              <div className="mx-auto h-14 w-14 rounded-md bg-primary/10 grid place-items-center text-primary">
                <Upload className="h-7 w-7" />
              </div>
              <h4 className="mt-4 font-medium">Arrastra y suelta la imagen aqui</h4>
              <p className="text-sm text-muted-foreground mt-1">
                o selecciona un archivo desde tu dispositivo
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button onClick={() => inputRef.current?.click()} className="gap-2">
                  <ImageIcon className="h-4 w-4" /> Seleccionar archivo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => cameraRef.current?.click()}
                  className="gap-2"
                >
                  <Camera className="h-4 w-4" /> Usar camara
                </Button>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/webp"
                hidden
                onChange={(event) => handleFile(event.target.files?.[0] ?? undefined)}
              />
              <input
                ref={cameraRef}
                type="file"
                accept="image/jpeg,image/jpg,image/webp"
                capture="environment"
                hidden
                onChange={(event) => handleFile(event.target.files?.[0] ?? undefined)}
              />
            </div>
          )}

          {image && (
            <div className="mt-5 space-y-4">
              <div className="relative rounded-md overflow-hidden border border-border/70 bg-muted/30">
                <img
                  src={image}
                  alt="Lesion a analizar"
                  className="w-full max-h-[480px] object-contain bg-black/5"
                />
                <button
                  onClick={reset}
                  className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/90 backdrop-blur grid place-items-center hover:bg-background border border-border/70"
                  aria-label="Quitar imagen"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
                {phase === "analyzing" && (
                  <div className="absolute inset-0 bg-background/75 backdrop-blur-sm grid place-items-center">
                    <div className="text-center max-w-xs w-full px-6">
                      <div className="inline-flex items-center gap-2 text-sm font-medium">
                        <Loader2 className="h-4 w-4 text-primary animate-spin" /> Analizando imagen
                      </div>
                      <Progress value={66} className="mt-4" />
                      <p className="mt-3 text-xs text-muted-foreground">
                        Procesando con el servicio de inferencia dermatologica
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {phase === "preview" && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Button onClick={analyze} className="gap-2">
                      <Sparkles className="h-4 w-4" /> Iniciar analisis IA
                    </Button>
                    <Button variant="outline" onClick={reset}>
                      Cambiar imagen
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2 p-6 border-border/70">
          <h3 className="font-semibold">Resultado</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Informacion generada por IA</p>

          {!result ? (
            <div className="mt-10 text-center py-10">
              <div className="mx-auto h-14 w-14 rounded-md bg-muted grid place-items-center text-muted-foreground">
                <Sparkles className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Aun no hay resultado.
                <br />
                Sube una imagen para comenzar.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Tipo detectado</div>
                  <div className="text-lg font-semibold mt-0.5">
                    {getLesionName(result.lesion_name, result.lesion_description)}
                  </div>
                </div>
                <StatusBadge status="Completado" />
              </div>

              <div className="rounded-md border border-border/70 p-4">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-muted-foreground">Confianza</span>
                  <span className="font-semibold text-foreground">
                    {formatPercent(result.confidence)}
                  </span>
                </div>
                <Progress value={result.confidence} />
              </div>

              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">Probabilidades</div>
                <div className="space-y-2">
                  {predictionEntries.map(([code, value], index) => (
                    <div
                      key={code}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 text-xs"
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        {index === 0 ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 break-words leading-relaxed">
                          {getLesionName(code)}
                        </span>
                      </div>
                      <span className="text-right text-muted-foreground tabular-nums">
                        {formatPercent(value)}
                      </span>
                      <div className="col-span-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full", index === 0 ? "bg-primary" : "bg-primary/50")}
                          style={{ width: `${Math.min(value, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="rounded-md border border-border/70 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3" /> Fecha
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {new Date(result.analyzed_at).toLocaleDateString("es-PE")}
                  </div>
                </div>
                <div className="rounded-md border border-border/70 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Shield className="h-3 w-3" /> Estado
                  </div>
                  <div className="mt-1 text-sm font-medium">Guardado</div>
                </div>
              </div>

              <div className="rounded-md bg-muted/50 border border-border/60 p-3 text-[11px] text-muted-foreground leading-relaxed">
                <Badge variant="secondary" className="mb-1.5 text-[10px]">
                  Interpretacion IA
                </Badge>
                <p className="whitespace-pre-wrap">{result.ai_interpretation}</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
