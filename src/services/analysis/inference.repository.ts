import { inferenceResponseSchema, type CreateAnalysisRequestDto } from "./dtos";
import { AnalysisError } from "./errors";
import type { InferenceResponseEntity } from "./domain/entities";
export class DermatologyInferenceClient {
  async predict(input: CreateAnalysisRequestDto): Promise<InferenceResponseEntity> {
    const endpoint = process.env.SKINSCAN_INFERENCE_URL;
    if (!endpoint) throw new AnalysisError("El modelo CNN aún no está configurado.", 503);
    const timeout = Number(process.env.SKINSCAN_INFERENCE_TIMEOUT_MS || 70000);
    if (!Number.isFinite(timeout) || timeout < 1 || timeout > 300000)
      throw new AnalysisError("Tiempo de espera de inferencia inválido.");
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.SKINSCAN_INFERENCE_API_KEY
            ? { Authorization: `Bearer ${process.env.SKINSCAN_INFERENCE_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({ mime: input.mime, image: input.image }),
        signal: AbortSignal.timeout(timeout),
      });
    } catch {
      throw new AnalysisError(
        "El modelo CNN no está disponible o excedió el tiempo de espera.",
        503,
      );
    }
    if (!response.ok) throw new AnalysisError("El servicio CNN no pudo procesar la imagen.", 502);
    const parsed = inferenceResponseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success)
      throw new AnalysisError("El servicio CNN devolvió una respuesta inválida.", 502);
    return parsed.data;
  }
}
