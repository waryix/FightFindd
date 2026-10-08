import "dotenv/config";
import { z } from "zod";

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === "boolean" ? v : ["true", "1", "yes"].includes(v.toLowerCase())));

const intFromString = z.coerce.number().int();

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: intFromString.default(4001),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().min(1).default("postgres://fightfind:fightfind@localhost:5432/fightfind"),

  JWT_SECRET: z.string().min(16).default("dev-jwt-secret-change-me-0000000000000000"),
  SESSION_SECRET: z.string().min(16).default("dev-session-secret-change-me-00000000"),
  ACCESS_TOKEN_TTL_MINUTES: intFromString.default(30),
  REFRESH_TOKEN_TTL_DAYS: intFromString.default(30),

  DEV_OTP: z.string().regex(/^\d{6}$/).default("123456"),
  OTP_TTL_MINUTES: intFromString.default(10),
  OTP_MAX_ATTEMPTS: intFromString.default(5),
  OTP_RATE_LIMIT_PER_HOUR: intFromString.default(5),

  MSG91_AUTH_KEY: z.string().optional().default(""),
  MSG91_SENDER_ID: z.string().optional().default(""),
  MSG91_TEMPLATE_ID: z.string().optional().default(""),
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("FightFind <no-reply@fightfind.in>"),

  API_PUBLIC_URL: z.string().default("http://localhost:4001"),
  CORS_ORIGINS: z.string().default("http://localhost:3001,http://localhost:8081,http://localhost:19006"),

  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(""),
  RAZORPAY_FIGHTER_PLAN_ID: z.string().optional().default(""),
  RAZORPAY_GYM_PLAN_ID: z.string().optional().default(""),
  RAZORPAY_ACCOUNT_NUMBER: z.string().optional().default(""),
  PAYMENT_MODE: z.enum(["test", "live", "mock"]).default("test"),
  PAYMENT_SIMULATOR_ENABLED: booleanFromString.default(false),
  // Dev convenience: when true, subscription provider errors fall back to a
  // client-driven one-time monthly order (no recurring mandate).
  SUBSCRIPTIONS_FALLBACK_TO_ORDERS: booleanFromString.default(true),
  // Dev convenience: skip Razorpay Route transfers (recorded as processing).
  SKIP_ROUTE_TRANSFERS: booleanFromString.default(false),

  FIGHTER_PREMIUM_MONTHLY_PAISE: intFromString.default(19900),
  GYM_LISTING_FEE_PAISE: intFromString.default(99900),
  GYM_PLATFORM_MONTHLY_PAISE: intFromString.default(39900),
  PLATFORM_COMMISSION_PERCENT: z.coerce.number().min(0).max(100).default(0),
  GYM_MEMBERSHIP_AUTO_APPROVE: booleanFromString.default(false),
  GYM_SUBSCRIPTION_GRACE_DAYS: intFromString.default(7),

  EXPO_ACCESS_TOKEN: z.string().optional().default(""),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./uploads"),
  S3_BUCKET: z.string().optional().default(""),
  S3_REGION: z.string().default("ap-south-1"),
  S3_ENDPOINT: z.string().optional().default(""),
  S3_ACCESS_KEY_ID: z.string().optional().default(""),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(""),
  S3_PUBLIC_BASE_URL: z.string().optional().default(""),

  ANALYTICS_SINK: z.enum(["log", "posthog", "none"]).default("log"),
  POSTHOG_API_KEY: z.string().optional().default(""),
  POSTHOG_HOST: z.string().default("https://app.posthog.com"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(overrides?: Partial<Record<string, string | undefined>>): Env {
  if (cached && !overrides) return cached;
  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n  ");
    throw new Error(`Invalid environment configuration:\n  ${issues}`);
  }
  if (!overrides) cached = parsed.data;
  return parsed.data;
}

export function resetEnvCache() {
  cached = null;
}

export const isProduction = () => loadEnv().NODE_ENV === "production";
export const isTest = () => loadEnv().NODE_ENV === "test";
