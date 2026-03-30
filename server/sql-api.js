import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import { loadBrokenPgliteRecovery } from "./pglite-recovery.js";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const app = express();

const PORT = Number(process.env.SQL_API_PORT ?? 4000);
const CORS_ORIGIN = process.env.SQL_API_CORS_ORIGIN ?? "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const OPENAI_TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL ?? "whisper-1";
const ADMIN_LOGIN_ID = process.env.ADMIN_LOGIN_ID ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const ADMIN_SESSION_DURATION_MS = Number(process.env.ADMIN_SESSION_DURATION_HOURS ?? 8) * 60 * 60 * 1000;
const ALLOW_IN_MEMORY_DB_FALLBACK = String(process.env.ALLOW_IN_MEMORY_DB_FALLBACK ?? "").trim().toLowerCase() === "true";

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
  `
  create table if not exists participants (
    id bigserial primary key,
    external_participant_id text not null unique,
    name text,
    age integer not null check (age between 0 and 120),
    gender text not null,
    country text not null,
    state_region text not null,
    city text,
    socioeconomic jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )
  `,
  "create index if not exists participants_country_idx on participants (country)",
  `
  create table if not exists assessment_submissions (
    id bigserial primary key,
    participant_id bigint not null references participants(id) on delete cascade,
    ip_address text,
    assessment_type text not null,
    total_score double precision,
    max_score double precision,
    normalized_score double precision,
    result_label text,
    answers jsonb not null,
    metadata jsonb not null default '{}'::jsonb,
    submitted_at timestamptz not null default now()
  )
  `,
  "create index if not exists assessment_submissions_participant_idx on assessment_submissions (participant_id)",
  "create index if not exists assessment_submissions_ip_idx on assessment_submissions (ip_address)",
  "create index if not exists assessment_submissions_type_idx on assessment_submissions (assessment_type)",
];

let db = null;
let dbMode = "postgres";
let recoverySnapshot = null;
const adminSessions = new Map();
const ALLOWED_ASSESSMENT_TYPES = new Set(["depression", "frailty", "voice-survey"]);

