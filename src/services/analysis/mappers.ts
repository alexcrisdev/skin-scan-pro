import { lesionNameDescriptions, type AnalysisResponseDto } from "./dtos";
import type { AnalysisEntity, LesionTypeEntity } from "./domain/entities";

export function mapAnalysisToDto(
  analysis: AnalysisEntity,
  lesionType?: LesionTypeEntity | null,
): AnalysisResponseDto {
  const lesionName = lesionType?.name;

  return {
    id: analysis.id,
    client_id: analysis.client_id,
    patient_id: analysis.patient_id,
    lesion_type_id: analysis.lesion_type_id,
    lesion_name: lesionName,
    lesion_description:
      lesionType?.description ?? (lesionName ? lesionNameDescriptions[lesionName] : undefined),
    image_url: analysis.image_url,
    confidence: analysis.confidence,
    prediction_details: analysis.prediction_details,
    ai_interpretation: analysis.ai_interpretation,
    analyzed_at: analysis.analyzed_at,
  };
}
