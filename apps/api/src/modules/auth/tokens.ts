import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { loadEnv } from "../../env.js";

export interface AccessTokenPayload {
  sub: string;
  roles: string[];
  sid: string;
  typ: "access";
}

const encoder = new TextEncoder();

function jwtSecret(): Uint8Array {
  return encoder.encode(loadEnv().JWT_SECRET);
}

export async function signAccessToken(params: {
  userId: string;
  roles: string[];
  sessionId: string;
}): Promise<{ token: string; expiresAt: Date }> {
  const env = loadEnv();
  const expiresAt = new Date(Date.now() + env.ACCESS_TOKEN_TTL_MINUTES * 60_000);
  const token = await new SignJWT({ roles: params.roles, sid: params.sessionId, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(params.userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(jwtSecret());
  return { token, expiresAt };
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), { algorithms: ["HS256"] });
    if (payload.typ !== "access" || typeof payload.sub !== "string" || typeof payload.sid !== "string") {
      return null;
    }
    const roles = Array.isArray(payload.roles) ? payload.roles.filter((r): r is string => typeof r === "string") : [];
    return { sub: payload.sub, roles, sid: payload.sid, typ: "access" };
  } catch {
    return null;
  }
}

/** Opaque, high-entropy refresh token. Only its hash is stored server-side. */
export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(`${loadEnv().SESSION_SECRET}:${code}`).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function generateOtpCode(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}
