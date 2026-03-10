"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState, useEffect } from "react";

const SORTS = [
  { value: "newest",       label: "Nejnovější" },
  { value: "price_asc",    label: "Cena: nejnižší" },
  { value: "price_desc",   label: "Cena: nejvyšší" },
  { value: "price_m2_asc", label: "Kč/m²: nejnižší" },
  { value: "area_desc",    label: "Plocha: největší" },
];

const LAYOUTS = [
  "Garsonka", "1+kk", "1+1", "2+kk", "2+1", "3+kk", "3+1", "4+kk", "4+1", "5+",
];

function formatPriceCZK(val: string): string {
  const n = parseInt(val.replace(/\s/g, ""), 10);
  if (isNaN(n)) return val;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} M Kč`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} tis. Kč`;
  return `${n} Kč`;
}

interface DropdownProps {
  label: string;
  active?: boolean;
  children: React.ReactNode;
  onClear?: () => void;
}

function FilterDropdown({ label, active, children, onClear }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
          active
            ? "border-accent/50 bg-accent/10 text-accent-light"
            : "border-border bg-card text-foreground hover:border-accent/30 hover:bg-card-hover"
        }`}
      >
        {label}
        {active && onClear ? (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false); }}
            className="flex h-4 w-4 items-center justify-center rounded-full bg-accent/20 text-accent-light hover:bg-accent/40 transition-colors"
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </span>
        ) : (
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[240px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/50">
          {children}
        </div>
      )}
    </div>
  );
}

export default function ListingsFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sort      = searchParams.get("sort") || "newest";
  const minPrice  = searchParams.get("min_price") || "";
  const maxPrice  = searchParams.get("max_price") || "";
  const minArea   = searchParams.get("min_area") || "";
  const maxArea   = searchParams.get("max_area") || "";
  const layoutRaw = searchParams.get("layout") || "";
  const layout    = layoutRaw;
  const selectedLayouts = layoutRaw ? layoutRaw.split(",").filter(Boolean) : [];

  const [priceMin, setPriceMin] = useState(minPrice);
  const [priceMax, setPriceMax] = useState(maxPrice);
  const [areaMin, setAreaMin]   = useState(minArea);
  const [areaMax, setAreaMax]   = useState(maxArea);

  const update = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      params.delete("page");
      router.push(`/inzerce?${params.toString()}`);
    },
    [router, searchParams]
  );

  const priceActive = !!(minPrice || maxPrice);
  const areaActive  = !!(minArea || maxArea);
  const layoutActive = selectedLayouts.length > 0;

  const hasAny = priceActive || areaActive || layoutActive;

  function applyPrice() {
    update({ min_price: priceMin, max_price: priceMax });
  }
  function applyArea() {
    update({ min_area: areaMin, max_area: areaMax });
  }
  function clearPrice() {
    setPriceMin(""); setPriceMax("");
    update({ min_price: "", max_price: "" });
  }
  function clearArea() {
    setAreaMin(""); setAreaMax("");
    update({ min_area: "", max_area: "" });
  }

  const priceLabel = priceActive
    ? [minPrice && formatPriceCZK(minPrice), maxPrice && formatPriceCZK(maxPrice)].filter(Boolean).join(" – ")
    : "Cena";

  const areaLabel = areaActive
    ? [minArea && `${minArea} m²`, maxArea && `${maxArea} m²`].filter(Boolean).join(" – ")
    : "Plocha";

  const layoutLabel = selectedLayouts.length > 0 ? selectedLayouts.join(", ") : "Dispozice";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => update({ sort: e.target.value })}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground outline-none transition-colors focus:border-accent/50 cursor-pointer"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <div className="h-5 w-px bg-border/60 mx-0.5" />

        {/* Price filter */}
        <FilterDropdown
          label={priceLabel}
          active={priceActive}
          onClear={clearPrice}
        >
          <div className="p-4 space-y-3">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider">Cena</div>
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <label className="text-xs text-muted mb-1 block">Minimum</label>
                <input
                  type="number"
                  placeholder="0"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyPrice()}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/60"
                />
              </div>
              <span className="text-muted text-sm mt-4">–</span>
              <div className="flex-1">
                <label className="text-xs text-muted mb-1 block">Maximum</label>
                <input
                  type="number"
                  placeholder="∞"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyPrice()}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/60"
                />
              </div>
            </div>
            {/* Quick picks */}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: "do 2 M",  min: "",          max: "2000000" },
                { label: "do 5 M",  min: "",          max: "5000000" },
                { label: "do 10 M", min: "",          max: "10000000" },
                { label: "10 M+",   min: "10000000",  max: "" },
              ].map((q) => (
                <button
                  key={q.label}
                  onClick={() => { setPriceMin(q.min); setPriceMax(q.max); update({ min_price: q.min, max_price: q.max }); }}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-muted hover:border-accent/30 hover:text-foreground transition-colors"
                >
                  {q.label}
                </button>
              ))}
            </div>
            <button
              onClick={applyPrice}
              className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-light transition-colors"
            >
              Použít
            </button>
          </div>
        </FilterDropdown>

        {/* Area filter */}
        <FilterDropdown
          label={areaLabel}
          active={areaActive}
          onClear={clearArea}
        >
          <div className="p-4 space-y-3">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider">Plocha (m²)</div>
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <label className="text-xs text-muted mb-1 block">Min m²</label>
                <input
                  type="number"
                  placeholder="0"
                  value={areaMin}
                  onChange={(e) => setAreaMin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyArea()}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/60"
                />
              </div>
              <span className="text-muted text-sm mt-4">–</span>
              <div className="flex-1">
                <label className="text-xs text-muted mb-1 block">Max m²</label>
                <input
                  type="number"
                  placeholder="∞"
                  value={areaMax}
                  onChange={(e) => setAreaMax(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyArea()}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/60"
                />
              </div>
            </div>
            {/* Quick picks */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: "do 40 m²", min: "", max: "40" },
                { label: "40–80",    min: "40", max: "80" },
                { label: "80–120",   min: "80", max: "120" },
                { label: "120–200",  min: "120", max: "200" },
                { label: "200+",     min: "200", max: "" },
              ].map((q) => (
                <button
                  key={q.label}
                  onClick={() => { setAreaMin(q.min); setAreaMax(q.max); update({ min_area: q.min, max_area: q.max }); }}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-muted hover:border-accent/30 hover:text-foreground transition-colors"
                >
                  {q.label}
                </button>
              ))}
            </div>
            <button
              onClick={applyArea}
              className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-light transition-colors"
            >
              Použít
            </button>
          </div>
        </FilterDropdown>

        {/* Layout / Dispozice */}
        <FilterDropdown
          label={layoutLabel}
          active={layoutActive}
          onClear={() => update({ layout: "" })}
        >
          <div className="p-3">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 px-1">Dispozice</div>
            <div className="grid grid-cols-3 gap-1.5">
              {LAYOUTS.map((l) => {
                const active = selectedLayouts.includes(l);
                return (
                  <button
                    key={l}
                    onClick={() => {
                      const next = active
                        ? selectedLayouts.filter(x => x !== l)
                        : [...selectedLayouts, l];
                      update({ layout: next.join(",") });
                    }}
                    className={`rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "border-accent/50 bg-accent/15 text-accent-light"
                        : "border-border bg-background text-muted hover:border-accent/30 hover:text-foreground"
                    }`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </div>
        </FilterDropdown>

        {/* Clear all */}
        {hasAny && (
          <button
            onClick={() => {
              setPriceMin(""); setPriceMax(""); setAreaMin(""); setAreaMax("");
              update({ min_price: "", max_price: "", min_area: "", max_area: "", layout: "" });
            }}
            className="rounded-lg border border-red/25 bg-red/8 px-3 py-2 text-sm text-red/80 transition-colors hover:bg-red/15 hover:text-red"
          >
            Zrušit filtry
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {hasAny && (
        <div className="flex flex-wrap gap-1.5">
          {priceActive && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/8 px-2.5 py-1 text-xs font-medium text-accent-light">
              Cena: {priceLabel}
              <button onClick={clearPrice} className="hover:text-white transition-colors">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </span>
          )}
          {areaActive && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/8 px-2.5 py-1 text-xs font-medium text-accent-light">
              Plocha: {areaLabel}
              <button onClick={clearArea} className="hover:text-white transition-colors">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </span>
          )}
          {selectedLayouts.map(l => (
            <span key={l} className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/8 px-2.5 py-1 text-xs font-medium text-accent-light">
              {l}
              <button
                onClick={() => update({ layout: selectedLayouts.filter(x => x !== l).join(",") })}
                className="hover:text-white transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
