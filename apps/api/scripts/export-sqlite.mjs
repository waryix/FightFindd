/**
 * Exports the live PostgreSQL database into a single SQLite file so it can be
 * opened directly (DB Browser for SQLite, TablePlus, etc.).
 *
 * Usage: node scripts/export-sqlite.mjs [outputPath]
 * Default output: apps/api/data/fightfind.db
 *
 * This is a read-only snapshot of PostgreSQL; the app keeps using Postgres.
 */
import "dotenv/config";
import path from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import pg from "pg";
import { DatabaseSync } from "node:sqlite";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://fightfind:fightfind@localhost:5432/fightfind";
const outPath = path.resolve(process.argv[2] ?? path.join(process.cwd(), "data", "fightfind.db"));

mkdirSync(path.dirname(outPath), { recursive: true });
rmSync(outPath, { force: true });

function sqliteType(dataType) {
  if (["integer", "smallint", "bigint"].includes(dataType)) return "INTEGER";
  if (["numeric", "real", "double precision"].includes(dataType)) return "REAL";
  if (dataType === "boolean") return "INTEGER";
  if (dataType === "bytea") return "BLOB";
  return "TEXT";
}

function toSqliteValue(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? 1 : 0;
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

const client = new pg.Client({ connectionString });
await client.connect();

const { rows: tables } = await client.query(`
  select table_name
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name
`);

const db = new DatabaseSync(outPath);
let totalRows = 0;

for (const { table_name } of tables) {
  const { rows: cols } = await client.query(
    `select column_name, data_type
     from information_schema.columns
     where table_schema = 'public' and table_name = $1
     order by ordinal_position`,
    [table_name],
  );
  const columnDefs = cols.map((c) => `"${c.column_name}" ${sqliteType(c.data_type)}`).join(", ");
  db.exec(`DROP TABLE IF EXISTS "${table_name}"`);
  db.exec(`CREATE TABLE "${table_name}" (${columnDefs})`);

  const { rows } = await client.query(`select * from "${table_name}"`);
  if (rows.length > 0) {
    const names = cols.map((c) => `"${c.column_name}"`).join(",");
    const placeholders = cols.map(() => "?").join(",");
    const insert = db.prepare(`INSERT INTO "${table_name}" (${names}) VALUES (${placeholders})`);
    for (const row of rows) {
      insert.run(...cols.map((c) => toSqliteValue(row[c.column_name])));
    }
  }
  totalRows += rows.length;
  console.log(`  ${table_name.padEnd(28)} ${rows.length} rows`);
}

await client.end();
db.close();

console.log(`\nWrote ${tables.length} tables / ${totalRows} rows to:`);
console.log(`  ${outPath}`);
