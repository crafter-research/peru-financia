"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  Sankey,
  Tooltip,
} from "recharts";
import type { SankeyData } from "@/lib/db";

const COLORS = [
  "#c084fc",
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#38bdf8",
  "#4ade80",
  "#fb923c",
  "#e879f9",
];

function formatSoles(amount: number): string {
  if (amount >= 1_000_000) return `S/ ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `S/ ${(amount / 1_000).toFixed(0)}K`;
  return `S/ ${amount.toFixed(0)}`;
}

type CustomNodeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: { name: string; value: number };
};

function CustomNode({ x = 0, y = 0, width = 0, height = 0, index = 0, payload }: CustomNodeProps) {
  const color = COLORS[index % COLORS.length];
  const name = payload?.name ?? "";
  const value = payload?.value ?? 0;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={0.85}
        rx={3}
        ry={3}
      />
      {height > 20 && (
        <text
          x={x + width + 8}
          y={y + height / 2}
          fill="#ededed"
          fontSize={11}
          fontFamily="var(--font-geist-sans), system-ui"
          dominantBaseline="middle"
        >
          {name.length > 22 ? `${name.slice(0, 20)}…` : name}
          <tspan fill="#888" fontSize={10}> {formatSoles(value)}</tspan>
        </text>
      )}
    </g>
  );
}

type Props = {
  year: number;
};

export default function SankeyChart({ year }: Props) {
  const [data, setData] = useState<SankeyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/financing?action=sankey&year=${year}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80 text-muted">
        <span className="font-mono text-sm animate-pulse">cargando datos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-80 text-destructive">
        <span className="font-mono text-sm">error: {error}</span>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-muted">
        <span className="font-mono text-sm">sin datos para {year}</span>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: Math.max(400, data.nodes.length * 24) }}>
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={data}
          node={<CustomNode />}
          nodePadding={16}
          nodeWidth={10}
          margin={{ left: 10, right: 200, top: 20, bottom: 20 }}
          link={{ stroke: "#1f1f1f", strokeOpacity: 0.6 }}
        >
          <Tooltip
            contentStyle={{
              background: "#111",
              border: "1px solid #1f1f1f",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: "var(--font-geist-mono)",
              color: "#ededed",
            }}
            formatter={(value: number) => [formatSoles(value), "Monto"]}
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}
