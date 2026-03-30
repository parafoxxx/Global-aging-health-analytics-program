import dotenv from "dotenv";
import { Pool } from "pg";
import xlsx from "xlsx";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node server/import-factors.js <xlsx-path>");
  process.exit(1);
}

let db = null;
let mode = "postgres";

async function initEmbeddedDb() {
  fs.mkdirSync("./.data", { recursive: true });

  try {
    const persistentDb = new PGlite("./.data/pglite");
    await persistentDb.query("select 1");
    db = persistentDb;
    mode = "pglite";
    return;
  } catch (error) {
    const details = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.warn(`Persistent pglite startup failed; falling back to in-memory pglite. ${details}`);
  }

  const memoryDb = new PGlite();
  await memoryDb.query("select 1");
  db = memoryDb;
  mode = "pglite-memory";
}

async function initDb() {
  try {
    const pool = process.env.DATABASE_URL
      ? new Pool({ connectionString: process.env.DATABASE_URL })
      : new Pool({
          host: process.env.PGHOST ?? "localhost",
          port: Number(process.env.PGPORT ?? 5432),
          user: process.env.PGUSER ?? "postgres",
          password: process.env.PGPASSWORD ?? "",
          database: process.env.PGDATABASE ?? "postgres",
        });
    await pool.query("select 1");
    db = pool;
    mode = "postgres";
  } catch {
    await initEmbeddedDb();
  }
}

const num = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

async function run() {
  await initDb();
  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });

  let countriesCount = 0;
  let factorRows = 0;
  try {
    await db.query("begin");
    await db.query(
      `
      create table if not exists country_frailty_factors (
        country text not null,
        rank smallint not null check (rank between 1 and 3),
        factor_name text not null,
        score double precision not null,
        accuracy double precision,
        primary key (country, rank)
      )
      `,
    );
    await db.query("delete from country_frailty_factors");

    for (const row of rows) {
      const country = String(row["Country"] ?? "").trim();
      if (!country) continue;

      const accuracy = num(row["Accuracy (%)"]);
      const factors = [
        { rank: 1, name: row["Top 1 Factor"], score: num(row["Score (%)"]) },
        { rank: 2, name: row["Top 2 Factor"], score: num(row["Score (%)_1"]) },
        { rank: 3, name: row["Top 3 Factor"], score: num(row["Score (%)_2"]) },
      ].filter((item) => item.name && item.score !== null);

      for (const factor of factors) {
        await db.query(
          `
          insert into country_frailty_factors (country, rank, factor_name, score, accuracy)
          values ($1, $2, $3, $4, $5)
          on conflict (country, rank)
          do update set
            factor_name = excluded.factor_name,
            score = excluded.score,
            accuracy = excluded.accuracy
          `,
          [country, factor.rank, String(factor.name), factor.score, accuracy],
        );
        factorRows += 1;
      }
      countriesCount += 1;
    }

    await db.query("commit");
    console.log(`Imported factors for ${countriesCount} countries (${factorRows} factor rows) using ${mode}.`);
  } catch (error) {
    await db.query("rollback");
    console.error("Import failed:", error);
    process.exitCode = 1;
  } finally {
    if (mode === "postgres" && db) {
      await db.end();
    }
  }
}

await run();
