import type { z } from "zod";
import { AppError } from "./errors.js";

/** Validates input with a Zod schema and throws a structured validation error. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    const message = first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input";
    throw new AppError("VALIDATION_ERROR", message, 400, result.error.flatten());
  }
  return result.data;
}

export function parseOptional<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> | undefined {
  if (data === undefined || data === null || data === "") return undefined;
  return parse(schema, data);
}
