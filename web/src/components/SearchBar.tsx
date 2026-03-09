"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  type: string;
  id: number | string;
  name: string;
  parent?: string;
  avg_price_m2?: number;
  count?: number;
}

function typeLabel(type: string): string {
  switch (type) {
    case "region": return "Kraj";
    case "district": return "Okres";
    case "ward": return "Obec";
    case "location": return "Lokalita";
    default: return type;
  }
}

function typeColor(type: string): string {
  switch (type) {
    case "region": return "#818cf8";
    case "district": return "#22c55e";
    case "ward": return "#f97316";
    case "location": return "#eab308";
    default: return "#6b7280";
  }
}

export default function SearchBar({ onSelect }: { onSelect?: (location: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results || []);
      setOpen(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(result: SearchResult) {
    setOpen(false);
    setQuery(result.name);

    if (onSelect) {
      onSelect(result.name);
      return;
    }

    switch (result.type) {
      case "region":
        router.push(`/prodeje/kraj/${result.id}`);
        break;
      case "district":
        router.push(`/prodeje/okres/${result.id}`);
        break;
      case "ward":
        router.push(`/prodeje/obec/${result.id}`);
        break;
      case "location":
        router.push(`/inzerce?location=${encodeURIComponent(result.name)}`);
        break;
    }
  }

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Hledat obec, okres, kraj..."
        className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-xl">
          {results.map((r, i) => (
            <button
              key={`${r.type}-${r.id}-${i}`}
              onClick={() => handleSelect(r)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-background first:rounded-t-lg last:rounded-b-lg"
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                  style={{
                    backgroundColor: `${typeColor(r.type)}22`,
                    color: typeColor(r.type),
                  }}
                >
                  {typeLabel(r.type)}
                </span>
                <span className="font-medium">{r.name}</span>
                {r.parent && (
                  <span className="text-muted">({r.parent})</span>
                )}
              </div>
              <div className="text-xs text-muted">
                {r.avg_price_m2
                  ? `${Math.round(r.avg_price_m2).toLocaleString("cs-CZ")} Kč/m²`
                  : r.count
                    ? `${r.count} inzerátů`
                    : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
