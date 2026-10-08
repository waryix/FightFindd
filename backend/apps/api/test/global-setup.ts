import { runMigrations } from "../src/db/migrate.js";
import { resetDatabase } from "../src/db/reset.js";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? "postgres://fightfind:fightfind@localhost:5432/fightfind_test";

export default async function globalSetup() {
  await resetDatabase(TEST_DATABASE_URL);
  await runMigrations(TEST_DATABASE_URL);
}
