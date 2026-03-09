import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const app = express();

const PORT = Number(process.env.SQL_API_PORT ?? 4000);
const CORS_ORIGIN = process.env.SQL_API_CORS_ORIGIN ?? "http://localhost:5173";

const TABLE_SQL_STATEMENTS = [
  `
  create table if not exists countries (
    id bigserial primary key,
    country text not null unique,
    total_count integer not null,
    frail_count integer not null,
    non_frail_count integer not null,
    frail_percentage double precision not null,
    avg_age double precision not null,
    female_count integer not null,
    male_count integer not null,
    female_percentage double precision not null,
    male_percentage double precision not null,
    comorbidity_yes integer not null,
    comorbidity_no integer not null,
    comorbidity_percentage double precision not null,
    age_groups jsonb not null,
    health_ratings jsonb not null,
    marital_status jsonb not null,
    marriage_age_categories jsonb not null
  )
  `,
  "create index if not exists countries_country_idx on countries (country)",
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
  "create index if not exists country_frailty_factors_country_idx on country_frailty_factors (country)",
];

let db = null;
let dbMode = "postgres";

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

function normalizeCountryRow(row) {
  if (!row) return null;
  return {
    country: row.country,
    total_count: Number(row.total_count),
    frail_count: Number(row.frail_count),
    non_frail_count: Number(row.non_frail_count),
    frail_percentage: Number(row.frail_percentage),
    avg_age: Number(row.avg_age),
    female_count: Number(row.female_count),
    male_count: Number(row.male_count),
    female_percentage: Number(row.female_percentage),
    male_percentage: Number(row.male_percentage),
    comorbidity_yes: Number(row.comorbidity_yes),
    comorbidity_no: Number(row.comorbidity_no),
    comorbidity_percentage: Number(row.comorbidity_percentage),
    age_groups: row.age_groups ?? {},
    health_ratings: row.health_ratings ?? {},
    marital_status: row.marital_status ?? {},
    marriage_age_categories: row.marriage_age_categories ?? {},
  };
}

async function query(sql, params = []) {
  if (!db) throw new Error("Database not initialized");
  const result = await db.query(sql, params);
  return {
    rows: result.rows ?? [],
    rowCount: result.rowCount ?? (result.rows ? result.rows.length : 0),
  };
}

async function ensureDataNotice() {
  const countRes = await query("select count(*)::int as count from countries");
  const currentCount = Number(countRes.rows[0]?.count ?? 0);
  if (currentCount === 0) {
    console.warn("[sql-api] countries table is empty. Import data to see country pages.");
  }
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
    dbMode = "postgres";
    console.log("[sql-api] Using PostgreSQL server.");
  } catch {
    fs.mkdirSync("./.data", { recursive: true });
    db = new PGlite("./.data/pglite");
    dbMode = "pglite";
    console.log("[sql-api] PostgreSQL unavailable; using local embedded pglite.");
  }

  for (const sql of TABLE_SQL_STATEMENTS) {
    await query(sql);
  }
  await ensureDataNotice();
}

app.get("/api/health", async (_req, res) => {
  try {
    await query("select 1 as ok");
    res.json({ ok: true, mode: dbMode });
  } catch (error) {
    console.error("health-check error", error);
    res.status(500).json({ ok: false, mode: dbMode });
  }
});

app.get("/api/countries", async (_req, res) => {
  try {
    const result = await query(
      `
      select
        country,
        total_count,
        frail_count,
        non_frail_count,
        frail_percentage,
        avg_age,
        female_count,
        male_count,
        female_percentage,
        male_percentage,
        comorbidity_yes,
        comorbidity_no,
        comorbidity_percentage,
        age_groups,
        health_ratings,
        marital_status,
        marriage_age_categories
      from countries
      where country is not null
      order by country asc
      `,
    );
    res.json(result.rows.map(normalizeCountryRow));
  } catch (error) {
    console.error("GET /api/countries failed", error);
    res.status(500).json({ message: "Failed to fetch countries" });
  }
});

app.get("/api/countries/:country", async (req, res) => {
  try {
    const countryParam = String(req.params.country ?? "").trim();
    if (!countryParam) {
      res.status(400).json({ message: "Country is required" });
      return;
    }

    const result = await query(
      `
      select
        country,
        total_count,
        frail_count,
        non_frail_count,
        frail_percentage,
        avg_age,
        female_count,
        male_count,
        female_percentage,
        male_percentage,
        comorbidity_yes,
        comorbidity_no,
        comorbidity_percentage,
        age_groups,
        health_ratings,
        marital_status,
        marriage_age_categories
      from countries
      where lower(trim(country)) = lower(trim($1))
      limit 1
      `,
      [countryParam],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Country not found" });
      return;
    }

    res.json(normalizeCountryRow(result.rows[0]));
  } catch (error) {
    console.error("GET /api/countries/:country failed", error);
    res.status(500).json({ message: "Failed to fetch country" });
  }
});

app.get("/api/countries/:country/factors", async (req, res) => {
  try {
    const countryParam = String(req.params.country ?? "").trim();
    if (!countryParam) {
      res.status(400).json({ message: "Country is required" });
      return;
    }

    const result = await query(
      `
      select country, rank, factor_name, score, accuracy
      from country_frailty_factors
      where lower(trim(country)) = lower(trim($1))
      order by rank asc
      `,
      [countryParam],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Factors not found" });
      return;
    }

    const rows = result.rows;
    res.json({
      country: rows[0].country,
      accuracy: rows[0].accuracy === null ? null : Number(rows[0].accuracy),
      factors: rows.map((row) => ({
        rank: Number(row.rank),
        name: row.factor_name,
        score: Number(row.score),
      })),
    });
  } catch (error) {
    console.error("GET /api/countries/:country/factors failed", error);
    res.status(500).json({ message: "Failed to fetch country factors" });
  }
});

await initDb();
app.listen(PORT, () => {
  console.log(`[sql-api] listening on http://localhost:${PORT}`);
});
