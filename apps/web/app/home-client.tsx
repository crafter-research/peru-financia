"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import DonorTable from "@/components/donor-table";

const SankeyChart = dynamic(() => import("@/components/sankey-chart"), { ssr: false });

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
  years: number[];
  defaultYear: number;
  topParties: PartyTotal[];
};

export default function HomeClient({ years, defaultYear, topParties }: Props) {
  const [year, setYear] = useState(defaultYear);
  const [activeTab, setActiveTab] = useState<"sankey" | "table">("sankey");

  const totalAmount = topParties.reduce((sum, p) => sum + p.total, 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          ¿Quién financia la política peruana?
        </h2>
        <p className="text-[#888] mt-2 max-w-2xl text-sm">
          Flujos de financiamiento político. Datos de ONPE — donantes, montos, partidos y procesos
          electorales.
        </p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label htmlFor="year-select" className="text-sm text-[#888]">
            Año
          </label>
          <select
            id="year-select"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-1.5 bg-[#111] border border-[#1f1f1f] rounded-md text-sm focus:outline-none focus:border-[#444]"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-[#888] font-mono">
          total: <span className="text-foreground">{formatSoles(totalAmount)}</span>
        </div>

        <div className="ml-auto flex gap-1 bg-[#111] border border-[#1f1f1f] rounded-md p-1">
          {(["sankey", "table"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                activeTab === tab
                  ? "bg-[#1f1f1f] text-foreground"
                  : "text-[#888] hover:text-foreground"
              }`}
            >
              {tab === "sankey" ? "Sankey" : "Tabla"}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "sankey" ? (
        <div className="border border-[#1f1f1f] rounded-xl p-6 bg-[#0d0d0d]">
          <SankeyChart year={year} />
        </div>
      ) : (
        <DonorTable year={year} />
      )}

      <div>
        <h3 className="text-sm font-medium text-[#888] mb-3">
          Top partidos por financiamiento — {year}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {topParties.slice(0, 9).map((party) => {
            const slug = party.party_name.toLowerCase().replace(/\s+/g, "-");
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
                  <div
                    className="h-full bg-[#c084fc] rounded-full"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
