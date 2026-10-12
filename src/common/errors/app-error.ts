export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }

  static notFound(what: string) {
    return new AppError(404, `${what} not found`);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, message, details);
  }

  static conflict(message: string) {
    return new AppError(409, message);
  }
}
