import { createFileRoute } from "@tanstack/react-router";
import { ChatbotController } from "@/services/chatbot/chatbot.controller";

const controller = new ChatbotController();

export const Route = createFileRoute("/api/chatbot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        return controller.handleRequest({ request });
      },
    },
  },
});
