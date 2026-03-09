"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const CATEGORIES = [
  { value: "", label: "Všechny" },
  { value: "byty-prodej", label: "Byty – prodej" },
  { value: "byty-najem", label: "Byty – nájem" },
  { value: "domy-prodej", label: "Domy – prodej" },
  { value: "domy-najem", label: "Domy – nájem" },
];

const MIN_DROPS = [
  { value: "0", label: "Jakýkoliv" },
  { value: "5", label: "≥ 5%" },
  { value: "10", label: "≥ 10%" },
  { value: "15", label: "≥ 15%" },
  { value: "20", label: "≥ 20%" },
];

export default function Filters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.push(`/?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={searchParams.get("category") || ""}
        onChange={(e) => update("category", e.target.value)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <select
        value={searchParams.get("min_drop") || "0"}
        onChange={(e) => update("min_drop", e.target.value)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
      >
        {MIN_DROPS.map((d) => (
          <option key={d.value} value={d.value}>
            Propad: {d.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Lokalita (např. Praha 5)..."
        defaultValue={searchParams.get("location") || ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            update("location", (e.target as HTMLInputElement).value);
          }
        }}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
      />
    </div>
  );
}
