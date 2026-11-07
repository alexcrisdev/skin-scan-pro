import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/skinscan/app-layout";
export const Route = createFileRoute("/app/chatbot")({ component: RetiredChat });
function RetiredChat() {
  return (
    <PageHeader
      title="Asistente retirado"
      description="Utiliza Nuevo análisis para consultar el modelo CNN. El asistente conversacional ya no está disponible."
    />
  );
}
