/**
 * scrape-legacy-onpe.ts
 *
 * Scraper para el portal legacy de ONPE (sin CAPTCHA).
 * Cubre verificación de fondos 1995–2021 y aportes limpios 2005–2018.
 *
 * Uso:
 *   bun run scripts/scrape-legacy-onpe.ts --year 2020 --type partido
 *   bun run scripts/scrape-legacy-onpe.ts --all
 */

import FirecrawlApp from "@mendable/firecrawl-js";
import { neon } from "@neondatabase/serverless";

const LEGACY_VERIFICACION_BASE =
  "https://web.onpe.gob.pe/servicios/financiamiento-organizaciones-politicas/verificacion-control/";
const LEGACY_APORTES_BASE =
  "https://web.onpe.gob.pe/servicios/financiamiento-organizaciones-politicas/aportes-limpios/";

const PARTY_TYPES = [
  "partido",
  "movimiento_regional",
  "alianza",
  "lista_independiente",
  "organizacion_politica_local_distrital",
];

const YEAR_RANGE_VERIFICACION = Array.from({ length: 2021 - 1995 + 1 }, (_, i) => 1995 + i);
const YEAR_RANGE_APORTES = Array.from({ length: 2018 - 2005 + 1 }, (_, i) => 2005 + i);

const args = process.argv.slice(2);
const yearArg = args.includes("--year") ? Number(args[args.indexOf("--year") + 1]) : null;
const typeArg = args.includes("--type") ? args[args.indexOf("--type") + 1] : null;
const allFlag = args.includes("--all");

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

type ScrapedRecord = {
  year: number;
  party_name: string;
  party_type: string;
  donor_name?: string;
  donor_dni_ruc?: string;
  donor_type?: string;
  amount_soles: number;
  donation_type?: string;
  date?: string;
  source: string;
  raw_data: object;
};

async function scrapeVerificacion(year: number, partyType: string): Promise<ScrapedRecord[]> {
  console.log(`  Scraping verificacion: year=${year}, type=${partyType}`);

  const result = await firecrawl.scrapeUrl(LEGACY_VERIFICACION_BASE, {
    actions: [
      { type: "wait", milliseconds: 2000 },
      // Seleccionar año
      {
        type: "executeJavascript",
        script: `
          const yearSelect = document.querySelector('select[name*="year"], select[name*="anio"], select[id*="year"]');
          if (yearSelect) {
            yearSelect.value = '${year}';
            yearSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
        `,
      },
      { type: "wait", milliseconds: 1000 },
      // Seleccionar tipo de organización
      {
        type: "executeJavascript",
        script: `
          const typeSelect = document.querySelector('select[name*="type"], select[name*="tipo"], select[id*="tipo"]');
          if (typeSelect) {
            typeSelect.value = '${partyType}';
            typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
        `,
      },
      { type: "wait", milliseconds: 2000 },
    ],
    formats: ["markdown", "json"],
  } as Parameters<typeof firecrawl.scrapeUrl>[1]);

  if (!result.success) {
    console.warn(`    Failed: ${(result as { error?: string }).error}`);
    return [];
  }

  // Parse la tabla de resultados del markdown
  return parseVerificacionTable(result.markdown ?? "", year, partyType, result);
}

function parseVerificacionTable(
  markdown: string,
  year: number,
  partyType: string,
  raw: object
): ScrapedRecord[] {
  const records: ScrapedRecord[] = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    if (!line.includes("|")) continue;
    const cols = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cols.length < 4) continue;

    // Heurística: si la primera columna parece nombre de partido y hay un monto
    const potentialAmount = cols.find((c) => /^\d[\d,.]+$/.test(c.replace(/[S/\s]/g, "")));
    if (!potentialAmount) continue;

    const amount = Number.parseFloat(potentialAmount.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(amount) || amount <= 0) continue;

    records.push({
      year,
      party_name: cols[0],
      party_type: partyType,
      amount_soles: amount,
      source: "legacy_onpe",
      raw_data: raw,
    });
  }

  return records;
}

async function insertRecords(records: ScrapedRecord[]): Promise<void> {
  if (records.length === 0) return;

  for (const r of records) {
    await sql`
      INSERT INTO financing_records (
        source, year, party_name, party_type, financing_type,
        donor_name, donor_dni_ruc, donor_type, amount_soles,
        donation_type, date, raw_data
      ) VALUES (
        ${r.source}, ${r.year}, ${r.party_name}, ${r.party_type}, 'privado',
        ${r.donor_name ?? null}, ${r.donor_dni_ruc ?? null}, ${r.donor_type ?? null},
        ${r.amount_soles}, ${r.donation_type ?? null}, ${r.date ?? null},
        ${JSON.stringify(r.raw_data)}
      )
      ON CONFLICT DO NOTHING
    `;
  }

  console.log(`    Inserted ${records.length} records`);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main
const yearsToProcess = yearArg
  ? [yearArg]
  : allFlag
    ? YEAR_RANGE_VERIFICACION
    : [new Date().getFullYear() - 1];

const typesToProcess = typeArg ? [typeArg] : allFlag ? PARTY_TYPES : [PARTY_TYPES[0]];

console.log(
  `Starting legacy ONPE scraper: ${yearsToProcess.length} years × ${typesToProcess.length} types`
);

for (const year of yearsToProcess) {
  for (const partyType of typesToProcess) {
    const records = await scrapeVerificacion(year, partyType);
    await insertRecords(records);
    await delay(1500); // Rate limiting
  }
}

console.log("Done.");
