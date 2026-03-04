import { Suspense } from "react";
import { getAllElectoralProcesses, getPartyTotals } from "@/lib/db";
import HomeClient from "./home-client";

export const revalidate = 3600;

export default async function HomePage() {
  let processes: string[] = [];
  let defaultProcess = "";
  let topParties: { party_name: string; total: number; party_type: string | null }[] = [];

  try {
    processes = await getAllElectoralProcesses();
    if (processes.length > 0) {
      defaultProcess = processes[0];
      topParties = await getPartyTotals(undefined, defaultProcess);
    }
  } catch {
    // DB not connected yet — show empty state
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 pt-4 flex items-center gap-4 text-xs text-[#888]">
        <a href="https://github.com/crafter-station/plata-pe" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
        <span className="text-[#333]">|</span>
        <a href="https://www.onpe.gob.pe" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Datos: ONPE</a>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {processes.length === 0 ? (
          <EmptyState />
        ) : (
          <Suspense fallback={<div className="text-[#888] font-mono text-sm">cargando...</div>}>
            <HomeClient processes={processes} defaultProcess={defaultProcess} topParties={topParties} />
          </Suspense>
        )}
      </div>

      <footer className="border-t border-[#1f1f1f] px-6 py-6 mt-16">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-[#888]">
          <span>
            Datos: ONPE 1995–2026. Proyecto open-source bajo{" "}
            <a
              href="https://www.gnu.org/licenses/agpl-3.0.html"
              className="text-[#c084fc] hover:underline"
            >
              AGPL-3.0
            </a>
            .
          </span>
          <span>
            por{" "}
            <a
              href="https://crafterstation.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Crafter Station
            </a>
          </span>
        </div>
      </footer>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          ¿Quién financia la política peruana?
        </h2>
        <p className="text-[#888] mt-2 max-w-2xl">
          Visualización de flujos de financiamiento político con datos de ONPE 1995–2026. Donantes,
          montos, partidos y procesos electorales.
        </p>
      </div>

      <div className="border border-dashed border-[#1f1f1f] rounded-xl p-12 text-center space-y-4">
        <p className="text-[#888] font-mono text-sm">base de datos vacía</p>
        <p className="text-xs text-[#444]">
          Correr los scrapers para poblar datos:
        </p>
        <div className="bg-[#111] border border-[#1f1f1f] rounded-lg px-6 py-4 inline-block text-left">
          <code className="text-xs font-mono text-[#888] space-y-1 block">
            <span className="text-[#444]"># 1. Probar API de Claridad</span>
            <br />
            <span className="text-[#c084fc]">bun</span> probe-claridad
            <br />
            <br />
            <span className="text-[#444]"># 2. Scraper legacy ONPE (sin CAPTCHA)</span>
            <br />
            <span className="text-[#c084fc]">bun</span> scrape-legacy --year 2020
            <br />
            <br />
            <span className="text-[#444]"># 3. PDFs históricos</span>
            <br />
            <span className="text-[#c084fc]">bun</span> parse-pdfs
          </code>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Fuentes", value: "4", desc: "ONPE legacy, Claridad, PDFs" },
          { label: "Cobertura", value: "1995–2026", desc: "30 años de datos" },
          { label: "Licencia", value: "AGPL-3.0", desc: "Código abierto obligatorio" },
        ].map((stat) => (
          <div key={stat.label} className="border border-[#1f1f1f] rounded-lg p-4">
            <p className="text-xs text-[#888]">{stat.label}</p>
            <p className="text-xl font-semibold mt-1">{stat.value}</p>
            <p className="text-xs text-[#444] mt-1">{stat.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
