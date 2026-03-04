"use client";

import { useEffect, useRef, useState } from "react";
import { sankey, sankeyLinkHorizontal, sankeyLeft } from "d3-sankey";
import type { SankeyData } from "@/lib/db";

const PALETTE = [
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
  "#f472b6",
  "#2dd4bf",
];

function formatSoles(amount: number): string {
  if (amount >= 1_000_000) return `S/ ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `S/ ${(amount / 1_000).toFixed(0)}K`;
  return `S/ ${Math.round(amount)}`;
}

function pct(value: number, total: number): string {
  if (total === 0) return "0%";
  const p = (value / total) * 100;
  return p < 1 ? "<1%" : `${Math.round(p)}%`;
}

type Props = {
  year?: number;
  process?: string;
};

export default function SankeyChart({ year, process }: Props) {
  const [data, setData] = useState<SankeyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(containerRef.current);
    setWidth(containerRef.current.offsetWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ action: "sankey" });
    if (process) params.set("process", process);
    else if (year) params.set("year", String(year));
    fetch(`/api/financing?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year, process]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <span className="font-mono text-sm text-[#888] animate-pulse">cargando datos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-80">
        <span className="font-mono text-sm text-[#888]">error: {error}</span>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-80">
        <span className="font-mono text-sm text-[#888]">sin datos</span>
      </div>
    );
  }

  const NODE_WIDTH = 14;
  const NODE_PADDING = 14;
  const LABEL_W = 260;
  const marginLeft = LABEL_W + 8;
  const marginRight = LABEL_W + 8;
  const marginTop = 20;
  const marginBottom = 20;
  const innerW = Math.max(width - marginLeft - marginRight, 200);

  // With top-10 grouping: ~16 nodes max, keep it compact
  const height = 520;

  const graph = sankey<{ name: string }, { value: number }>()
    .nodeId((d) => d.name)
    .nodeAlign(sankeyLeft)
    .nodeWidth(NODE_WIDTH)
    .nodePadding(NODE_PADDING)
    .nodeSort((a, b) => {
      // "Otros" always last
      if (a.name === "Otros") return 1;
      if (b.name === "Otros") return -1;
      // descending by value
      return (b.value ?? 0) - (a.value ?? 0);
    })
    .extent([[0, 0], [innerW, height - marginTop - marginBottom]])(
    {
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.links.map((l) => ({
        source: data.nodes[l.source].name,
        target: data.nodes[l.target].name,
        value: l.value,
      })),
    }
  );

  const totalValue = graph.nodes
    .filter((n) => (n.depth ?? 0) === 0)
    .reduce((sum, n) => sum + (n.value ?? 0), 0);

  const maxDepth = Math.max(...graph.nodes.map((n) => n.depth ?? 0));

  const colorMap = new Map<string, string>();
  let paletteIdx = 0;
  graph.nodes.forEach((n) => {
    if (n.name === "Otros") {
      colorMap.set(n.name, "#555");
    } else {
      colorMap.set(n.name, PALETTE[paletteIdx % PALETTE.length]);
      paletteIdx++;
    }
  });

  const linkPath = sankeyLinkHorizontal();

  return (
    <div ref={containerRef} className="w-full relative">
      <svg
        width={width}
        height={height}
        style={{ display: "block", overflow: "visible" }}
      >
        <g transform={`translate(${marginLeft},${marginTop})`}>
          {graph.links.map((link, i) => {
            const srcNode = link.source as typeof graph.nodes[0];
            const color = colorMap.get(srcNode.name) ?? "#888";
            const d = linkPath(link as Parameters<typeof linkPath>[0]);
            return (
              <path
                key={i}
                d={d ?? ""}
                fill="none"
                stroke={color}
                strokeOpacity={0.18}
                strokeWidth={Math.max(1, link.width ?? 1)}
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  const tgt = link.target as typeof graph.nodes[0];
                  setTooltip({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    label: `${srcNode.name} → ${tgt.name}`,
                    value: link.value,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
                className="cursor-default transition-all hover:stroke-opacity-40"
                style={{ strokeOpacity: 0.18 }}
                onMouseOver={(e) => {
                  (e.currentTarget as SVGPathElement).style.strokeOpacity = "0.45";
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as SVGPathElement).style.strokeOpacity = "0.18";
                }}
              />
            );
          })}

          {graph.nodes.map((node) => {
            const color = colorMap.get(node.name) ?? "#888";
            const nx = node.x0 ?? 0;
            const ny = node.y0 ?? 0;
            const nw = (node.x1 ?? 0) - (node.x0 ?? 0);
            const nh = Math.max(1, (node.y1 ?? 0) - (node.y0 ?? 0));
            const mid = ny + nh / 2;
            const isLeft = (node.depth ?? 0) === 0;
            const isRight = (node.depth ?? 0) === maxDepth;
            const val = node.value ?? 0;
            const percentLabel = pct(val, totalValue);

            return (
              <g key={node.name}>
                <rect
                  x={nx}
                  y={ny}
                  width={nw}
                  height={nh}
                  fill={color}
                  rx={2}
                  ry={2}
                  fillOpacity={0.9}
                />
                {isLeft ? (
                  <g>
                    {nh > 14 ? (
                      <>
                        <text
                          x={nx - 10}
                          y={mid - 6}
                          textAnchor="end"
                          fontSize={11}
                          fill={color}
                          fontFamily="var(--font-geist-mono), monospace"
                          fontWeight="600"
                        >
                          <tspan fill={color}>{percentLabel}</tspan><tspan fill="#aaa"> - </tspan><tspan fill={color}>{formatSoles(val)}</tspan>
                        </text>
                        <text
                          x={nx - 10}
                          y={mid + 7}
                          textAnchor="end"
                          fontSize={10}
                          fill="#aaa"
                          fontFamily="var(--font-geist-sans), system-ui"
                          fontWeight="400"
                        >
                          {node.name}
                        </text>
                      </>
                    ) : (
                      <text
                        x={nx - 10}
                        y={mid + 4}
                        textAnchor="end"
                        fontSize={10}
                        fontFamily="var(--font-geist-mono), monospace"
                        fontWeight="600"
                      >
                        <tspan fill="#aaa" fontFamily="var(--font-geist-sans), system-ui" fontWeight="400">{node.name}</tspan><tspan fill="#aaa"> - </tspan><tspan fill={color}>{percentLabel}</tspan><tspan fill="#aaa"> - </tspan><tspan fill={color}>{formatSoles(val)}</tspan>
                      </text>
                    )}
                  </g>
                ) : isRight ? (
                  <g>
                    {nh > 14 ? (
                      <>
                        <text
                          x={nx + nw + 10}
                          y={mid - 6}
                          textAnchor="start"
                          fontSize={11}
                          fill={color}
                          fontFamily="var(--font-geist-mono), monospace"
                          fontWeight="600"
                        >
                          <tspan fill={color}>{percentLabel}</tspan><tspan fill="#aaa"> - </tspan><tspan fill={color}>{formatSoles(val)}</tspan>
                        </text>
                        <text
                          x={nx + nw + 10}
                          y={mid + 7}
                          textAnchor="start"
                          fontSize={10}
                          fill="#aaa"
                          fontFamily="var(--font-geist-sans), system-ui"
                          fontWeight="400"
                        >
                          {node.name}
                        </text>
                      </>
                    ) : (
                      <text
                        x={nx + nw + 10}
                        y={mid + 4}
                        textAnchor="start"
                        fontSize={10}
                        fontFamily="var(--font-geist-mono), monospace"
                        fontWeight="600"
                      >
                        <tspan fill="#aaa" fontFamily="var(--font-geist-sans), system-ui" fontWeight="400">{node.name}</tspan><tspan fill="#aaa"> - </tspan><tspan fill={color}>{percentLabel}</tspan><tspan fill="#aaa"> - </tspan><tspan fill={color}>{formatSoles(val)}</tspan>
                      </text>
                    )}
                  </g>
                ) : (
                  <g>
                    {nh > 14 && (
                      <text
                        x={nx + nw / 2}
                        y={ny - 10}
                        textAnchor="middle"
                        fontSize={11}
                        fill={color}
                        fontFamily="var(--font-geist-mono), monospace"
                        fontWeight="600"
                      >
                        <tspan fill={color}>{percentLabel}</tspan><tspan fill="#aaa"> - </tspan><tspan fill={color}>{formatSoles(val)}</tspan>
                      </text>
                    )}
                    {nh > 30 && (
                      <text
                        x={nx + nw / 2}
                        y={ny - 22}
                        textAnchor="middle"
                        fontSize={10}
                        fill="#aaa"
                        fontFamily="var(--font-geist-sans), system-ui"
                        fontWeight="400"
                      >
                        {node.name}
                      </text>
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 px-3 py-2 rounded-lg border border-[#2a2a2a] bg-[#111] text-xs shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <p className="text-[#888] mb-0.5">{tooltip.label}</p>
          <p className="font-mono text-foreground">{formatSoles(tooltip.value)}</p>
        </div>
      )}
    </div>
  );
}
