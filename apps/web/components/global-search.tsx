"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "@/lib/db";

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/financing?action=search&q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => {
          setResults(Array.isArray(data) ? data : []);
          setOpen(true);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function navigate(result: SearchResult) {
    setOpen(false);
    setQuery("");
    if (result.type === "donante") {
      router.push(`/donante/${encodeURIComponent(result.key)}`);
    } else {
      router.push(`/partido/${result.key.toLowerCase().replace(/\s+/g, "-")}`);
    }
  }

  function formatSoles(amount: number): string {
    if (amount >= 1_000_000) return `S/ ${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `S/ ${(amount / 1_000).toFixed(0)}K`;
    return `S/ ${amount.toFixed(0)}`;
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          placeholder="Buscar donante o partido..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="w-52 sm:w-72 px-3 py-1.5 bg-[#111] border border-[#1f1f1f] rounded-md text-sm placeholder:text-[#444] focus:outline-none focus:border-[#333] focus:w-80 transition-all"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] text-xs animate-pulse">
            ···
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 right-0 w-80 bg-[#111] border border-[#1f1f1f] rounded-lg shadow-xl z-50 overflow-hidden">
          {results.map((r) => (
            <button
              key={`${r.type}-${r.key}`}
              type="button"
              onClick={() => navigate(r)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#1a1a1a] transition-colors text-left"
            >
              <div className="min-w-0">
                <p className="text-sm truncate">{r.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-xs font-mono text-[#888]">{formatSoles(r.total)}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded border ${
                    r.type === "donante"
                      ? "border-[#60a5fa33] text-[#60a5fa] bg-[#60a5fa11]"
                      : "border-[#c084fc33] text-[#c084fc] bg-[#c084fc11]"
                  }`}
                >
                  {r.type}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
