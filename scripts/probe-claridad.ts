/**
 * probe-claridad.ts
 *
 * Detecta si Claridad ONPE tiene una API REST subyacente interceptando
 * llamadas XHR/fetch mientras se interactúa con la página.
 *
 * Resultado:
 *   - Si hay API → imprime endpoints, headers, sample payloads
 *   - Si no  → recomienda estrategia con Firecrawl agent + proxy stealth
 */

import FirecrawlApp from "@mendable/firecrawl-js";

const CLARIDAD_BASE = "https://claridadportal.onpe.gob.pe";
const PAGES_TO_PROBE = [
  "/financiamiento-privado/informacion-financiera-campana-electoral",
  "/financiamiento-publico/financiamiento-publico-directo",
];

const apiKey = process.env.FIRECRAWL_API_KEY;
if (!apiKey) {
  console.error("FIRECRAWL_API_KEY not set");
  process.exit(1);
}

const firecrawl = new FirecrawlApp({ apiKey });

const INTERCEPT_SCRIPT = `
  window.__xhrCalls = [];
  window.__fetchCalls = [];

  const origXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    window.__xhrCalls.push({ type: 'xhr', method, url: url.toString() });
    return origXhrOpen.apply(this, [method, url, ...rest]);
  };

  const origFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
    window.__fetchCalls.push({ type: 'fetch', method: init?.method ?? 'GET', url });
    return origFetch.apply(this, arguments);
  };
`;

const COLLECT_SCRIPT = `
  JSON.stringify({
    xhr: window.__xhrCalls,
    fetch: window.__fetchCalls
  })
`;

async function probePage(url: string) {
  console.log(`\nProbing: ${url}`);

  const result = await firecrawl.scrapeUrl(CLARIDAD_BASE + url, {
    actions: [
      { type: "executeJavascript", script: INTERCEPT_SCRIPT },
      { type: "wait", milliseconds: 3000 },
      // Intentar interacción: click en primer select si existe
      { type: "executeJavascript", script: `
        const selects = document.querySelectorAll('select');
        if (selects.length > 0) {
          selects[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      `},
      { type: "wait", milliseconds: 2000 },
      // Recopilar llamadas capturadas
      { type: "executeJavascript", script: COLLECT_SCRIPT },
    ],
    formats: ["json"],
  } as Parameters<typeof firecrawl.scrapeUrl>[1]);

  if (!result.success) {
    console.error("  Scrape failed:", (result as { error?: string }).error);
    return null;
  }

  return result;
}

const results: { url: string; calls: { xhr: unknown[]; fetch: unknown[] } | null }[] = [];

for (const page of PAGES_TO_PROBE) {
  const r = await probePage(page);

  let calls: { xhr: unknown[]; fetch: unknown[] } | null = null;
  if (r?.actions) {
    const lastAction = r.actions[r.actions.length - 1];
    if (typeof lastAction?.result === "string") {
      try {
        calls = JSON.parse(lastAction.result);
      } catch {
        // ignore parse errors
      }
    }
  }

  results.push({ url: page, calls });
}

console.log("\n=== RESULTADOS ===\n");

let apiFound = false;

for (const { url, calls } of results) {
  console.log(`Página: ${url}`);
  if (!calls) {
    console.log("  No se pudieron capturar llamadas de red\n");
    continue;
  }

  const allCalls = [...calls.xhr, ...calls.fetch] as { type: string; method: string; url: string }[];
  const apiCalls = allCalls.filter(
    (c) =>
      c.url.includes("/api/") ||
      c.url.includes(".json") ||
      c.url.includes("?") ||
      c.url.includes("/v1/") ||
      c.url.includes("/v2/")
  );

  if (apiCalls.length > 0) {
    apiFound = true;
    console.log("  API ENCONTRADA:");
    for (const call of apiCalls) {
      console.log(`    [${call.type.toUpperCase()}] ${call.method} ${call.url}`);
    }
  } else {
    console.log(`  Llamadas detectadas: ${allCalls.length} total`);
    console.log("  Sin endpoints API obvios");
    if (allCalls.length > 0) {
      console.log("  Todas las URLs:");
      for (const call of allCalls.slice(0, 10)) {
        console.log(`    ${call.method} ${call.url}`);
      }
    }
  }
  console.log();
}

console.log("=== RECOMENDACIÓN ===\n");

if (apiFound) {
  console.log("✓ API REST detectada. Usar scrape-claridad.ts con modo JSON directo.");
  console.log("  Los endpoints encontrados arriba pueden usarse para bypass de CAPTCHA.");
} else {
  console.log("✗ Sin API REST visible. Usar Firecrawl agent con:");
  console.log(`
  firecrawl.agent({
    urls: ["${CLARIDAD_BASE}/financiamiento-privado/informacion-financiera-campana-electoral"],
    prompt: "Extract all political party financing records...",
    schema: FinancingRecordSchema,
    model: "spark-1-pro",
    maxCredits: 500
  })
  `);
  console.log("  Alternativamente: proxy stealth con rotación de IPs.");
}
