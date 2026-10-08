import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase } from "./client.js";
import { loadEnv } from "../env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(connectionString: string) {
  const directory = path.resolve(__dirname, "../../drizzle");
  const database = createDatabase(connectionString, { max: 2 });
  try {
    await migrate(database.db, { migrationsFolder: directory });
  } finally {
    await database.close();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const env = loadEnv();
  console.log("Running migrations against", env.DATABASE_URL.replace(/:[^:@/]+@/, ":***@"));
  runMigrations(env.DATABASE_URL)
    .then(() => {
      console.log("Migrations complete");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
