export class ChatbotController {
  async handleRequest(_context: { request: Request }): Promise<Response> {
    return Response.json({ error: "El asistente conversacional fue retirado." }, { status: 410 });
  }
}
