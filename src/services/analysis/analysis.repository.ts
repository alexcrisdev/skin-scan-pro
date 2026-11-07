import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnalysisEntity, ClientEntity, LesionTypeEntity } from "./domain/entities";
import { AnalysisError, NotFoundError } from "./errors";

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

function formatSupabaseError(error: SupabaseErrorLike) {
  return [error.code, error.message, error.details, error.hint].filter(Boolean).join(" - ");
}

function throwSupabaseError(context: string, error: SupabaseErrorLike): never {
  throw new AnalysisError(
    `${context}. Detalle: ${formatSupabaseError(error) || "error desconocido"}`,
  );
}

export class AnalysisRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findClientByAuthUserId(authUserId: string): Promise<ClientEntity | null> {
    const { data, error } = await this.supabase
      .from("usuarios")
      .select("id,auth_user_id,name,email")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (error) {
      throwSupabaseError("No se pudo consultar el usuario", error);
    }

    return (data as ClientEntity | null) ?? null;
  }

  async findClientById(clientId: string): Promise<ClientEntity | null> {
    const { data, error } = await this.supabase
      .from("usuarios")
      .select("id,auth_user_id,name,email")
      .eq("id", clientId)
      .maybeSingle();

    if (error) {
      throwSupabaseError("No se pudo consultar el usuario", error);
    }

    return (data as ClientEntity | null) ?? null;
  }

  async findLesionTypeByName(name: string): Promise<LesionTypeEntity | null> {
    const { data, error } = await this.supabase
      .from("lesion_types")
      .select("id,name,description")
      .eq("name", name)
      .maybeSingle();

    if (error) {
      throwSupabaseError("No se pudo consultar el tipo de lesion", error);
    }

    return (data as LesionTypeEntity | null) ?? null;
  }

  async findLesionTypeById(id: string): Promise<LesionTypeEntity | null> {
    const { data, error } = await this.supabase
      .from("lesion_types")
      .select("id,name,description")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throwSupabaseError("No se pudo consultar el tipo de lesion", error);
    }

    return (data as LesionTypeEntity | null) ?? null;
  }

  async createAnalysis(input: {
    clientId: string;
    lesionTypeId: string;
    imageUrl: string;
    confidence: number;
    predictionDetails: Record<string, number>;
    aiInterpretation: string;
    analyzedAt: string;
  }): Promise<AnalysisEntity> {
    const { data, error } = await this.supabase
      .from("analyses")
      .insert({
        client_id: input.clientId,
        patient_id: null,
        lesion_type_id: input.lesionTypeId,
        image_url: input.imageUrl,
        confidence: input.confidence,
        prediction_details: input.predictionDetails,
        ai_interpretation: input.aiInterpretation,
        analyzed_at: input.analyzedAt,
      })
      .select(
        "id,client_id,patient_id,lesion_type_id,image_url,confidence,prediction_details,ai_interpretation,analyzed_at",
      )
      .single();

    if (error) {
      throwSupabaseError("No se pudo registrar el analisis", error);
    }

    return data as AnalysisEntity;
  }

  async getAnalysisById(id: string): Promise<AnalysisEntity | null> {
    const { data, error } = await this.supabase
      .from("analyses")
      .select(
        "id,client_id,patient_id,lesion_type_id,image_url,confidence,prediction_details,ai_interpretation,analyzed_at",
      )
      .eq("id", id)
      .is("patient_id", null)
      .maybeSingle();

    if (error) {
      throwSupabaseError("No se pudo consultar el analisis", error);
    }

    return (data as AnalysisEntity | null) ?? null;
  }

  async getAnalysesByClient(clientId: string): Promise<AnalysisEntity[]> {
    const { data, error } = await this.supabase
      .from("analyses")
      .select(
        "id,client_id,patient_id,lesion_type_id,image_url,confidence,prediction_details,ai_interpretation,analyzed_at",
      )
      .eq("client_id", clientId)
      .is("patient_id", null)
      .order("analyzed_at", { ascending: false });

    if (error) {
      throwSupabaseError("No se pudo consultar los analisis del cliente", error);
    }

    return (data as AnalysisEntity[]) ?? [];
  }

  async getPaginatedHistory(input: {
    page: number;
    pageSize: number;
    clientId?: string;
  }): Promise<{ rows: AnalysisEntity[]; total: number }> {
    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;

    let query = this.supabase
      .from("analyses")
      .select(
        "id,client_id,patient_id,lesion_type_id,image_url,confidence,prediction_details,ai_interpretation,analyzed_at",
        { count: "exact" },
      )
      .is("patient_id", null)
      .order("analyzed_at", { ascending: false })
      .range(from, to);

    if (input.clientId) {
      query = query.eq("client_id", input.clientId);
    }

    const { data, error, count } = await query;

    if (error) {
      throwSupabaseError("No se pudo consultar el historial de analisis", error);
    }

    return {
      rows: (data as AnalysisEntity[]) ?? [],
      total: count ?? 0,
    };
  }

  async recordAnalysisAttempt(input: {
    clientId: string;
    mime: string;
    status: "error";
    message: string;
    attemptedAt: string;
  }) {
    const { error } = await this.supabase.from("analysis_attempts").insert({
      client_id: input.clientId,
      patient_id: null,
      mime: input.mime,
      status: input.status,
      message: input.message,
      attempted_at: input.attemptedAt,
    });

    if (error) {
      throwSupabaseError("No se pudo registrar el intento de analisis", error);
    }
  }

  assertClientFound(client: ClientEntity | null): asserts client is ClientEntity {
    if (!client) {
      throw new NotFoundError("El usuario autenticado no existe en Supabase.");
    }
  }
}
