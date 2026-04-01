"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

const CATEGORIES = [
  { value: "", label: "Vše" },
  { value: "byty-prodej", label: "Byty · prodej" },
  { value: "byty-najem", label: "Byty · nájem" },
  { value: "domy-prodej", label: "Domy · prodej" },
  { value: "domy-najem", label: "Domy · nájem" },
];

const DROP_OPTS = [
  { value: "5", label: "5%+" },
  { value: "10", label: "10%+" },
  { value: "15", label: "15%+" },
  { value: "20", label: "20%+" },
];

export default function Filters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [loc, setLoc] = useState(sp.get("location") || "");

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value && value !== "0") params.set(key, value);
      else params.delete(key);
      params.delete("page");
      router.push(`/?${params.toString()}`);
    },
    [router, sp],
  );

  const activeCat = sp.get("category") || "";
  const activeDrop = sp.get("min_drop") || "0";
  const activeLocation = sp.get("location") || "";
  const hasFilters = !!(activeCat || activeDrop !== "0" || activeLocation);

  const catLabel = CATEGORIES.find((c) => c.value === activeCat)?.label;

  return (
    <div className="sticky top-12 z-40 -mx-5 px-5 md:-mx-8 md:px-8 lg:-mx-10 lg:px-10 py-3 bg-background/80 backdrop-blur-lg border-b border-border space-y-3">
      {/* Row 1: Category + Drop filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Categories */}
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => update("category", c.value)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
              activeCat === c.value
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-foreground hover:bg-surface-2"
            }`}
          >
            {c.label}
          </button>
        ))}

        <div className="w-px h-5 bg-border mx-1" />

        {/* Drop thresholds */}
        {DROP_OPTS.map((d) => (
          <button
            key={d.value}
            onClick={() => update("min_drop", activeDrop === d.value ? "0" : d.value)}
            className={`px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-all ${
              activeDrop === d.value
                ? "bg-red/10 text-red"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {d.label}
          </button>
        ))}

        <div className="w-px h-5 bg-border mx-1" />

        {/* Location search */}
        <div className="relative flex-1 max-w-[220px] min-w-[140px]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Lokalita..."
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") update("location", loc); }}
            className="input-base w-full pl-8 pr-7 py-1.5 text-[12px]"
          />
          {loc && (
            <button
              onClick={() => { setLoc(""); update("location", ""); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-foreground transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeCat && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-dim px-2.5 py-1 text-[11px] font-medium text-accent-light">
              {catLabel}
              <button onClick={() => update("category", "")} className="ml-0.5 hover:text-foreground transition-colors">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          )}
          {activeDrop !== "0" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-dim px-2.5 py-1 text-[11px] font-medium text-red">
              Propad ≥ {activeDrop}%
              <button onClick={() => update("min_drop", "0")} className="ml-0.5 hover:text-foreground transition-colors">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          )}
          {activeLocation && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2.5 py-1 text-[11px] font-medium text-text-secondary">
              {activeLocation}
              <button onClick={() => { setLoc(""); update("location", ""); }} className="ml-0.5 hover:text-foreground transition-colors">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          )}
          <Link href="/" className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors ml-1">
            Zrušit vše
          </Link>
        </div>
      )}
    </div>
  );
}
