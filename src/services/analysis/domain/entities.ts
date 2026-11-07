export type ClientEntity = {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
};

export type LesionTypeEntity = {
  id: string;
  name: string;
  description: string;
};

export type AnalysisEntity = {
  id: string;
  client_id: string;
  patient_id: string | null;
  lesion_type_id: string;
  image_url: string | null;
  confidence: number;
  prediction_details: Record<string, number>;
  ai_interpretation: string;
  analyzed_at: string;
};

export type InferenceSuccessEntity = {
  status: "success";
  confianza_porcentajes: Record<string, number>;
  interpretacion_ia: string;
};

export type InferenceErrorEntity = {
  status: "error";
  message: string;
};

export type InferenceResponseEntity = InferenceSuccessEntity | InferenceErrorEntity;
