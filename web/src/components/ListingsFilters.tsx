"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const CATEGORIES = [
  { value: "", label: "Všechny kategorie" },
  { value: "byty-prodej", label: "Byty – prodej" },
  { value: "byty-najem", label: "Byty – nájem" },
  { value: "domy-prodej", label: "Domy – prodej" },
  { value: "domy-najem", label: "Domy – nájem" },
];

const SORTS = [
  { value: "price_asc", label: "Cena ↑" },
  { value: "price_desc", label: "Cena ↓" },
  { value: "price_m2_asc", label: "Kč/m² ↑" },
  { value: "price_m2_desc", label: "Kč/m² ↓" },
  { value: "area_desc", label: "Plocha ↓" },
  { value: "newest", label: "Nejnovější" },
];

export default function ListingsFilters() {
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
      router.push(`/nemovitosti?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={searchParams.get("category") || ""}
        onChange={(e) => update("category", e.target.value)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <select
        value={searchParams.get("sort") || "price_asc"}
        onChange={(e) => update("sort", e.target.value)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            Řadit: {s.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Lokalita..."
        defaultValue={searchParams.get("location") || ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            update("location", (e.target as HTMLInputElement).value);
          }
        }}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent"
      />

      <input
        type="number"
        placeholder="Min m²"
        defaultValue={searchParams.get("min_area") || ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            update("min_area", (e.target as HTMLInputElement).value);
          }
        }}
        className="w-24 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent"
      />

      <input
        type="number"
        placeholder="Max m²"
        defaultValue={searchParams.get("max_area") || ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            update("max_area", (e.target as HTMLInputElement).value);
          }
        }}
        className="w-24 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent"
      />
    </div>
  );
}
