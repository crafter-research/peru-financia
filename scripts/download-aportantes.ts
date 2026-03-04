/**
 * download-aportantes.ts
 *
 * Descarga aportantes individuales desde la API de Claridad ONPE.
 * Usa Chrome CDP (puerto 9222) para las llamadas con reCAPTCHA v3.
 *
 * Requiere:
 *   - Chrome corriendo con --remote-debugging-port=9222
 *   - Portal de Claridad abierto en Chrome
 *
 * Uso:
 *   bun run scripts/download-aportantes.ts                       # imprime muestra
 *   bun run scripts/download-aportantes.ts --proceso EG2021      # solo EG2021
 *   bun run scripts/download-aportantes.ts --out /tmp/out.json   # guarda JSON
 *   bun run scripts/download-aportantes.ts --db                  # inserta en Neon
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";

const args = process.argv.slice(2);
const useDb = args.includes("--db") || !args.includes("--no-db");
const procesoFilter = args.includes("--proceso")
  ? args[args.indexOf("--proceso") + 1]
  : null;
const orgFilter = args.includes("--org")
  ? args[args.indexOf("--org") + 1]
  : null;
const outFile = args.includes("--out")
  ? args[args.indexOf("--out") + 1]
  : "/tmp/claridad-aportantes/backup.jsonl";

const RECAPTCHA_SITEKEY = "6Le-ll8sAAAAAIgw5bRICV05u8ttURN_urldjcTI";
const PORTAL_BASE =
  "https://claridadportal.onpe.gob.pe/apiciudadano/apiCiudadano";
const PAGE_SIZE = 50;

// Procesos conocidos: idProceso, entregas[], slug para consult API
const PROCESOS = [
  { id: 1, slug: "ERM2018", entregas: [1] },
  { id: 2, slug: "ECM2019", entregas: [4] },
  { id: 3, slug: "ECE2020", entregas: [6] },
  { id: 5, slug: "EG2021", entregas: [7, 8] },
  { id: 9, slug: "ERM2022", entregas: [15, 16] },
  { id: 10, slug: "ECM2023", entregas: [18, 19] },
  { id: 11, slug: "ECM2024", entregas: [20, 21] },
  { id: 13, slug: "ECM2025", entregas: [25, 26] },
];

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── CDP ─────────────────────────────────────────────────────────────────────

async function getCdpWsUrl(): Promise<string> {
  const r = await fetch("http://localhost:9222/json");
  const tabs = (await r.json()) as Array<{
    url: string;
    webSocketDebuggerUrl: string;
    title: string;
  }>;
  const target = tabs.find(
    (t) =>
      t.url.includes("claridadportal") || t.title?.includes("CLARIDAD")
  );
  if (!target) throw new Error("No Claridad tab found in Chrome");
  return target.webSocketDebuggerUrl;
}

async function cdpEval(wsUrl: string, code: string): Promise<unknown> {
  const ws = new WebSocket(wsUrl);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("CDP eval timeout (30s)"));
    }, 30000);

    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression: code, awaitPromise: true, returnByValue: true },
        })
      );
    });

    ws.addEventListener("message", (event: MessageEvent<string>) => {
      const msg = JSON.parse(event.data) as {
        id?: number;
        result?: { result?: { value?: unknown } };
        error?: { message: string };
      };
      if (msg.id === 1) {
        clearTimeout(timeout);
        ws.close();
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result?.result?.value);
      }
    });

    ws.addEventListener("error", () => {
      clearTimeout(timeout);
      ws.close();
      reject(new Error("WebSocket error"));
    });
  });
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function setupBrowser(wsUrl: string) {
  await cdpEval(
    wsUrl,
    `(function() {
      if (!window.__realFetch) {
        var iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        window.__realFetch = iframe.contentWindow.fetch.bind(iframe.contentWindow);
      }
      return 'ok';
    })()`
  );
}

async function getToken(wsUrl: string): Promise<string> {
  const token = await cdpEval(
    wsUrl,
    `(async function() {
      return await window.grecaptcha.execute(${JSON.stringify(RECAPTCHA_SITEKEY)}, {action: 'submit'});
    })()`
  );
  if (!token) throw new Error("reCAPTCHA token null");
  return token as string;
}

async function browserFetch(
  wsUrl: string,
  url: string,
  body: object
): Promise<unknown> {
  const bodyStr = JSON.stringify(body);
  const result = (await cdpEval(
    wsUrl,
    `(async function() {
      try {
        var r = await window.__realFetch(${JSON.stringify(url)}, {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: ${JSON.stringify(bodyStr)}
        });
        return JSON.stringify({status: r.status, body: await r.text()});
      } catch(e) {
        return JSON.stringify({error: e.message});
      }
    })()`
  )) as string;

  const parsed = JSON.parse(result) as {
    status?: number;
    body?: string;
    error?: string;
  };
  if (parsed.error) throw new Error(parsed.error);
  if (parsed.status !== 200)
    throw new Error(`HTTP ${parsed.status}: ${parsed.body?.slice(0, 200)}`);
  return JSON.parse(parsed.body!);
}

// ─── Org list ─────────────────────────────────────────────────────────────────

interface OrgInfo {
  nombreOrganizacion: string;
  idOrganizacion: number;
  ruc?: string;
}

async function getOrgsForEntrega(
  wsUrl: string,
  idProceso: number,
  idEntrega: number
): Promise<OrgInfo[]> {
  const result = (await cdpEval(
    wsUrl,
    `(async function() {
      var r = await window.__realFetch(
        ${JSON.stringify(`${PORTAL_BASE}/organizacion/listOrganizacionPresentacion?idEntrega=${idEntrega}&idProceso=${idProceso}`)},
        {method: 'POST'}
      );
      return await r.text();
    })()`
  )) as string;

  const data = JSON.parse(result) as {
    success: boolean;
    data?: OrgInfo[];
  };
  return data.data || [];
}

// ─── Aportantes ───────────────────────────────────────────────────────────────

interface Aportante {
  apellidos: string;
  nombres: string;
  dni: string;
  tipoAporte: string;
  fechaAporte: string;
  monto: number;
  anioEleccion: string;
  proceso: string;
}

interface FindDetailResp {
  pageNum: number;
  pageSize: number;
  pages: number;
  total: number;
  data?: {
    organzacion: string;
    proceso: string;
    listaAportantes: Aportante[];
  };
}

async function fetchAportantesPage(
  wsUrl: string,
  orgName: string,
  proceso: string,
  page: number
): Promise<FindDetailResp | null> {
  const token = await getToken(wsUrl);
  const body = {
    filters: [
      { value: orgName, code: "op" },
      { value: proceso, code: "process" },
    ],
    orders: { field: "", type: "DESC" },
    page,
    size: PAGE_SIZE,
    token,
  };

  try {
    return (await browserFetch(
      wsUrl,
      `${PORTAL_BASE}/consult/org/find-detail`,
      body
    )) as FindDetailResp;
  } catch (e) {
    console.warn(`    Warn: ${e}`);
    return null;
  }
}

// ─── Records ──────────────────────────────────────────────────────────────────

interface AportanteRecord {
  source: string;
  year: number;
  electoral_process: string;
  party_name: string;
  party_type: string;
  financing_type: string;
  donor_name: string;
  donor_dni_ruc: string;
  donor_type: string;
  amount_soles: number;
  donation_type: string;
  date: string | null;
}

function toRecord(a: Aportante, orgName: string): AportanteRecord {
  const year = parseInt(a.anioEleccion) || 2021;
  const dateStr = a.fechaAporte
    ? (() => {
        const [d, m, y] = a.fechaAporte.split("/");
        return y && m && d ? `${y}-${m}-${d}` : null;
      })()
    : null;

  return {
    source: "claridad_api",
    year,
    electoral_process: a.proceso,
    party_name: orgName,
    party_type: "organizacion_politica",
    financing_type: "privado",
    donor_name: `${a.apellidos} ${a.nombres}`.trim(),
    donor_dni_ruc: a.dni || "",
    donor_type: "persona_natural",
    amount_soles: a.monto,
    donation_type: a.tipoAporte === "E" ? "especie" : "efectivo",
    date: dateStr,
  };
}

// ─── Download one org+process ─────────────────────────────────────────────────

async function downloadOrgProcess(
  wsUrl: string,
  orgName: string,
  procesoSlug: string
): Promise<AportanteRecord[]> {
  const records: AportanteRecord[] = [];

  const first = await fetchAportantesPage(wsUrl, orgName, procesoSlug, 0);
  if (!first || !first.data) return records;

  const pages = first.pages || 1;
  console.log(`    ${first.total} aportantes, ${pages} pages`);

  for (const a of first.data.listaAportantes || []) {
    records.push(toRecord(a, orgName));
  }

  for (let p = 1; p < pages; p++) {
    await delay(600);
    const page = await fetchAportantesPage(wsUrl, orgName, procesoSlug, p);
    if (!page?.data?.listaAportantes) break;
    for (const a of page.data.listaAportantes) {
      records.push(toRecord(a, orgName));
    }
  }

  return records;
}

// ─── DB insert (batch) ───────────────────────────────────────────────────────

let _sql: ReturnType<typeof import("@neondatabase/serverless").neon> | null =
  null;

async function getSql() {
  if (!_sql) {
    const { neon } = await import("@neondatabase/serverless");
    _sql = neon(process.env.DATABASE_URL!);
  }
  return _sql;
}

async function insertRecords(records: AportanteRecord[]): Promise<number> {
  if (records.length === 0) return 0;
  const sql = await getSql();
  let inserted = 0;
  for (const r of records) {
    try {
      await sql`
        INSERT INTO financing_records (
          source, year, electoral_process, party_name, party_type,
          financing_type, donor_name, donor_dni_ruc, donor_type,
          amount_soles, donation_type, date
        ) VALUES (
          ${r.source}, ${r.year}, ${r.electoral_process}, ${r.party_name}, ${r.party_type},
          ${r.financing_type}, ${r.donor_name}, ${r.donor_dni_ruc}, ${r.donor_type},
          ${r.amount_soles}, ${r.donation_type}, ${r.date ? new Date(r.date) : null}
        )
        ON CONFLICT DO NOTHING
      `;
      inserted++;
    } catch (e) {
      console.error(`  DB error: ${e}`);
    }
  }
  return inserted;
}

// ─── Backup to JSONL (incremental) ───────────────────────────────────────────

function backupRecords(records: AportanteRecord[], file: string) {
  const dir = file.substring(0, file.lastIndexOf("/"));
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  for (const r of records) {
    appendFileSync(file, JSON.stringify(r) + "\n");
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Connecting to Chrome CDP...");
  const wsUrl = await getCdpWsUrl();
  console.log("Connected. Setting up browser...");
  await setupBrowser(wsUrl);

  if (useDb) {
    console.log(`DB mode: inserting to Neon as we go`);
  }
  if (outFile) {
    const dir = outFile.substring(0, outFile.lastIndexOf("/"));
    if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
    console.log(`Backup: ${outFile} (incremental JSONL)`);
  }

  let totalRecords = 0;
  let totalInserted = 0;
  const processedOrgs = new Set<string>();

  const processosList = procesoFilter
    ? PROCESOS.filter((p) => p.slug === procesoFilter)
    : PROCESOS;

  if (processosList.length === 0) {
    console.error(`Unknown process: ${procesoFilter}`);
    console.error(`Known: ${PROCESOS.map((p) => p.slug).join(", ")}`);
    process.exit(1);
  }

  for (const proceso of processosList) {
    console.log(`\n═══ ${proceso.slug} (id=${proceso.id}) ═══`);

    const orgNames = new Set<string>();
    for (const idEntrega of proceso.entregas) {
      try {
        const orgs = await getOrgsForEntrega(wsUrl, proceso.id, idEntrega);
        for (const o of orgs) {
          if (!orgFilter || o.nombreOrganizacion.includes(orgFilter)) {
            orgNames.add(o.nombreOrganizacion);
          }
        }
      } catch (e) {
        console.warn(`  Entrega ${idEntrega} error: ${e}`);
      }
    }

    if (orgNames.size === 0) {
      console.log("  No organizations found");
      continue;
    }
    console.log(`  ${orgNames.size} organizations`);

    for (const orgName of orgNames) {
      const key = `${proceso.slug}:${orgName}`;
      if (processedOrgs.has(key)) continue;
      processedOrgs.add(key);

      console.log(`\n  ─── ${orgName}`);
      const records = await downloadOrgProcess(wsUrl, orgName, proceso.slug);

      if (records.length === 0) {
        console.log("    No aportantes");
      } else {
        console.log(`    ✓ ${records.length} records`);
        totalRecords += records.length;

        // Backup immediately
        if (outFile) backupRecords(records, outFile);

        // Insert to DB immediately
        if (useDb) {
          const inserted = await insertRecords(records);
          totalInserted += inserted;
          console.log(`    ✓ DB: ${inserted} inserted (total: ${totalInserted})`);
        }
      }

      await delay(800);
    }

    console.log(`\n  ─── ${proceso.slug} done. Running total: ${totalRecords} records ───`);
  }

  console.log(`\n═══ COMPLETE: ${totalRecords} aportantes ═══`);
  if (useDb) console.log(`═══ DB: ${totalInserted} inserted ═══`);
  if (outFile) console.log(`═══ Backup: ${outFile} ═══`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