function parseAllowedOrigins(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins(CORS_ORIGIN);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin ${origin}`));
    },
  }),
);
app.use(express.json({ limit: "10mb" }));

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

function normalizeAssessmentSubmissionRow(row) {
  if (!row) return null;
  return {
    submissionId: Number(row.id),
    assessmentType: row.assessment_type,
    resultLabel: row.result_label ?? null,
    submittedAt: row.submitted_at,
  };
}

function normalizeAssessmentExportRow(row) {
  if (!row) return null;
  const socioeconomic = row.socioeconomic ?? {};
  return {
    submissionId: Number(row.submission_id),
    participantId: Number(row.participant_id),
    externalParticipantId: row.external_participant_id,
    participantName: row.participant_name ?? "",
    participantAge: Number(row.participant_age),
    participantGender: row.participant_gender,
    participantCountry: row.participant_country,
    participantStateRegion: row.participant_state_region,
    participantCity: row.participant_city ?? "",
    participantSocioeconomic: socioeconomic,
    assessmentType: row.assessment_type,
    totalScore: row.total_score === null ? null : Number(row.total_score),
    maxScore: row.max_score === null ? null : Number(row.max_score),
    normalizedScore: row.normalized_score === null ? null : Number(row.normalized_score),
    resultLabel: row.result_label ?? null,
    answers: row.answers ?? [],
    metadata: row.metadata ?? {},
    submittedAt: row.submitted_at,
  };
}

function normalizeIpAddress(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const first = text.split(",")[0]?.trim() ?? "";
  if (!first) return null;

  if (first === "::1") return "127.0.0.1";
  if (first.startsWith("::ffff:")) return first.slice(7);
  return first;
}

function getClientIp(req) {
  return (
    normalizeIpAddress(req.headers["x-forwarded-for"]) ??
    normalizeIpAddress(req.ip) ??
    normalizeIpAddress(req.socket?.remoteAddress) ??
    null
  );
}

function isUniqueViolation(error) {
  return error && typeof error === "object" && "code" in error && error.code === "23505";
}

function getConstraintName(error) {
  if (error && typeof error === "object" && "constraint" in error && typeof error.constraint === "string") {
    return error.constraint;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("assessment_submissions_unique_participant_type_idx")) {
    return "assessment_submissions_unique_participant_type_idx";
  }
  if (message.includes("assessment_submissions_unique_ip_type_idx")) {
    return "assessment_submissions_unique_ip_type_idx";
  }
  return "";
}

function safeCompareText(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ""), "utf8");
  const rightBuffer = Buffer.from(String(right ?? ""), "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function createAdminSession() {
  const token = randomUUID();
  const expiresAt = Date.now() + ADMIN_SESSION_DURATION_MS;
  adminSessions.set(token, expiresAt);
  return { token, expiresAt };
}

function readBearerToken(req) {
  const header = String(req.headers.authorization ?? "").trim();
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function requireAdmin(req) {
  const token = readBearerToken(req);
  if (!token) {
    throw new HttpError(401, "Admin authorization is required");
  }

  const expiresAt = adminSessions.get(token);
  if (!expiresAt) {
    throw new HttpError(401, "Admin session is invalid");
  }

  if (Date.now() >= expiresAt) {
    adminSessions.delete(token);
    throw new HttpError(401, "Admin session expired");
  }

  return { token, expiresAt };
}

function getRecoveryCountry(country) {
  return recoverySnapshot?.countriesByKey.get(String(country ?? "").trim().toLowerCase()) ?? null;
}

function getRecoveryFactors(country) {
  return recoverySnapshot?.factorsByKey.get(String(country ?? "").trim().toLowerCase()) ?? null;
}

function ensureRecoverySnapshot() {
  if (recoverySnapshot) return recoverySnapshot;

  try {
    const snapshot = loadBrokenPgliteRecovery();
    if (!snapshot) return null;

    recoverySnapshot = snapshot;
    console.warn(
      `[sql-api] Loaded recovery snapshot from broken pglite store (${snapshot.countries.length} countries, ${snapshot.factorsByKey.size} factor sets).`,
    );
    return recoverySnapshot;
  } catch (error) {
    const details = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.warn(`[sql-api] Recovery snapshot unavailable. ${details}`);
    return null;
  }
}

async function query(sql, params = []) {
  if (!db) throw new Error("Database not initialized");
  const result = await db.query(sql, params);
  return {
    rows: result.rows ?? [],
    rowCount: result.rowCount ?? (result.rows ? result.rows.length : 0),
  };
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function normalizeOptionalText(value, maxLength = 255) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function normalizeRequiredText(value, field) {
  const text = normalizeOptionalText(value);
  if (!text) {
    throw new HttpError(400, `${field} is required`);
  }
  return text;
}

function normalizeInteger(value, field, min, max) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
    throw new HttpError(400, `${field} must be an integer between ${min} and ${max}`);
  }
  return numeric;
}

function normalizeNullableNumber(value, field) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new HttpError(400, `${field} must be a number`);
  }
  return numeric;
}

function normalizeRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

function decodeBase64Audio(base64Value, field) {
  const raw = normalizeRequiredText(base64Value, field);
  const sanitized = raw.replace(/^data:audio\/[\w.+-]+;base64,/, "").replace(/\s+/g, "");

  try {
    return Buffer.from(sanitized, "base64");
  } catch {
    throw new HttpError(400, `${field} must be valid base64 audio data`);
  }
}

function normalizeOptionalLanguage(value) {
  const normalized = normalizeOptionalText(value, 16);
  return normalized ? normalized.toLowerCase() : null;
}

function extensionFromMimeType(mimeType) {
  switch (mimeType) {
    case "audio/webm":
      return "webm";
    case "audio/mp4":
    case "audio/m4a":
      return "m4a";
    case "audio/ogg":
      return "ogg";
    case "audio/wav":
    case "audio/wave":
    case "audio/x-wav":
      return "wav";
    default:
      return "webm";
  }
}

async function transcribeAudio({ audioBase64, mimeType, language }) {
  if (!OPENAI_API_KEY) {
    throw new HttpError(500, "OPENAI_API_KEY is not configured on the server");
  }

  const normalizedMimeType = normalizeOptionalText(mimeType, 120) ?? "audio/webm";
  const buffer = decodeBase64Audio(audioBase64, "audioBase64");
  const extension = extensionFromMimeType(normalizedMimeType);
  const formData = new FormData();
  const audioFile = new File([buffer], `survey-recording.${extension}`, { type: normalizedMimeType });

  formData.append("file", audioFile);
  formData.append("model", OPENAI_TRANSCRIPTION_MODEL);

  const normalizedLanguage = normalizeOptionalLanguage(language);
  if (normalizedLanguage) {
    formData.append("language", normalizedLanguage);
  }

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new HttpError(response.status, data?.error?.message ?? "OpenAI transcription request failed");
  }

  return {
    text: normalizeOptionalText(data?.text, 10_000) ?? "",
    model: OPENAI_TRANSCRIPTION_MODEL,
    language: normalizedLanguage,
  };
}

function normalizeParticipantSubmission(payload) {
  return {
    externalParticipantId: normalizeOptionalText(payload.externalParticipantId, 120) ?? randomUUID(),
    name: normalizeOptionalText(payload.name),
    age: normalizeInteger(payload.age, "participant.age", 0, 120),
    gender: normalizeRequiredText(payload.gender, "participant.gender"),
    country: normalizeRequiredText(payload.country, "participant.country"),
    stateRegion: normalizeRequiredText(payload.stateRegion, "participant.stateRegion"),
    city: normalizeOptionalText(payload.city),
    socioeconomic: normalizeRecord(payload.socioeconomic),
  };
}

function normalizeAssessmentSubmission(payload) {
  const type = normalizeRequiredText(payload.type, "assessment.type");
  if (!ALLOWED_ASSESSMENT_TYPES.has(type)) {
    throw new HttpError(400, "assessment.type is not supported");
  }
  if (payload.answers === undefined) {
    throw new HttpError(400, "assessment.answers is required");
  }

  return {
    type,
    totalScore: normalizeNullableNumber(payload.totalScore, "assessment.totalScore"),
    maxScore: normalizeNullableNumber(payload.maxScore, "assessment.maxScore"),
    normalizedScore: normalizeNullableNumber(payload.normalizedScore, "assessment.normalizedScore"),
    resultLabel: normalizeOptionalText(payload.resultLabel),
    answers: payload.answers,
    metadata: normalizeRecord(payload.metadata),
  };
}

async function ensureDataNotice() {
  const countRes = await query("select count(*)::int as count from countries");
  const currentCount = Number(countRes.rows[0]?.count ?? 0);
  if (currentCount === 0) {
    const recovered = ensureRecoverySnapshot();
    if (recovered?.countries.length) {
      console.warn("[sql-api] countries table is empty. Serving recovered country pages from the broken embedded store.");
      return;
    }

    console.warn("[sql-api] countries table is empty. Import data to see country pages.");
  }
}

async function ensureAssessmentSubmissionUniqueness() {
  const dedupeResult = await query(
    `
    with ranked as (
      select
        id,
        row_number() over (
          partition by participant_id, assessment_type
          order by submitted_at desc, id desc
        ) as rn
      from assessment_submissions
    )
    delete from assessment_submissions
    where id in (
      select id
      from ranked
      where rn > 1
    )
    `,
  );

  if (dedupeResult.rowCount > 0) {
    console.warn(
      `[sql-api] Removed ${dedupeResult.rowCount} duplicate assessment submissions before enforcing unique index.`,
    );
  }

  await query(
    "create unique index if not exists assessment_submissions_unique_participant_type_idx on assessment_submissions (participant_id, assessment_type)",
  );
  await query(
    "create unique index if not exists assessment_submissions_unique_ip_type_idx on assessment_submissions (ip_address, assessment_type) where ip_address is not null",
  );
}

async function initEmbeddedDb() {
  fs.mkdirSync("./.data", { recursive: true });
  const pglitePath = "./.data/pglite";
  const pidPath = `${pglitePath}/postmaster.pid`;

  const tryPersistentPglite = async () => {
    const persistentDb = new PGlite(pglitePath);
    await persistentDb.query("select 1");
    return persistentDb;
  };

  try {
    db = await tryPersistentPglite();
    dbMode = "pglite";
    console.log("[sql-api] PostgreSQL unavailable; using local embedded pglite.");
    return;
  } catch (error) {
    const details = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.warn(`[sql-api] Persistent pglite startup failed on first attempt. ${details}`);
  }

  if (fs.existsSync(pidPath)) {
    const stalePidPath = `${pidPath}.stale-${Date.now()}`;
    try {
      fs.renameSync(pidPath, stalePidPath);
      console.warn(`[sql-api] Renamed stale pglite pid file to ${stalePidPath}. Retrying persistent startup.`);
      db = await tryPersistentPglite();
      dbMode = "pglite";
      console.log("[sql-api] PostgreSQL unavailable; using local embedded pglite.");
      return;
    } catch (error) {
      const details = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.warn(`[sql-api] Persistent pglite startup still failed after pid-file recovery. ${details}`);
    }
  }

  if (!ALLOW_IN_MEMORY_DB_FALLBACK) {
    throw new Error(
      "Persistent database startup failed. Refusing to fall back to in-memory storage because that would lose submissions on restart.",
    );
  }

  const memoryDb = new PGlite();
  await memoryDb.query("select 1");
  db = memoryDb;
  dbMode = "pglite-memory";
  console.log("[sql-api] PostgreSQL unavailable; using in-memory pglite for this session.");
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
    await initEmbeddedDb();
  }

  for (const sql of TABLE_SQL_STATEMENTS) {
    await query(sql);
  }

  await ensureAssessmentSubmissionUniqueness();
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
    const rows = result.rows.map(normalizeCountryRow);
    if (rows.length > 0) {
      res.json(rows);
      return;
    }

    const recovered = ensureRecoverySnapshot();
    if (recovered?.countries.length) {
      res.json(recovered.countries);
      return;
    }

    res.json([]);
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
      const recoveredCountry = getRecoveryCountry(countryParam) ?? ensureRecoverySnapshot()?.countriesByKey.get(countryParam.trim().toLowerCase()) ?? null;
      if (recoveredCountry) {
        res.json(recoveredCountry);
        return;
      }

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
      const recoveredFactors = getRecoveryFactors(countryParam) ?? ensureRecoverySnapshot()?.factorsByKey.get(countryParam.trim().toLowerCase()) ?? null;
      if (recoveredFactors) {
        res.json(recoveredFactors);
        return;
      }

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

app.get("/api/participants/:externalParticipantId/submissions", async (req, res) => {
  try {
    const externalParticipantId = normalizeRequiredText(req.params.externalParticipantId, "participant.externalParticipantId");

    const participantResult = await query(
      `
      select id
      from participants
      where external_participant_id = $1
      limit 1
      `,
      [externalParticipantId],
    );

    if (participantResult.rowCount === 0) {
      res.json([]);
      return;
    }

    const submissionsResult = await query(
      `
      select id, assessment_type, result_label, submitted_at
      from assessment_submissions
      where participant_id = $1
      order by submitted_at desc
      `,
      [participantResult.rows[0].id],
    );

    res.json(submissionsResult.rows.map(normalizeAssessmentSubmissionRow));
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }

    console.error("GET /api/participants/:externalParticipantId/submissions failed", error);
    res.status(500).json({ message: "Failed to fetch participant submissions" });
  }
});

app.post("/api/admin/login", async (req, res) => {
  try {
    if (!ADMIN_LOGIN_ID || !ADMIN_PASSWORD) {
      res.status(500).json({ message: "Admin credentials are not configured on the server" });
      return;
    }

    const loginId = normalizeRequiredText(req.body?.loginId, "loginId");
    const password = normalizeRequiredText(req.body?.password, "password");

    if (!safeCompareText(loginId, ADMIN_LOGIN_ID) || !safeCompareText(password, ADMIN_PASSWORD)) {
      res.status(401).json({ message: "Invalid admin credentials" });
      return;
    }

    const session = createAdminSession();
    res.status(201).json({
      token: session.token,
      expiresAt: new Date(session.expiresAt).toISOString(),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }

    console.error("POST /api/admin/login failed", error);
    res.status(500).json({ message: "Failed to sign in as admin" });
  }
});

app.get("/api/admin/session", async (req, res) => {
  try {
    const session = requireAdmin(req);
    res.json({
      ok: true,
      expiresAt: new Date(session.expiresAt).toISOString(),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }

    console.error("GET /api/admin/session failed", error);
    res.status(500).json({ message: "Failed to validate admin session" });
  }
});

app.get("/api/assessment-submissions/export", async (req, res) => {
  try {
    requireAdmin(req);

    const result = await query(
      `
      select
        s.id as submission_id,
        p.id as participant_id,
        p.external_participant_id,
        p.name as participant_name,
        p.age as participant_age,
        p.gender as participant_gender,
        p.country as participant_country,
        p.state_region as participant_state_region,
        p.city as participant_city,
        p.socioeconomic,
        s.assessment_type,
        s.total_score,
        s.max_score,
        s.normalized_score,
        s.result_label,
        s.answers,
        s.metadata,
        s.submitted_at
      from assessment_submissions s
      inner join participants p on p.id = s.participant_id
      order by s.assessment_type asc, s.submitted_at desc, s.id desc
      `,
    );

    res.json({
      submissions: result.rows.map(normalizeAssessmentExportRow),
    });
  } catch (error) {
    console.error("GET /api/assessment-submissions/export failed", error);
    res.status(500).json({ message: "Failed to export assessment submissions" });
  }
});

app.post("/api/assessment-submissions", async (req, res) => {
  try {
    const participant = normalizeParticipantSubmission(req.body?.participant ?? {});
    const assessment = normalizeAssessmentSubmission(req.body?.assessment ?? {});
    const clientIp = getClientIp(req);

    const participantResult = await query(
      `
      insert into participants (
        external_participant_id,
        name,
        age,
        gender,
        country,
        state_region,
        city,
        socioeconomic
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      on conflict (external_participant_id)
      do update set
        name = excluded.name,
        age = excluded.age,
        gender = excluded.gender,
        country = excluded.country,
        state_region = excluded.state_region,
        city = excluded.city,
        socioeconomic = excluded.socioeconomic,
        updated_at = now()
      returning id, external_participant_id
      `,
      [
        participant.externalParticipantId,
        participant.name,
        participant.age,
        participant.gender,
        participant.country,
        participant.stateRegion,
        participant.city,
        JSON.stringify(participant.socioeconomic),
      ],
    );

    const participantRow = participantResult.rows[0];

    const existingParticipantSubmissionResult = await query(
      `
      select id, assessment_type, result_label, submitted_at
      from assessment_submissions
      where participant_id = $1 and assessment_type = $2
      order by submitted_at desc, id desc
      limit 1
      `,
      [participantRow.id, assessment.type],
    );

    if (existingParticipantSubmissionResult.rowCount > 0) {
      res.status(409).json({
        message: `This participant has already submitted the ${assessment.type} assessment.`,
        existingSubmission: normalizeAssessmentSubmissionRow(existingParticipantSubmissionResult.rows[0]),
      });
      return;
    }

    if (clientIp) {
      const existingIpSubmissionResult = await query(
        `
        select id, assessment_type, result_label, submitted_at
        from assessment_submissions
        where ip_address = $1 and assessment_type = $2
        order by submitted_at desc, id desc
        limit 1
        `,
        [clientIp, assessment.type],
      );

      if (existingIpSubmissionResult.rowCount > 0) {
        res.status(409).json({
          message: `This IP address has already submitted the ${assessment.type} assessment.`,
          existingSubmission: normalizeAssessmentSubmissionRow(existingIpSubmissionResult.rows[0]),
        });
        return;
      }
    }

    const submissionResult = await query(
      `
      insert into assessment_submissions (
        participant_id,
        ip_address,
        assessment_type,
        total_score,
        max_score,
        normalized_score,
        result_label,
        answers,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
      returning id, submitted_at
      `,
      [
        participantRow.id,
        clientIp,
        assessment.type,
        assessment.totalScore,
        assessment.maxScore,
        assessment.normalizedScore,
        assessment.resultLabel,
        JSON.stringify(assessment.answers),
        JSON.stringify(assessment.metadata),
      ],
    );

    res.status(201).json({
      submissionId: Number(submissionResult.rows[0].id),
      participantId: Number(participantRow.id),
      participantExternalId: participantRow.external_participant_id,
      submittedAt: submissionResult.rows[0].submitted_at,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const participant = normalizeParticipantSubmission(req.body?.participant ?? {});
      const assessment = normalizeAssessmentSubmission(req.body?.assessment ?? {});
      const clientIp = getClientIp(req);
      const constraintName = getConstraintName(error);

      if (constraintName === "assessment_submissions_unique_participant_type_idx") {
        const participantResult = await query(
          `
          select id
          from participants
          where external_participant_id = $1
          limit 1
          `,
          [participant.externalParticipantId],
        );

        const existingSubmissionResult =
          participantResult.rowCount > 0
            ? await query(
                `
                select id, assessment_type, result_label, submitted_at
                from assessment_submissions
                where participant_id = $1 and assessment_type = $2
                order by submitted_at desc, id desc
                limit 1
                `,
                [participantResult.rows[0].id, assessment.type],
              )
            : { rowCount: 0, rows: [] };

        res.status(409).json({
          message: `This participant has already submitted the ${assessment.type} assessment.`,
          existingSubmission:
            existingSubmissionResult.rowCount > 0
              ? normalizeAssessmentSubmissionRow(existingSubmissionResult.rows[0])
              : null,
        });
        return;
      }

      if (constraintName === "assessment_submissions_unique_ip_type_idx" && clientIp) {
        const existingIpSubmissionResult = await query(
          `
          select id, assessment_type, result_label, submitted_at
          from assessment_submissions
          where ip_address = $1 and assessment_type = $2
          order by submitted_at desc, id desc
          limit 1
          `,
          [clientIp, assessment.type],
        );

        res.status(409).json({
          message: `This IP address has already submitted the ${assessment.type} assessment.`,
          existingSubmission:
            existingIpSubmissionResult.rowCount > 0
              ? normalizeAssessmentSubmissionRow(existingIpSubmissionResult.rows[0])
              : null,
        });
        return;
      }
    }

    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }

    console.error("POST /api/assessment-submissions failed", error);
    res.status(500).json({ message: "Failed to save assessment submission" });
  }
});

app.post("/api/transcriptions", async (req, res) => {
  try {
    const transcription = await transcribeAudio({
      audioBase64: req.body?.audioBase64,
      mimeType: req.body?.mimeType,
      language: req.body?.language,
    });

    res.status(201).json(transcription);
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }

    console.error("POST /api/transcriptions failed", error);
    res.status(500).json({ message: "Failed to transcribe audio" });
  }
});

await initDb();
app.listen(PORT, () => {
  console.log(`[sql-api] listening on http://localhost:${PORT}`);
});
