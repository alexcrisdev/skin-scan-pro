export class AnalysisError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 500,
  ) {
    super(message);
    this.name = "AnalysisError";
  }
}

export class BadRequestError extends AnalysisError {
  constructor(message: string) {
    super(message, 400);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends AnalysisError {
  constructor(message = "Usuario no autenticado.") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AnalysisError {
  constructor(message: string) {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AnalysisError {
  constructor(message: string) {
    super(message, 404);
    this.name = "NotFoundError";
  }
}
