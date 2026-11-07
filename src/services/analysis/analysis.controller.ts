import { AnalysisRepository } from "./analysis.repository";
import { AnalysisService } from "./analysis.service";
import { authenticateRequest } from "./auth.repository";
import {
  analysisIdParamsSchema,
  clientIdParamsSchema,
  createAnalysisRequestSchema,
  historyQuerySchema,
} from "./dtos";
import { AnalysisError, BadRequestError, ForbiddenError, UnauthorizedError } from "./errors";
import { ZodError } from "zod";

type ControllerContext = {
  request?: Request;
  params?: Record<string, string | undefined>;
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function parseUrlQuery(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}

function handleError(error: unknown) {
  console.error("Analysis API error", error);

  if (error instanceof AnalysisError) {
    return jsonResponse(
      {
        status: "error",
        message: error.message,
      },
      error.statusCode,
    );
  }

  if (error instanceof ZodError) {
    return jsonResponse(
      {
        status: "error",
        message: error.errors[0]?.message ?? "Solicitud invalida.",
      },
      400,
    );
  }

  return jsonResponse(
    {
      status: "error",
      message: "Ocurrio un error inesperado al procesar el analisis.",
    },
    500,
  );
}

export class AnalysisController {
  constructor(
    private readonly service: AnalysisService,
    private readonly repository: AnalysisRepository,
  ) {}

  private async currentClient(request?: Request) {
    if (!request) throw new UnauthorizedError();
    const auth = await authenticateRequest(request);
    const client = await this.repository.findClientByAuthUserId(auth.authUserId);
    if (!client) throw new UnauthorizedError();
    return client;
  }

  static fromSupabaseClient(supabase: ConstructorParameters<typeof AnalysisRepository>[0]) {
    const repository = new AnalysisRepository(supabase);
    return new AnalysisController(new AnalysisService(repository), repository);
  }

  async create({ request }: ControllerContext & { request: Request }) {
    try {
      const auth = await authenticateRequest(request);
      const payload = await request.json().catch(() => {
        throw new BadRequestError("El cuerpo de la solicitud debe ser JSON.");
      });
      const input = createAnalysisRequestSchema.parse(payload);
      const imageUrl = new URL(input.image_url);
      const storageOrigin = new URL(process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL!)
        .origin;
      const imagePrefix = `/storage/v1/object/sign/analysis-images/${auth.authUserId}/`;
      if (imageUrl.origin !== storageOrigin || !imageUrl.pathname.startsWith(imagePrefix)) {
        throw new BadRequestError(
          "La imagen debe pertenecer al almacenamiento del usuario autenticado.",
        );
      }
      const result = await this.service.createAnalysis(auth.authUserId, input);

      return jsonResponse(result, result.status === "success" ? 201 : 422);
    } catch (error) {
      return handleError(error);
    }
  }

  async getById({ params, request }: ControllerContext) {
    try {
      const client = await this.currentClient(request);
      const parsed = analysisIdParamsSchema.parse(params ?? {});
      const result = await this.service.getAnalysisById(parsed.analysisId);
      if (result.data.client_id !== client.id) throw new ForbiddenError("Acceso denegado.");
      return jsonResponse(result);
    } catch (error) {
      return handleError(error);
    }
  }

  async getDetail(context: ControllerContext) {
    return this.getById(context);
  }

  async getByClient({ params, request }: ControllerContext) {
    try {
      const client = await this.currentClient(request);
      const parsed = clientIdParamsSchema.parse(params ?? {});
      if (parsed.clientId !== client.id) throw new ForbiddenError("Acceso denegado.");
      return jsonResponse(await this.service.getAnalysesByClient(parsed.clientId));
    } catch (error) {
      return handleError(error);
    }
  }

  async getHistory({ request }: ControllerContext & { request: Request }) {
    try {
      const client = await this.currentClient(request);
      const query = historyQuerySchema.parse(parseUrlQuery(request));
      if (query.client_id && query.client_id !== client.id)
        throw new ForbiddenError("Acceso denegado.");
      query.client_id = client.id;
      return jsonResponse(await this.service.getHistory(query));
    } catch (error) {
      return handleError(error);
    }
  }
}
