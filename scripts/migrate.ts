import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join } from "path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(url);

const migrationPath = join(import.meta.dir, "..", "db", "migrations", "001_financing.sql");
const migration = readFileSync(migrationPath, "utf-8");

console.log("Running migration 001_financing.sql...");
await sql(migration);
console.log("Done.");
