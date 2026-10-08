import type { FastifyRequest } from "fastify";
import { unauthorized } from "./errors.js";

/** Guards guarantee auth; this narrows the type for handlers. */
export function authOf(request: FastifyRequest) {
  if (!request.auth) throw unauthorized();
  return request.auth;
}

export function userIdOf(request: FastifyRequest): string {
  return authOf(request).userId;
}

export function isGuest(request: FastifyRequest): boolean {
  return request.auth?.isGuest ?? false;
}
