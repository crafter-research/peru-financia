/**
 * scrape-claridad.ts
 *
 * Scraper para Claridad ONPE (2018–2026). Tiene CAPTCHA.
 * Usa Firecrawl agent con proxy stealth o JSON directo si hay API.
 *
 * Uso:
 *   bun run scripts/scrape-claridad.ts --year 2024
 *   bun run scripts/scrape-claridad.ts --all
 *   bun run scripts/scrape-claridad.ts --mode json  # si probe-claridad detectó API
 */

import FirecrawlApp from "@mendable/firecrawl-js";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";

const CLARIDAD_BASE = "https://claridadportal.onpe.gob.pe";
const YEARS_RANGE = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

const args = process.argv.slice(2);
const yearArg = args.includes("--year") ? Number(args[args.indexOf("--year") + 1]) : null;
const allFlag = args.includes("--all");
const mode = args.includes("--mode") ? args[args.indexOf("--mode") + 1] : "agent";

const apiKey = process.env.FIRECRAWL_API_KEY;
if (!apiKey) {
  console.error("FIRECRAWL_API_KEY not set");
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const firecrawl = new FirecrawlApp({ apiKey });
const sql = neon(dbUrl);

const FinancingRecordSchema = z.object({
  party_name: z.string(),
  party_type: z.string().optional(),
  financing_type: z.enum(["privado", "publico_directo", "publico_indirecto"]).optional(),
  donor_name: z.string().optional(),
  donor_dni_ruc: z.string().optional(),
  donor_type: z.enum(["persona_natural", "persona_juridica"]).optional(),
  amount_soles: z.number(),
  donation_type: z.string().optional(),
  date: z.string().optional(),
  candidate_name: z.string().optional(),
  electoral_process: z.string().optional(),
});

type FinancingRecord = z.infer<typeof FinancingRecordSchema>;

async function scrapeWithAgent(year: number): Promise<FinancingRecord[]> {
  console.log(`  Scraping Claridad with agent: year=${year}`);

  const urls = [
    `${CLARIDAD_BASE}/financiamiento-privado/informacion-financiera-campana-electoral`,
    `${CLARIDAD_BASE}/financiamiento-publico/financiamiento-publico-directo`,
  ];

  const agentResult = await firecrawl.agent({
    urls,
    prompt: `Extract ALL political party financing records for the year ${year} from the Claridad ONPE portal.
For each record extract:
- party_name: name of the political party
- party_type: type (partido, movimiento_regional, alianza, lista_independiente)
- financing_type: type of financing (privado, publico_directo, publico_indirecto)
- donor_name: name of the donor (if private financing)
- donor_dni_ruc: DNI or RUC of donor
- donor_type: persona_natural or persona_juridica
- amount_soles: amount in soles (numeric)
- donation_type: efectivo, especie, or bancarizado
- date: date of the contribution (YYYY-MM-DD format)
- candidate_name: candidate name if applicable
- electoral_process: electoral process code (e.g. EG2024, EM2022)

Navigate through all pages and filters. Look for year ${year}. Extract maximum data.`,
    schema: z.object({
      records: z.array(FinancingRecordSchema),
    }),
  } as Parameters<typeof firecrawl.agent>[0]);

  if (!agentResult.success) {
    console.warn(`  Agent failed: ${(agentResult as { error?: string }).error}`);
    return [];
  }

  const data = agentResult.data as { records?: FinancingRecord[] };
  return data?.records ?? [];
}

async function scrapeWithJsonApi(year: number, apiEndpoint: string): Promise<FinancingRecord[]> {
  console.log(`  Scraping Claridad via JSON API: year=${year}`);

  const result = await firecrawl.scrapeUrl(`${apiEndpoint}?year=${year}&format=json`, {
    formats: ["json"],
  } as Parameters<typeof firecrawl.scrapeUrl>[1]);

  if (!result.success) {
    console.warn(`  JSON API failed: ${(result as { error?: string }).error}`);
    return [];
  }

  const data = (result as { json?: unknown }).json;
  if (!Array.isArray(data)) return [];

  return data.map((item: Record<string, unknown>) => ({
    party_name: String(item.partido ?? item.party_name ?? ""),
    financing_type: (item.tipo_financiamiento as "privado" | "publico_directo" | "publico_indirecto") ?? "privado",
    donor_name: item.donante ? String(item.donante) : undefined,
    donor_dni_ruc: item.ruc ?? item.dni ? String(item.ruc ?? item.dni) : undefined,
    amount_soles: Number(item.monto ?? item.amount ?? 0),
    date: item.fecha ? String(item.fecha) : undefined,
    electoral_process: item.proceso ? String(item.proceso) : undefined,
  }));
}

async function insertRecords(records: FinancingRecord[], year: number): Promise<void> {
  if (records.length === 0) return;

  for (const r of records) {
    await sql`
      INSERT INTO financing_records (
        source, year, electoral_process, party_name, party_type,
        financing_type, donor_name, donor_dni_ruc, donor_type,
        amount_soles, donation_type, date, candidate_name
      ) VALUES (
        'claridad', ${year}, ${r.electoral_process ?? null}, ${r.party_name},
        ${r.party_type ?? null}, ${r.financing_type ?? null}, ${r.donor_name ?? null},
        ${r.donor_dni_ruc ?? null}, ${r.donor_type ?? null}, ${r.amount_soles},
        ${r.donation_type ?? null}, ${r.date ?? null}, ${r.candidate_name ?? null}
      )
      ON CONFLICT DO NOTHING
    `;
  }

  console.log(`  Inserted ${records.length} records for year ${year}`);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main
const yearsToProcess = yearArg ? [yearArg] : allFlag ? YEARS_RANGE : [new Date().getFullYear() - 1];

console.log(`Starting Claridad scraper: mode=${mode}, years=${yearsToProcess.join(", ")}`);

const JSON_API_ENDPOINT = process.env.CLARIDAD_API_ENDPOINT ?? "";

for (const year of yearsToProcess) {
  let records: FinancingRecord[];

  if (mode === "json" && JSON_API_ENDPOINT) {
    records = await scrapeWithJsonApi(year, JSON_API_ENDPOINT);
  } else {
    records = await scrapeWithAgent(year);
  }

  console.log(`  Year ${year}: ${records.length} records extracted`);
  await insertRecords(records, year);
  await delay(2000);
}

console.log("Done.");
