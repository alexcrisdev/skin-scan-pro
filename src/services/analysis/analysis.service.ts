import type { AnalysisRepository } from "./analysis.repository";
import {
  lesionNameDescriptions,
  type AnalysisHistoryQueryDto,
  type AnalysisResponseDto,
  type CreateAnalysisRequestDto,
  type PaginatedAnalysisResponseDto,
} from "./dtos";
import type { ClientEntity, LesionTypeEntity } from "./domain/entities";
import { DermatologyInferenceClient } from "./inference.repository";
import { ForbiddenError, NotFoundError } from "./errors";
import { mapAnalysisToDto } from "./mappers";

function findTopPrediction(predictionDetails: Record<string, number>) {
  const entries = Object.entries(predictionDetails);

  if (!entries.length) {
    throw new NotFoundError("La inferencia no devolvio probabilidades de lesion.");
  }

  return entries.reduce((max, current) => (current[1] > max[1] ? current : max), entries[0]);
}

export class AnalysisService {
  constructor(
    private readonly repository: AnalysisRepository,
    private readonly inferenceClient = new DermatologyInferenceClient(),
  ) {}

  private async mapWithLesion(analysis: Parameters<typeof mapAnalysisToDto>[0]) {
    const lesionType = await this.repository.findLesionTypeById(analysis.lesion_type_id);
    return mapAnalysisToDto(analysis, lesionType);
  }

  async createAnalysis(
    authUserId: string,
    input: CreateAnalysisRequestDto,
  ): Promise<
    { status: "success"; data: AnalysisResponseDto } | { status: "error"; message: string }
  > {
    const client = await this.repository.findClientByAuthUserId(authUserId);
    this.repository.assertClientFound(client);

    const inference = await this.inferenceClient.predict(input);

    if (inference.status === "error") {
      await this.repository.recordAnalysisAttempt({
        clientId: client.id,
        mime: input.mime,
        status: "error",
        message: inference.message,
        attemptedAt: new Date().toISOString(),
      });

      return {
        status: "error",
        message: inference.message,
      };
    }

    const [lesionName, confidence] = findTopPrediction(inference.confianza_porcentajes);
    const lesionType = await this.repository.findLesionTypeByName(lesionName);

    if (!lesionType) {
      throw new NotFoundError(
        `No existe lesion_type para el nombre "${lesionName}" (${lesionNameDescriptions[lesionName] ?? "sin descripcion"}).`,
      );
    }

    const analyzedAt = new Date().toISOString();
    const analysis = await this.repository.createAnalysis({
      clientId: client.id,
      lesionTypeId: lesionType.id,
      imageUrl: input.image_url,
      confidence,
      predictionDetails: inference.confianza_porcentajes,
      aiInterpretation: inference.interpretacion_ia,
      analyzedAt,
    });

    return {
      status: "success",
      data: mapAnalysisToDto(analysis, lesionType as LesionTypeEntity),
    };
  }

  async getAnalysisById(id: string) {
    const analysis = await this.repository.getAnalysisById(id);

    if (!analysis || analysis.patient_id) {
      throw new NotFoundError("El analisis no existe.");
    }

    return {
      status: "success" as const,
      data: await this.mapWithLesion(analysis),
    };
  }

  async getAnalysesByClient(clientId: string) {
    const client = await this.repository.findClientById(clientId);

    if (!client) {
      throw new NotFoundError("El cliente no existe.");
    }

    const rows = await this.repository.getAnalysesByClient(clientId);
    const data = await Promise.all(rows.map((row) => this.mapWithLesion(row)));

    return {
      status: "success" as const,
      data,
    };
  }

  async getHistory(query: AnalysisHistoryQueryDto): Promise<PaginatedAnalysisResponseDto> {
    const pageSize = query.page_size;
    const result = await this.repository.getPaginatedHistory({
      page: query.page,
      pageSize,
      clientId: query.client_id,
    });

    const data = await Promise.all(result.rows.map((row) => this.mapWithLesion(row)));

    return {
      status: "success",
      data,
      pagination: {
        page: query.page,
        page_size: pageSize,
        total: result.total,
        total_pages: Math.ceil(result.total / pageSize),
      },
    };
  }
}
