"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

function formatSoles(amount: number): string {
  if (amount >= 1_000_000) return `S/ ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `S/ ${(amount / 1_000).toFixed(0)}K`;
  return `S/ ${amount.toFixed(0)}`;
}

type DonorRow = {
  donor_name: string | null;
  donor_slug: string;
  donor_type: string | null;
  total: number;
  parties_count: number;
  donations_count: number;
};

type DonorStats = {
  total_donors: number;
  persona_natural: number;
  persona_juridica: number;
  autofinanciamiento: number;
  multi_party_donors: number;
  total_amount: number;
  top_donors: { donor_name: string | null; donor_slug: string; total: number; parties_count: number }[];
  amount_buckets: { bucket: string; count: number }[];
};

const PAGE_SIZE = 50;

export default function DonantesPage() {
  const [rows, setRows] = useState<DonorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DonorStats | null>(null);

  useEffect(() => {
    fetch("/api/financing?action=donor-stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);

  const load = useCallback((p: number, q: string) => {
    setLoading(true);
    const params = new URLSearchParams({
      action: "donors",
      page: String(p),
      pageSize: String(PAGE_SIZE),
    });
    if (q) params.set("q", q);
    fetch(`/api/financing?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(page, query);
  }, [page, query, load]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    setQuery(search);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const maxTopDonor = stats?.top_donors?.[0]?.total ?? 1;
  const maxBucket = Math.max(...(stats?.amount_buckets?.map((b) => b.count) ?? [1]));

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 flex items-center gap-4 text-xs text-[#888]">
        <Link href="/" className="hover:text-foreground transition-colors">Inicio</Link>
        <span className="text-[#333]">|</span>
        <span>Donantes</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Donantes</h2>
          <p className="text-[#888] mt-1 text-sm">
            Personas naturales y jurídicas que han financiado partidos políticos peruanos — datos ONPE.
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Total donantes", value: stats ? stats.total_donors.toLocaleString() : "—" },
            { label: "Personas naturales", value: stats ? stats.persona_natural.toLocaleString() : "—" },
            { label: "Personas jurídicas", value: stats ? stats.persona_juridica.toLocaleString() : "—" },
            { label: "Financian 2+ partidos", value: stats ? stats.multi_party_donors.toLocaleString() : "—", accent: true },
            { label: "Total donado", value: stats ? formatSoles(stats.total_amount) : "—" },
          ].map(({ label, value, accent }) => (
            <div key={label} className="border border-[#1f1f1f] rounded-lg p-4 bg-[#0d0d0d]">
              <p className="text-xs text-[#888]">{label}</p>
              <p className={`font-mono text-lg mt-1 ${accent ? "text-[#f87171]" : ""}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Top 10 donantes — barras horizontales */}
          <div className="border border-[#1f1f1f] rounded-xl p-5 bg-[#0d0d0d]">
            <h3 className="text-sm font-medium text-[#888] mb-4">Top 10 donantes por monto</h3>
            {stats?.top_donors ? (
              <div className="space-y-2.5">
                {stats.top_donors.map((d, i) => {
                  const pct = (d.total / maxTopDonor) * 100;
                  const name = d.donor_name ?? "Donante";
                  return (
                    <Link
                      key={d.donor_slug}
                      href={`/donante/${encodeURIComponent(d.donor_slug)}`}
                      className="block group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[#555] font-mono text-[10px] w-4 shrink-0">{i + 1}</span>
                        <span className="text-xs truncate group-hover:text-[#c084fc] transition-colors flex-1" title={name}>
                          {name}
                        </span>
                        <span className="font-mono text-xs text-[#888] shrink-0">{formatSoles(d.total)}</span>
                        {d.parties_count >= 2 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f87171]/10 text-[#f87171] shrink-0">
                            {d.parties_count} partidos
                          </span>
                        )}
                      </div>
                      <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden ml-6">
                        <div
                          className="h-full bg-[#c084fc] rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-[#888] font-mono text-sm animate-pulse">cargando...</div>
            )}
          </div>

          {/* Distribución por monto (histograma) + tipo donante */}
          <div className="space-y-4">

            {/* Distribución por monto */}
            <div className="border border-[#1f1f1f] rounded-xl p-5 bg-[#0d0d0d]">
              <h3 className="text-sm font-medium text-[#888] mb-4">Distribución por monto total donado</h3>
              {stats?.amount_buckets ? (
                <div className="space-y-2">
                  {stats.amount_buckets.map((b) => {
                    const pct = (b.count / maxBucket) * 100;
                    return (
                      <div key={b.bucket}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs text-[#888]">{b.bucket}</span>
                          <span className="font-mono text-xs">{b.count.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#60a5fa] rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-[#888] font-mono text-sm animate-pulse">cargando...</div>
              )}
            </div>

            {/* Tipo donante — donut en SVG simple */}
            <div className="border border-[#1f1f1f] rounded-xl p-5 bg-[#0d0d0d]">
              <h3 className="text-sm font-medium text-[#888] mb-4">Tipo de donante</h3>
              {stats ? (
                <div className="flex items-center gap-6">
                  <TinyDonut
                    segments={[
                      { value: stats.persona_natural, color: "#c084fc" },
                      { value: stats.persona_juridica, color: "#60a5fa" },
                      { value: stats.autofinanciamiento, color: "#34d399" },
                      { value: Math.max(0, stats.total_donors - stats.persona_natural - stats.persona_juridica - stats.autofinanciamiento), color: "#555" },
                    ]}
                  />
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#c084fc] shrink-0" />
                      <span className="text-xs text-[#888] flex-1">Persona natural</span>
                      <span className="font-mono text-xs">{stats.persona_natural.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#60a5fa] shrink-0" />
                      <span className="text-xs text-[#888] flex-1">Persona jurídica</span>
                      <span className="font-mono text-xs">{stats.persona_juridica.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#34d399] shrink-0" />
                      <span className="text-xs text-[#888] flex-1">Autofinanciamiento</span>
                      <span className="font-mono text-xs">{stats.autofinanciamiento.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-16 flex items-center justify-center text-[#888] font-mono text-sm animate-pulse">cargando...</div>
              )}
            </div>
          </div>
        </div>

        {/* Search + table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-sm font-medium text-[#888]">
              {total > 0 ? `${total.toLocaleString()} donantes` : "Todos los donantes"}
            </h3>
            <form onSubmit={onSearch} className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre del donante..."
                className="px-3 py-1.5 bg-[#111] border border-[#1f1f1f] rounded-md text-sm focus:outline-none focus:border-[#444] placeholder-[#444] w-56"
              />
              <button type="submit" className="px-3 py-1.5 bg-[#1f1f1f] hover:bg-[#2a2a2a] rounded-md text-sm transition-colors">
                Buscar
              </button>
              {query && (
                <button type="button" onClick={() => { setSearch(""); setQuery(""); setPage(0); }} className="px-2 py-1.5 text-[#888] hover:text-foreground text-sm transition-colors">
                  ✕
                </button>
              )}
            </form>
          </div>

          <div className="border border-[#1f1f1f] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-[#1f1f1f] text-[#888]">
                    <th className="text-left px-3 sm:px-4 py-3 font-medium whitespace-nowrap">Nombre</th>
                    <th className="text-left px-3 sm:px-4 py-3 font-medium whitespace-nowrap">Tipo</th>
                    <th className="text-right px-3 sm:px-4 py-3 font-medium whitespace-nowrap">Partidos</th>
                    <th className="text-right px-3 sm:px-4 py-3 font-medium whitespace-nowrap hidden sm:table-cell">Donaciones</th>
                    <th className="text-right px-3 sm:px-4 py-3 font-medium whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-[#888] font-mono text-sm">cargando...</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-[#888] font-mono text-sm">sin resultados</td></tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.donor_slug} className="border-b border-[#1f1f1f] last:border-0 hover:bg-[#0d0d0d] transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/donante/${encodeURIComponent(row.donor_slug)}`} className="hover:text-[#c084fc] transition-colors">
                            {row.donor_name ?? "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-[#888] text-xs">{row.donor_type ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {row.parties_count}
                          {row.parties_count >= 2 && (
                            <span className="ml-1.5 px-1.5 py-0.5 bg-[#f87171]/10 text-[#f87171] rounded text-[10px]">multi</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right font-mono text-xs text-[#888] hidden sm:table-cell">{row.donations_count}</td>
                        <td className="px-3 sm:px-4 py-3 text-right font-mono text-sm whitespace-nowrap">{formatSoles(row.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#888] text-xs font-mono">
                pág. {page + 1} / {totalPages}
              </span>
              <div className="flex gap-1">
                <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 bg-[#111] border border-[#1f1f1f] rounded-md text-sm disabled:opacity-30 hover:border-[#333] transition-colors">
                  anterior
                </button>
                <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 bg-[#111] border border-[#1f1f1f] rounded-md text-sm disabled:opacity-30 hover:border-[#333] transition-colors">
                  siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function TinyDonut({ segments }: { segments: { value: number; color: string }[] }) {
  const r = 28;
  const cx = 36;
  const cy = 36;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <svg width={72} height={72} className="shrink-0"><circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1a1a" strokeWidth={10} /></svg>;

  let offset = circ * 0.25;

  return (
    <svg width={72} height={72} className="shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1a1a" strokeWidth={10} />
      {segments.filter(s => s.value > 0).map((seg, i) => {
        const len = (seg.value / total) * circ;
        const el = (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={10}
            strokeDasharray={`${len} ${circ - len}`}
            strokeDashoffset={offset}
            strokeLinecap="butt"
          />
        );
        offset -= len;
        return el;
      })}
    </svg>
  );
}
