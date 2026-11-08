// Spanish display names for the seven HAM10000 categories.
// Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC6091241/
export const LESION_NAMES: Readonly<Record<string, string>> = {
  nv: "Nevo melanocítico",
  mel: "Melanoma",
  bkl: "Queratosis benigna",
  bcc: "Carcinoma basocelular",
  akiec: "Queratosis actínica y carcinoma intraepitelial",
  vasc: "Lesión vascular",
  df: "Dermatofibroma",
};

export function getLesionName(code?: string | null, description?: string | null): string {
  const normalized = code?.trim().toLowerCase() ?? "";
  const name = LESION_NAMES[normalized];
  return typeof name === "string"
    ? name
    : description?.trim() || code?.trim() || "Sin clasificación";
}
