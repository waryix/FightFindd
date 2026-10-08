import { sql } from "drizzle-orm";
import { createDatabase } from "./client.js";
import { loadEnv } from "../env.js";

/** Drops and recreates the public schema. Development and test only. */
export async function resetDatabase(connectionString: string) {
  const database = createDatabase(connectionString, { max: 1 });
  try {
    await database.db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
    await database.db.execute(sql`CREATE SCHEMA public`);
    // Also clear Drizzle's migration journal so migrations re-run from scratch.
    await database.db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  } finally {
    await database.close();
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith("reset.ts");
if (isMain) {
  const env = loadEnv();
  if (env.NODE_ENV === "production") {
    console.error("Refusing to reset a production database.");
    process.exit(1);
  }
  resetDatabase(env.DATABASE_URL)
    .then(() => {
      console.log("Database reset. Run db:migrate and db:seed next.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Reset failed:", error);
      process.exit(1);
    });
}
