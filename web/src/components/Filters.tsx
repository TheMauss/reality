"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

const CATEGORIES = [
  { value: "",             label: "Vše" },
  { value: "byty-prodej",  label: "Byty – prodej" },
  { value: "byty-najem",   label: "Byty – nájem" },
  { value: "domy-prodej",  label: "Domy – prodej" },
  { value: "domy-najem",   label: "Domy – nájem" },
];

const DROP_OPTS = [
  { value: "0",  label: "Jakýkoliv propad" },
  { value: "5",  label: "≥ 5%" },
  { value: "10", label: "≥ 10%" },
  { value: "15", label: "≥ 15%" },
  { value: "20", label: "≥ 20%" },
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
    [router, sp]
  );

  const activeCat = sp.get("category") || "";
  const activeDrop = sp.get("min_drop") || "0";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(c => (
          <button key={c.value}
            onClick={() => update("category", c.value)}
            className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all border ${
              activeCat === c.value
                ? "bg-accent border-accent text-white shadow-sm shadow-accent/20"
                : "border-border bg-background text-muted hover:border-border-light hover:text-foreground"
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Drop filter + location */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted font-medium uppercase tracking-wide">Min. propad:</span>
          <div className="flex gap-1.5">
            {DROP_OPTS.slice(1).map(d => (
              <button key={d.value}
                onClick={() => update("min_drop", activeDrop === d.value ? "0" : d.value)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                  activeDrop === d.value
                    ? "bg-red-dim border-red/30 text-red"
                    : "border-border bg-background text-muted hover:border-border-light hover:text-foreground"
                }`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted shrink-0">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <input
            type="text"
            placeholder="Lokalita (např. Praha 5)..."
            value={loc}
            onChange={e => setLoc(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") update("location", loc); }}
            className="input-base flex-1 text-[12px] py-1.5"
          />
          {(sp.get("location") || loc) && (
            <button
              onClick={() => { setLoc(""); update("location", ""); }}
              className="text-muted hover:text-foreground transition-colors text-[11px]">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Active filters summary */}
      {(activeCat || activeDrop !== "0" || sp.get("location")) && (
        <div className="flex items-center gap-2 pt-1 border-t border-border/40">
          <span className="text-[11px] text-muted">Aktivní filtry:</span>
          {activeCat && (
            <span className="pill bg-accent/10 text-accent-light border border-accent/20">
              {CATEGORIES.find(c => c.value === activeCat)?.label}
              <button onClick={() => update("category", "")} className="ml-1 opacity-60 hover:opacity-100">✕</button>
            </span>
          )}
          {activeDrop !== "0" && (
            <span className="pill bg-red-dim text-red border border-red/20">
              Min. {activeDrop}%
              <button onClick={() => update("min_drop", "0")} className="ml-1 opacity-60 hover:opacity-100">✕</button>
            </span>
          )}
          {sp.get("location") && (
            <span className="pill bg-border/50 text-muted-light border border-border">
              📍 {sp.get("location")}
              <button onClick={() => { setLoc(""); update("location", ""); }} className="ml-1 opacity-60 hover:opacity-100">✕</button>
            </span>
          )}
          <Link href="/" className="ml-auto text-[11px] text-muted hover:text-foreground transition-colors">
            Zrušit vše
          </Link>
        </div>
      )}
    </div>
  );
}
