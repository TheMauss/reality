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
  const hasFilters = !!(activeCat || activeDrop !== "0" || sp.get("location"));

  return (
    <div className="space-y-3">
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
      </div>

      {/* Row 2: Location search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Hledat lokalitu..."
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") update("location", loc); }}
            className="input-base w-full pl-9 pr-8 py-2 text-[13px]"
          />
          {loc && (
            <button
              onClick={() => { setLoc(""); update("location", ""); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-foreground transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {hasFilters && (
          <Link href="/" className="text-[12px] text-text-tertiary hover:text-text-secondary transition-colors">
            Zrušit filtry
          </Link>
        )}
      </div>
    </div>
  );
}
