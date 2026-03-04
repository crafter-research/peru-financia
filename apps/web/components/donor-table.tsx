"use client";

import { useEffect, useMemo, useState } from "react";
import type { FinancingRecord } from "@/lib/db";

function formatSoles(amount: number): string {
  if (amount >= 1_000_000) return `S/ ${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `S/ ${(amount / 1_000).toFixed(1)}K`;
  return `S/ ${amount.toFixed(2)}`;
}

const FINANCING_TYPE_LABELS: Record<string, string> = {
  privado: "Privado",
  publico_directo: "Público directo",
  publico_indirecto: "Público indirecto",
};

const DONOR_TYPE_LABELS: Record<string, string> = {
  persona_natural: "Persona natural",
  persona_juridica: "Persona jurídica",
};

type Props = {
  year: number;
  partyFilter?: string;
};

export default function DonorTable({ year, partyFilter }: Props) {
  const [records, setRecords] = useState<FinancingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [financingTypeFilter, setFinancingTypeFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ action: "records", year: String(year) });
    if (partyFilter) params.set("party", partyFilter);
    if (financingTypeFilter) params.set("type", financingTypeFilter);

    fetch(`/api/financing?${params}`)
      .then((r) => r.json())
      .then(setRecords)
      .finally(() => setLoading(false));
  }, [year, partyFilter, financingTypeFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(
      (r) =>
        r.donor_name?.toLowerCase().includes(q) ||
        r.party_name.toLowerCase().includes(q) ||
        r.donor_dni_ruc?.toLowerCase().includes(q)
    );
  }, [records, search]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Buscar por donante, partido o RUC/DNI..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-3 py-2 bg-[#111] border border-[#1f1f1f] rounded-md text-sm text-foreground placeholder:text-[#888] focus:outline-none focus:border-[#444]"
        />
        <select
          value={financingTypeFilter}
          onChange={(e) => setFinancingTypeFilter(e.target.value)}
          className="px-3 py-2 bg-[#111] border border-[#1f1f1f] rounded-md text-sm text-foreground focus:outline-none focus:border-[#444]"
        >
          <option value="">Todos los tipos</option>
          <option value="privado">Privado</option>
          <option value="publico_directo">Público directo</option>
          <option value="publico_indirecto">Público indirecto</option>
        </select>
      </div>

      {loading ? (
        <div className="text-muted font-mono text-sm py-8 text-center animate-pulse">
          cargando...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#1f1f1f]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f1f1f] bg-[#111]">
                <th className="text-left px-4 py-3 text-[#888] font-normal">Donante</th>
                <th className="text-left px-4 py-3 text-[#888] font-normal">DNI/RUC</th>
                <th className="text-left px-4 py-3 text-[#888] font-normal">Partido</th>
                <th className="text-left px-4 py-3 text-[#888] font-normal">Tipo</th>
                <th className="text-right px-4 py-3 text-[#888] font-normal">Monto</th>
                <th className="text-left px-4 py-3 text-[#888] font-normal">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[#888] font-mono text-xs">
                    sin registros
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b border-[#111] hover:bg-[#111] transition-colors">
                    <td className="px-4 py-3 max-w-48 truncate">
                      {r.donor_name ?? <span className="text-[#444]">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#888]">
                      {r.donor_dni_ruc ?? "—"}
                    </td>
                    <td className="px-4 py-3 max-w-40 truncate">{r.party_name}</td>
                    <td className="px-4 py-3">
                      {r.financing_type ? (
                        <span
                          className="px-2 py-0.5 rounded text-xs border"
                          style={{
                            borderColor:
                              r.financing_type === "privado" ? "#c084fc33" : "#60a5fa33",
                            color: r.financing_type === "privado" ? "#c084fc" : "#60a5fa",
                            background:
                              r.financing_type === "privado" ? "#c084fc11" : "#60a5fa11",
                          }}
                        >
                          {FINANCING_TYPE_LABELS[r.financing_type] ?? r.financing_type}
                        </span>
                      ) : (
                        <span className="text-[#444]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span
                        className={
                          r.amount_soles >= 100_000
                            ? "text-[#c084fc]"
                            : r.amount_soles >= 10_000
                              ? "text-[#60a5fa]"
                              : "text-foreground"
                        }
                      >
                        {formatSoles(r.amount_soles)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#888] text-xs font-mono">
                      {r.date ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <div className="px-4 py-2 text-xs text-[#888] border-t border-[#1f1f1f] font-mono">
              {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
              {search && ` (filtrado de ${records.length})`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
