"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import DonorTable from "@/components/donor-table";

const SankeyChart = dynamic(() => import("@/components/sankey-chart"), { ssr: false });
const PartyBarsChart = dynamic(() => import("@/components/party-bars-chart"), { ssr: false });

function formatSoles(amount: number): string {
  if (amount >= 1_000_000) return `S/ ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `S/ ${(amount / 1_000).toFixed(0)}K`;
  return `S/ ${amount.toFixed(0)}`;
}

type PartyTotal = {
  party_name: string;
  total: number;
  party_type: string | null;
};

type Props = {
  processes: string[];
  defaultProcess: string;
  topParties: PartyTotal[];
};

export default function HomeClient({ processes, defaultProcess, topParties }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const processParam = searchParams.get("process") ?? "";
  const tabParam = searchParams.get("tab") as "sankey" | "table" | "ranking" | null;

  const [process, setProcess] = useState(processParam || defaultProcess);
  const [activeTab, setActiveTab] = useState<"sankey" | "table" | "ranking">(tabParam ?? "sankey");
  const [currentTopParties, setCurrentTopParties] = useState<PartyTotal[]>(topParties);

  useEffect(() => {
    if (!process) return;
    fetch(`/api/financing?action=totals&year=0&process=${encodeURIComponent(process)}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d) && d.length > 0) setCurrentTopParties(d);
      })
      .catch(() => {});
  }, [process]);

  function updateUrl(newProcess: string, newTab: string) {
    const params = new URLSearchParams();
    if (newProcess) params.set("process", newProcess);
    if (newTab !== "sankey") params.set("tab", newTab);
    router.replace(`/?${params.toString()}`, { scroll: false });
  }

  function onProcessChange(p: string) {
    setProcess(p);
    updateUrl(p, activeTab);
  }

  function onTabChange(t: "sankey" | "table" | "ranking") {
    setActiveTab(t);
    updateUrl(process, t);
  }

  const totalAmount = currentTopParties.reduce((sum, p) => sum + p.total, 0);

  const yearFromProcess = process ? process.match(/\d{4}/)?.[0] : undefined;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">¿Quién financia la política peruana?</h2>
        <p className="text-[#888] mt-2 max-w-2xl text-sm">
          Flujos de financiamiento político. Datos de ONPE — donantes, montos, partidos y procesos electorales.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label htmlFor="process-select" className="text-sm text-[#888]">Proceso</label>
          <select
            id="process-select"
            value={process}
            onChange={(e) => onProcessChange(e.target.value)}
            className="px-3 py-1.5 bg-[#111] border border-[#1f1f1f] rounded-md text-sm focus:outline-none focus:border-[#444]"
          >
            <option value="">Todos</option>
            {processes.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="text-xs text-[#888] font-mono">
          total: <span className="text-foreground">{formatSoles(totalAmount)}</span>
        </div>

        <div className="ml-auto flex gap-1 bg-[#111] border border-[#1f1f1f] rounded-md p-1">
          {(["sankey", "table", "ranking"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                activeTab === tab ? "bg-[#1f1f1f] text-foreground" : "text-[#888] hover:text-foreground"
              }`}
            >
              {tab === "sankey" ? "Sankey" : tab === "table" ? "Tabla" : "Ranking"}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-[#1f1f1f] rounded-xl p-6 bg-[#0d0d0d]">
        {activeTab === "sankey" && (
          <SankeyChart
            year={yearFromProcess ? Number(yearFromProcess) : 0}
            process={process || undefined}
          />
        )}
        {activeTab === "table" && (
          <DonorTable
            year={yearFromProcess ? Number(yearFromProcess) : undefined}
            electoralProcess={process || undefined}
          />
        )}
        {activeTab === "ranking" && (
          <PartyBarsChart process={process || undefined} year={yearFromProcess ? Number(yearFromProcess) : undefined} />
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-[#888] mb-3">
          Top partidos por financiamiento{process ? ` — ${process}` : ""}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {currentTopParties.slice(0, 9).map((party) => {
            const slug = party.party_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            const pct = totalAmount > 0 ? (party.total / totalAmount) * 100 : 0;
            return (
              <Link
                key={party.party_name}
                href={`/partido/${slug}`}
                className="border border-[#1f1f1f] rounded-lg p-4 hover:border-[#333] transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-[#c084fc] transition-colors">
                      {party.party_name}
                    </p>
                    {party.party_type && (
                      <p className="text-xs text-[#444] mt-0.5">{party.party_type}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm">{formatSoles(party.total)}</p>
                    <p className="text-xs text-[#888] mt-0.5">{pct.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="mt-3 h-1 bg-[#1f1f1f] rounded-full overflow-hidden">
                  <div className="h-full bg-[#c084fc] rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
