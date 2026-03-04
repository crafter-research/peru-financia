"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PartyBreakdown } from "@/lib/db";

function formatSoles(amount: number): string {
  if (amount >= 1_000_000) return `S/ ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `S/ ${(amount / 1_000).toFixed(0)}K`;
  return `S/ ${amount.toFixed(0)}`;
}

type Props = { year?: number; process?: string };

export default function PartyBarsChart({ year, process }: Props) {
  const [data, setData] = useState<PartyBreakdown[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ action: "breakdown" });
    if (process) params.set("process", process);
    else if (year) params.set("year", String(year));
    fetch(`/api/financing?${params}`)
      .then((r) => r.json())
      .then((d) => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [year, process]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80 text-[#888]">
        <span className="font-mono text-sm animate-pulse">cargando datos...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-[#888]">
        <span className="font-mono text-sm">sin datos</span>
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.total - a.total);

  return (
    <div style={{ height: Math.max(300, sorted.length * 36) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ left: 8, right: 80, top: 8, bottom: 8 }}
        >
          <XAxis
            type="number"
            tickFormatter={formatSoles}
            tick={{ fill: "#888", fontSize: 10, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="party_name"
            width={160}
            tick={{ fill: "#888", fontSize: 10 }}
            tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 20)}…` : v)}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#111",
              border: "1px solid #1f1f1f",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: "monospace",
            }}
            itemStyle={{ color: "#ededed" }}
            labelStyle={{ color: "#888", marginBottom: 4 }}
            formatter={(value: number | undefined, name: string | undefined) => [formatSoles(value ?? 0), name === "privado" ? "Privado" : "Público"] as [string, string]}
          />
          <Bar dataKey="privado" stackId="a" fill="#c084fc" radius={[0, 0, 0, 0]}>
            {sorted.map((entry, index) => (
              <Cell key={`privado-${index}`} fill="#c084fc" fillOpacity={0.8} />
            ))}
          </Bar>
          <Bar dataKey="publico" stackId="a" fill="#60a5fa" radius={[0, 2, 2, 0]}>
            {sorted.map((entry, index) => (
              <Cell key={`publico-${index}`} fill="#60a5fa" fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 px-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#c084fc]" />
          <span className="text-xs text-[#888]">Privado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#60a5fa]" />
          <span className="text-xs text-[#888]">Público</span>
        </div>
      </div>
    </div>
  );
}
