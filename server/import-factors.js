import dotenv from "dotenv";
import { Pool } from "pg";
import xlsx from "xlsx";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node server/import-factors.js <xlsx-path>");
  process.exit(1);
}

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      host: process.env.PGHOST ?? "localhost",
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.PGUSER ?? "postgres",
      password: process.env.PGPASSWORD ?? "",
      database: process.env.PGDATABASE ?? "postgres",
    });

const num = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

async function run() {
  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });

  const client = await pool.connect();
  let countriesCount = 0;
  let factorRows = 0;
  try {
    await client.query("begin");
    await client.query("delete from country_frailty_factors");

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
        await client.query(
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

    await client.query("commit");
    console.log(`Imported factors for ${countriesCount} countries (${factorRows} factor rows).`);
  } catch (error) {
    await client.query("rollback");
    console.error("Import failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

await run();

