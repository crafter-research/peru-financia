/**
 * parse-pdfs.ts
 *
 * Parsea PDFs históricos de ONPE usando Firecrawl.
 * Cubre campañas 2011–2017.
 *
 * Uso:
 *   bun run scripts/parse-pdfs.ts
 *   bun run scripts/parse-pdfs.ts --pdf PP.pdf
 */

import FirecrawlApp from "@mendable/firecrawl-js";
import { neon } from "@neondatabase/serverless";

const PDF_BASE = "https://web.onpe.gob.pe/modFondosPartidarios/Verificacion_Fondos/";

const KNOWN_PDFS = [
  { filename: "PP.pdf", description: "Partidos Políticos", year: 2014, partyType: "partido" },
  {
    filename: "Mov_Regionales.pdf",
    description: "Movimientos Regionales",
    year: 2014,
    partyType: "movimiento_regional",
  },
  { filename: "OPLD.pdf", description: "Org. Pol. Locales Distritales", year: 2014, partyType: "lista_independiente" },
  { filename: "OPLP.pdf", description: "Org. Pol. Locales Provinciales", year: 2014, partyType: "lista_independiente" },
  {
    filename: "ERM2014-2.pdf",
    description: "ERM 2014 Segunda Vuelta",
    year: 2014,
    partyType: "movimiento_regional",
  },
];

const GOB_PE_COLLECTION = "https://www.gob.pe/institucion/onpe/colecciones/47768";

const args = process.argv.slice(2);
const specificPdf = args.includes("--pdf") ? args[args.indexOf("--pdf") + 1] : null;

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

type ParsedRecord = {
  year: number;
  party_name: string;
  party_type: string;
  donor_name?: string;
  donor_dni_ruc?: string;
  amount_soles: number;
  financing_type: string;
  source: string;
  raw_data: object;
};

async function parsePdf(
  url: string,
  year: number,
  partyType: string
): Promise<ParsedRecord[]> {
  console.log(`  Parsing PDF: ${url}`);

  const result = await firecrawl.scrape(url, {
    formats: ["markdown"],
  } as Parameters<typeof firecrawl.scrape>[1]);

  if (!result.success) {
    console.warn(`  Failed: ${(result as { error?: string }).error}`);
    return [];
  }

  const markdown = result.markdown ?? "";
  console.log(`  Extracted ${markdown.length} chars`);

  return extractRecordsFromMarkdown(markdown, year, partyType, result);
}

function extractRecordsFromMarkdown(
  markdown: string,
  year: number,
  partyType: string,
  raw: object
): ParsedRecord[] {
  const records: ParsedRecord[] = [];
  const lines = markdown.split("\n");

  let currentParty = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // Detectar nombre de partido (líneas en mayúsculas sin números)
    if (/^[A-ZÁÉÍÓÚÑ\s\-\.]{10,}$/.test(trimmed) && !trimmed.includes("|")) {
      currentParty = trimmed;
      continue;
    }

    // Detectar filas de tabla con montos
    if (trimmed.includes("|")) {
      const cols = trimmed
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cols.length >= 3) {
        const amountCol = cols.find((c) => /^\d[\d,.]+$/.test(c.replace(/[S/\s,]/g, "")));
        if (amountCol) {
          const amount = Number.parseFloat(amountCol.replace(/[^0-9.]/g, ""));
          if (!Number.isNaN(amount) && amount > 0) {
            records.push({
              year,
              party_name: currentParty || cols[0],
              party_type: partyType,
              donor_name: cols[0] !== currentParty ? cols[0] : undefined,
              amount_soles: amount,
              financing_type: "privado",
              source: "pdf",
              raw_data: { url: (raw as { url?: string }).url ?? "", line: trimmed },
            });
          }
        }
      }
    }
  }

  return records;
}

async function discoverPdfsFromCollection(): Promise<string[]> {
  console.log("Discovering PDFs from gob.pe collection...");

  const result = await firecrawl.scrape(GOB_PE_COLLECTION, {
    formats: ["links"],
  } as Parameters<typeof firecrawl.scrape>[1]);

  if (!result.success) return [];

  const links = (result as { links?: string[] }).links ?? [];
  return links.filter((l) => l.endsWith(".pdf"));
}

async function insertRecords(records: ParsedRecord[]): Promise<void> {
  if (records.length === 0) return;

  for (const r of records) {
    await sql`
      INSERT INTO financing_records (
        source, year, party_name, party_type, financing_type,
        donor_name, donor_dni_ruc, amount_soles, raw_data
      ) VALUES (
        ${r.source}, ${r.year}, ${r.party_name}, ${r.party_type}, ${r.financing_type},
        ${r.donor_name ?? null}, ${r.donor_dni_ruc ?? null}, ${r.amount_soles},
        ${JSON.stringify(r.raw_data)}
      )
      ON CONFLICT DO NOTHING
    `;
  }

  console.log(`  Inserted ${records.length} records`);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main
const pdfsToProcess = specificPdf
  ? KNOWN_PDFS.filter((p) => p.filename === specificPdf)
  : KNOWN_PDFS;

console.log(`Parsing ${pdfsToProcess.length} PDFs...`);

for (const { filename, year, partyType } of pdfsToProcess) {
  const url = PDF_BASE + filename;
  const records = await parsePdf(url, year, partyType);
  console.log(`  ${filename}: ${records.length} records extracted`);
  await insertRecords(records);
  await delay(2000);
}

// También intentar descubrir PDFs adicionales de la colección gob.pe
if (!specificPdf) {
  const additionalPdfs = await discoverPdfsFromCollection();
  console.log(`\nDiscovered ${additionalPdfs.length} additional PDFs from gob.pe collection`);
  for (const pdfUrl of additionalPdfs.slice(0, 10)) {
    // Limitar a 10
    console.log(`  ${pdfUrl}`);
  }
}

console.log("Done.");
