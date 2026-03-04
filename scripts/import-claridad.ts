import * as XLSX from "xlsx";
import { neon } from "@neondatabase/serverless";
import { readdirSync } from "fs";
import { join } from "path";

const DB_URL = process.env.DATABASE_URL!;
const EXCEL_DIR = process.env.EXCEL_DIR ?? `${process.env.HOME}/Downloads/claridad`;

const sql = neon(DB_URL);

const PROCESO_META: Record<string, { year: number; electoral_process: string; financing_type: string }> = {
  "erm2018":    { year: 2018, electoral_process: "ERM2018", financing_type: "privado" },
  "emc2019":    { year: 2019, electoral_process: "EMC2019", financing_type: "privado" },
  "ece2020":    { year: 2020, electoral_process: "ECE2020", financing_type: "privado" },
  "emc2020-e1": { year: 2020, electoral_process: "EMC2020", financing_type: "privado" },
  "emc2020-e2": { year: 2020, electoral_process: "EMC2020", financing_type: "privado" },
  "eg2021-e1":  { year: 2021, electoral_process: "EG2021",  financing_type: "privado" },
  "eg2021-e2":  { year: 2021, electoral_process: "EG2021",  financing_type: "privado" },
  "erm2022-e1": { year: 2022, electoral_process: "ERM2022", financing_type: "privado" },
  "erm2022-e2": { year: 2022, electoral_process: "ERM2022", financing_type: "privado" },
  "emc2023-e1": { year: 2023, electoral_process: "EMC2023", financing_type: "privado" },
  "emc2023-e2": { year: 2023, electoral_process: "EMC2023", financing_type: "privado" },
  "emc2024-e1": { year: 2024, electoral_process: "EMC2024", financing_type: "privado" },
  "emc2024-e2": { year: 2024, electoral_process: "EMC2024", financing_type: "privado" },
  "emc2025-e1": { year: 2025, electoral_process: "EMC2025", financing_type: "privado" },
  "emc2025-e2": { year: 2025, electoral_process: "EMC2025", financing_type: "privado" },
  "eg2026-e1":  { year: 2026, electoral_process: "EG2026",  financing_type: "privado" },
  "eg2026-e2":  { year: 2026, electoral_process: "EG2026",  financing_type: "privado" },
};

function slugFromFilename(filename: string): string {
  return filename.replace("claridad-", "").replace(".xlsx", "");
}

function parseAmount(val: unknown): number | null {
  if (val == null || val === "") return null;
  const n = Number(String(val).replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? null : n;
}

function parseDate(val: unknown): string | null {
  if (val == null || val === "") return null;
  if (typeof val === "number") {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m}-${d}`;
  }
  return s || null;
}

async function processFile(filepath: string, slug: string) {
  const meta = PROCESO_META[slug];
  if (!meta) {
    console.log(`  Skipping unknown slug: ${slug}`);
    return 0;
  }

  const wb = XLSX.readFile(filepath);
  let totalInserted = 0;

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];

    if (rows.length < 6) continue;

    // Row 4 (index 4) is the real header row
    const headerRowIdx = rows.findIndex((r) =>
      (r as unknown[]).some((c) => String(c ?? "").toUpperCase().includes("ORGANIZACIÓN"))
    );
    if (headerRowIdx < 0) {
      console.log(`  Sheet "${sheetName}": no header row found, skipping`);
      continue;
    }

    const headers = (rows[headerRowIdx] as unknown[]).map((h) => String(h ?? "").toLowerCase().trim());
    console.log(`  Sheet "${sheetName}" headers (row ${headerRowIdx}):`, headers.filter(Boolean).join(" | "));

    const col = (keywords: string[]) =>
      headers.findIndex((h) => keywords.some((k) => h.includes(k)));

    // Fixed columns based on actual structure
    // N° | TIPO DE OP | ORGANIZACIÓN POLÍTICA | RUC | ÁMBITO | DEPARTAMENTO | ENTREGA | ESTADO | FECHA | ANEXO5A | ANEXO5B | ANEXO5C | ANEXO5D | ANEXO6A | ANEXO6B | ANEXO6C
    const colParty    = col(["organización", "organizacion"]);
    const colPartyType = col(["tipo de op", "tipo op", "tipo de org"]);
    const colRuc      = col(["ruc"]);
    const colDate     = col(["fecha"]);
    const colEntrega  = col(["entrega"]);
    // Montos: Anexo 5B = ingresos privados, Anexo 6A = gastos
    // We'll sum all annexes as total reported
    const colAnexo5A  = col(["5a"]);
    const colAnexo5B  = col(["5b"]);
    const colAnexo5C  = col(["5c"]);
    const colAnexo5D  = col(["5d"]);

    let inserted = 0;
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      if (!row || row.every((c) => c == null || c === "" || c === "-")) continue;

      const partyName = colParty >= 0 ? String(row[colParty] ?? "").trim() : "";
      if (!partyName || partyName === "-") continue;

      // Total ingresos = suma de Anexos 5A+5B+5C+5D
      const a5a = colAnexo5A >= 0 ? parseAmount(row[colAnexo5A]) ?? 0 : 0;
      const a5b = colAnexo5B >= 0 ? parseAmount(row[colAnexo5B]) ?? 0 : 0;
      const a5c = colAnexo5C >= 0 ? parseAmount(row[colAnexo5C]) ?? 0 : 0;
      const a5d = colAnexo5D >= 0 ? parseAmount(row[colAnexo5D]) ?? 0 : 0;
      const totalAmount = a5a + a5b + a5c + a5d;

      if (totalAmount <= 0) continue;

      const ruc = colRuc >= 0 ? String(row[colRuc] ?? "").trim() || null : null;
      const partyType = colPartyType >= 0 ? String(row[colPartyType] ?? "").trim() || null : null;
      const date = colDate >= 0 ? parseDate(row[colDate]) : null;
      const entrega = colEntrega >= 0 ? String(row[colEntrega] ?? "").trim() || null : null;

      await sql`
        INSERT INTO financing_records (
          source, year, electoral_process, party_name, party_type,
          financing_type, donor_dni_ruc, amount_soles, date, raw_data
        ) VALUES (
          'claridad',
          ${meta.year},
          ${meta.electoral_process},
          ${partyName},
          ${partyType},
          ${meta.financing_type},
          ${ruc},
          ${totalAmount},
          ${date},
          ${JSON.stringify({ sheet: sheetName, slug, entrega, anexos: { a5a, a5b, a5c, a5d } })}
        )
        ON CONFLICT DO NOTHING
      `;
      inserted++;
    }

    totalInserted += inserted;
    console.log(`  Sheet "${sheetName}": ${inserted} records inserted`);
  }

  return totalInserted;
}

// Main
const files = readdirSync(EXCEL_DIR)
  .filter((f) => f.startsWith("claridad-") && f.endsWith(".xlsx"))
  .sort();

console.log(`Found ${files.length} Excel files in ${EXCEL_DIR}\n`);

let grandTotal = 0;
for (const file of files) {
  const slug = slugFromFilename(file);
  const filepath = join(EXCEL_DIR, file);
  console.log(`Processing: ${file} (${slug})`);
  const n = await processFile(filepath, slug);
  grandTotal += n;
  console.log(`  → ${n} total records\n`);
}

console.log(`\nDone. Grand total: ${grandTotal} records inserted into Neon.`);
