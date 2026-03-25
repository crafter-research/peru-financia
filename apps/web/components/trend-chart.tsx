"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PartyTrend } from "@/lib/db";

function formatSoles(amount: number): string {
  if (amount >= 1_000_000) return `S/ ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `S/ ${(amount / 1_000).toFixed(0)}K`;
  return `S/ ${amount.toFixed(0)}`;
}

type Props = { partyName: string };

export default function TrendChart({ partyName }: Props) {
  const [raw, setRaw] = useState<PartyTrend[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/financing?action=trend&party=${encodeURIComponent(partyName)}`)
      .then((r) => r.json())
      .then((d) => setRaw(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [partyName]);

  if (loading) return <div className="h-48 flex items-center justify-center text-[#888] font-mono text-sm animate-pulse">cargando tendencia...</div>;

  if (raw.length === 0) return null;

  const years = [...new Set(raw.map((r) => r.year))].sort();
  const data = years.map((y) => {
    const yearRows = raw.filter((r) => r.year === y);
    return {
      year: y,
      total: yearRows.reduce((s, r) => s + r.total, 0),
    };
  });

  if (data.length < 2) {
    const d = data[0];
    if (!d) return null;
    return (
      <div className="border border-[#1f1f1f] rounded-xl p-6 bg-[#0d0d0d]">
        <p className="text-xs text-[#888] mb-3">Financiamiento registrado</p>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-2xl text-[#c084fc]">{formatSoles(d.total)}</span>
          <span className="text-sm text-[#888]">en {d.year}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-[#1f1f1f] rounded-xl p-6 bg-[#0d0d0d]">
      <p className="text-xs text-[#888] mb-4">Tendencia histórica de financiamiento</p>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
            <XAxis
              dataKey="year"
              tick={{ fill: "#888", fontSize: 10, fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatSoles}
              tick={{ fill: "#888", fontSize: 10, fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
              width={60}
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
              labelStyle={{ color: "#888" }}
              formatter={(value: number | undefined) => [formatSoles(value ?? 0), "Total"] as [string, string]}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#c084fc"
              strokeWidth={2}
              dot={{ fill: "#c084fc", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
