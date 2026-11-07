import { z } from "zod";

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const lesionNameDescriptions: Record<string, string> = {
  nv: "Nevus",
  mel: "Melanoma",
  bkl: "Queratosis benigna",
  bcc: "Carcinoma basocelular",
  akiec: "Queratosis actinica",
  vasc: "Lesion vascular",
  df: "Dermatofibroma",
};

export const createAnalysisRequestSchema = z
  .object({
    mime: z.enum(ALLOWED_IMAGE_MIME_TYPES),
    image_url: z.string().url("La URL publica de la imagen no es valida."),
    image: z
      .string()
      .min(1, "La imagen es obligatoria.")
      .max(5592408, "La imagen comprimida excede 4 MiB.")
      .refine(
        (value) => !value.startsWith("data:"),
        "La imagen debe enviarse en Base64 sin Data URI.",
      ),
  })
  .strict();

export const analysisIdParamsSchema = z.object({
  analysisId: z.string().uuid(),
});

export const clientIdParamsSchema = z.object({
  clientId: z.string().uuid(),
});

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  client_id: z.string().uuid().optional(),
});

export const inferenceResponseSchema = z.union([
  z.object({
    status: z.literal("success"),
    confianza_porcentajes: z
      .record(
        z.enum(["nv", "mel", "bkl", "bcc", "akiec", "vasc", "df"]),
        z.number().finite().min(0).max(100),
      )
      .refine((v) => Object.keys(v).length > 0, "Faltan probabilidades."),
    interpretacion_ia: z.string().default("Clasificación CNN. Requiere evaluación profesional."),
  }),
  z.object({
    status: z.literal("error"),
    message: z.string().min(1),
  }),
]);

export type CreateAnalysisRequestDto = z.infer<typeof createAnalysisRequestSchema>;
export type AnalysisHistoryQueryDto = z.infer<typeof historyQuerySchema>;

export type AnalysisResponseDto = {
  id: string;
  client_id: string;
  patient_id: string | null;
  lesion_type_id: string;
  lesion_name?: string;
  lesion_description?: string;
  image_url: string | null;
  confidence: number;
  prediction_details: Record<string, number>;
  ai_interpretation: string;
  analyzed_at: string;
};

export type AnalysisCreateResponseDto =
  | {
      status: "success";
      data: AnalysisResponseDto;
    }
  | {
      status: "error";
      message: string;
    };

export type PaginatedAnalysisResponseDto = {
  status: "success";
  data: AnalysisResponseDto[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};
