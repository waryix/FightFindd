import type { ApiErrorCode } from "@fightfind/types";

export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const badRequest = (code: ApiErrorCode, message: string, details?: unknown) =>
  new AppError(code, message, 400, details);

export const unauthorized = (code: ApiErrorCode = "UNAUTHORIZED", message = "Authentication required") =>
  new AppError(code, message, 401);

export const forbidden = (code: ApiErrorCode = "FORBIDDEN", message = "You do not have access to this resource") =>
  new AppError(code, message, 403);

export const notFound = (code: ApiErrorCode, message: string) => new AppError(code, message, 404);

export const conflict = (code: ApiErrorCode, message: string) => new AppError(code, message, 409);

export const rateLimited = (message = "Too many requests. Try again later.") =>
  new AppError("RATE_LIMITED", message, 429);

export const internal = (message = "Something went wrong") => new AppError("INTERNAL_ERROR", message, 500);

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
