import { createFileRoute } from "@tanstack/react-router";

import { AnalysisController } from "@/services/analysis/analysis.controller";
import { getSupabaseAdminClient } from "@/lib/supabase.server";

async function getController() {
  const supabase = await getSupabaseAdminClient();
  return AnalysisController.fromSupabaseClient(supabase);
}

function detectContentType(url: string | null) {
  const normalized = url?.split("?")[0].toLowerCase() ?? "";

  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".gif")) return "image/gif";

  return "image/jpeg";
}

export const Route = createFileRoute("/api/analyses/$analysisId/image")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const controller = await getController();
        const detailResponse = await controller.getById({ params, request });
        const payload = (await detailResponse.json().catch(() => null)) as {
          status?: string;
          data?: { image_url?: string | null };
        } | null;

        if (!payload || payload.status !== "success" || !payload.data?.image_url) {
          return Response.json(
            { status: "error", message: "No se encontró la imagen del análisis." },
            { status: 404 },
          );
        }

        const storedUrl = new URL(payload.data.image_url);
        const base = new URL(process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL!);
        const prefix = "/storage/v1/object/sign/analysis-images/";
        if (storedUrl.origin !== base.origin || !storedUrl.pathname.startsWith(prefix))
          return new Response("Imagen antigua: requiere migración", { status: 410 });
        const client = await getSupabaseAdminClient();
        const { data: signed, error } = await client.storage
          .from("analysis-images")
          .createSignedUrl(decodeURIComponent(storedUrl.pathname.slice(prefix.length)), 300);
        if (error || !signed) return new Response("Imagen no disponible", { status: 404 });
        const imageUrl = signed.signedUrl;
        const imageResponse = await fetch(imageUrl);

        if (!imageResponse.ok) {
          return Response.json(
            { status: "error", message: "No se pudo descargar la imagen del análisis." },
            { status: 502 },
          );
        }

        const contentType =
          imageResponse.headers.get("content-type") ?? detectContentType(imageUrl);
        const bytes = await imageResponse.arrayBuffer();

        return new Response(bytes, {
          status: 200,
          headers: {
            "content-type": contentType,
            "cache-control": "private, max-age=300",
          },
        });
      },
    },
  },
});
