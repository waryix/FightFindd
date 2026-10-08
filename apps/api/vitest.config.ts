import { defineConfig } from "vitest/config";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? "postgres://fightfind:fightfind@localhost:5432/fightfind_test";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    hookTimeout: 60_000,
    testTimeout: 30_000,
    fileParallelism: false,
    pool: "forks",
    globalSetup: ["test/global-setup.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: "test-jwt-secret-0123456789abcdef0123456789",
      SESSION_SECRET: "test-session-secret-0123456789abcdef",
      DEV_OTP: "123456",
      PAYMENT_MODE: "mock",
      PAYMENT_SIMULATOR_ENABLED: "true",
      SUBSCRIPTIONS_FALLBACK_TO_ORDERS: "true",
      SKIP_ROUTE_TRANSFERS: "false",
      OTP_RATE_LIMIT_PER_HOUR: "1000",
      ANALYTICS_SINK: "none",
      STORAGE_DRIVER: "local",
      STORAGE_LOCAL_DIR: "/tmp/opencode/fightfind-test-uploads",
      API_PUBLIC_URL: "http://localhost:4100",
    },
  },
});
