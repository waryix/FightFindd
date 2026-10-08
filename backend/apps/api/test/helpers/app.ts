import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { buildApp } from "../../src/app.js";
import { createContext, type AppContext } from "../../src/context.js";
import { createDatabase, type Database } from "../../src/db/client.js";
import { MockPaymentProvider, type MockProviderOptions } from "../../src/modules/payments/mock.provider.js";

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? "postgres://fightfind:fightfind@localhost:5432/fightfind_test";

export interface TestHarness {
  app: FastifyInstance;
  ctx: AppContext;
  database: Database;
  provider: MockPaymentProvider;
  close: () => Promise<void>;
}

export async function buildTestApp(providerOptions?: MockProviderOptions): Promise<TestHarness> {
  const database = createDatabase(TEST_DATABASE_URL, { max: 5 });
  const provider = new MockPaymentProvider(providerOptions);
  const ctx = await createContext({ db: database.db, provider });
  const app = await buildApp({ ctx, logger: false });
  await app.ready();
  return {
    app,
    ctx,
    database,
    provider,
    close: async () => {
      await app.close();
      await database.close();
    },
  };
}

const TABLES = [
  "analytics_events",
  "audit_logs",
  "user_reports",
  "user_blocks",
  "device_tokens",
  "notifications",
  "gym_membership_requests",
  "gym_memberships",
  "messages",
  "sparring_requests",
  "payment_transfers",
  "refunds",
  "payment_events",
  "payments",
  "subscriptions",
  "gym_verification",
  "gym_disciplines",
  "gym_profiles",
  "gym_owners",
  "fighter_disciplines",
  "fighter_profiles",
  "otp_challenges",
  "sessions",
  "user_roles",
  "users",
];

export async function truncateAll(db: Database["db"]): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE TABLE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`));
}

export interface TestSession {
  token: string;
  userId: string;
  name: string | null;
  roles: string[];
}

export async function login(
  app: FastifyInstance,
  identifier: string,
  options: { channel?: "phone" | "email"; purpose?: "login" | "signup" | "gym_owner_login"; name?: string } = {},
): Promise<TestSession> {
  const channel = options.channel ?? (identifier.includes("@") ? "email" : "phone");
  const requestResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/otp/request",
    payload: { channel, identifier, purpose: options.purpose ?? "login" },
  });
  if (requestResponse.statusCode !== 200) {
    throw new Error(`OTP request failed (${requestResponse.statusCode}): ${requestResponse.body}`);
  }
  const { challengeId } = requestResponse.json() as { challengeId: string };
  const verifyResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/otp/verify",
    payload: { challengeId, code: "123456", name: options.name },
  });
  if (verifyResponse.statusCode !== 200) {
    throw new Error(`OTP verify failed (${verifyResponse.statusCode}): ${verifyResponse.body}`);
  }
  const body = verifyResponse.json() as {
    user: { id: string; name: string | null; roles: string[] };
    tokens: { accessToken: string };
  };
  return {
    token: body.tokens.accessToken,
    userId: body.user.id,
    name: body.user.name,
    roles: body.user.roles,
  };
}

export function authHeader(session: TestSession) {
  return { authorization: `Bearer ${session.token}` };
}

export interface CreateFighterOptions {
  name: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  skillLevel?: string;
  weightClass?: string;
  disciplines?: string[];
  yearsExperience?: number;
  heightCm?: number;
  weightKg?: number;
  ageYears?: number;
}

export async function createFighterProfile(
  app: FastifyInstance,
  session: TestSession,
  options: CreateFighterOptions,
): Promise<{ id: string; userId: string; name: string }> {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/fighters/me",
    headers: authHeader(session),
    payload: {
      name: options.name,
      city: options.city ?? "Bengaluru",
      state: options.state ?? "Karnataka",
      latitude: options.latitude ?? 12.9716,
      longitude: options.longitude ?? 77.5946,
      skillLevel: options.skillLevel ?? "intermediate",
      weightClass: options.weightClass ?? "lightweight",
      disciplines: options.disciplines ?? ["boxing"],
      yearsExperience: options.yearsExperience ?? 3,
      heightCm: options.heightCm ?? 175,
      weightKg: options.weightKg ?? 63,
      ageYears: options.ageYears ?? 25,
      totalAmateurFights: 4,
      totalProFights: 0,
      bio: "Test fighter",
    },
  });
  if (response.statusCode !== 201) {
    throw new Error(`Profile create failed (${response.statusCode}): ${response.body}`);
  }
  const body = response.json() as { fighter: { id: string; userId: string; name: string } };
  return body.fighter;
}

export interface FighterFixture {
  session: TestSession;
  profile: { id: string; userId: string; name: string };
}

export async function seedFighter(
  app: FastifyInstance,
  identifier: string,
  options: CreateFighterOptions,
): Promise<FighterFixture> {
  const session = await login(app, identifier, { name: options.name });
  const profile = await createFighterProfile(app, session, options);
  return { session, profile };
}

export function readError(body: string): { code: string; message: string } {
  try {
    return (JSON.parse(body) as { error: { code: string; message: string } }).error;
  } catch {
    return { code: "UNPARSEABLE", message: body };
  }
}
