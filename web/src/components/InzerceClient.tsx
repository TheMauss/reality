"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import ListingCard from "./ListingCard";
import ListingsFilters from "./ListingsFilters";
import type { ListingPin } from "./ListingsMap";

const ListingsMap = dynamic(() => import("./ListingsMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-card rounded-xl border border-border">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <span className="text-sm text-muted">Načítání mapy…</span>
      </div>
    </div>
  ),
});

interface Listing {
  id: string;
  title: string;
  url: string;
  location: string;
  area_m2: number | null;
  category: string;
  price: number;
  price_m2: number | null;
  first_seen_at: string;
}

interface SrealityDetail {
  images: string[];
  description: string;
}

interface Props {
  listings: Listing[];
  total: number;
  pages: number;
  currentPage: number;
  sp: Record<string, string>;
  promo?: React.ReactNode;
  defaultSplit?: boolean;
  compactMode?: boolean;
}

function formatPrice(p: number) {
  if (p >= 1_000_000) return `${(p / 1_000_000).toFixed(1)} M Kč`;
  return `${Math.round(p).toLocaleString("cs-CZ")} Kč`;
}

function extractSrealityId(url: string): string | null {
  return url.match(/\/(\d+)\/?(?:\?.*)?$/)?.[1] ?? null;
}

// ── Constants for compact mode ───────────────────────────────────────────────

const COMPACT_SORTS = [
  { value: "newest", label: "Nejnovější" },
  { value: "price_asc", label: "Cena ↑" },
  { value: "price_desc", label: "Cena ↓" },
  { value: "price_m2_asc", label: "Kč/m² ↑" },
  { value: "area_desc", label: "Plocha ↓" },
];

const COMPACT_LAYOUTS = [
  "Garsonka", "1+kk", "1+1", "2+kk", "2+1", "3+kk", "3+1", "4+kk", "4+1", "5+",
];

const CATEGORIES = [
  { value: "", label: "Vše" },
  { value: "byty-prodej", label: "Byty – prodej" },
  { value: "byty-najem", label: "Byty – pronájem" },
  { value: "domy-prodej", label: "Domy – prodej" },
  { value: "domy-najem", label: "Domy – pronájem" },
  { value: "pozemky-prodej", label: "Pozemky" },
];

function formatCompactPrice(val: string): string {
  const n = parseInt(val.replace(/\s/g, ""), 10);
  if (isNaN(n)) return val;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} tis.`;
  return `${n} Kč`;
}

// ── Compact search ───────────────────────────────────────────────────────────

function CompactSearch({ location }: { location?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(location || "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<{ label: string; sublabel: string; type: string }[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(query)}`)
        .then(r => r.ok ? r.json() : [])
        .then(data => { setResults(data); setOpen(true); })
        .catch(() => setResults([]));
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function navigate(loc: string) {
    setQuery(loc);
    setOpen(false);
    const params = new URLSearchParams(window.location.search);
    if (loc) params.set("location", loc);
    else params.delete("location");
    params.delete("page");
    router.push(`/inzerce?${params.toString()}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && results[activeIdx]) navigate(results[activeIdx].label);
      else navigate(query.trim());
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 focus-within:border-accent/50 transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setActiveIdx(-1); setOpen(true); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Hledat lokalitu…"
          className="bg-transparent text-sm text-foreground placeholder:text-muted/50 outline-none w-40 lg:w-56"
        />
        {query && (
          <button onClick={() => { setQuery(""); navigate(""); }} className="text-muted hover:text-foreground transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 z-[2000] mt-1.5 w-72 overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/50">
          {results.slice(0, 6).map((r, i) => (
            <button
              key={`${r.label}-${i}`}
              onMouseDown={e => { e.preventDefault(); navigate(r.label); }}
              onMouseEnter={() => setActiveIdx(i)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${i === activeIdx ? "bg-accent/10" : "hover:bg-card-hover"}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground truncate">{r.label}</div>
                {r.sublabel && <div className="text-xs text-muted truncate">{r.sublabel}</div>}
              </div>
              <span className="ml-auto shrink-0 text-[10px] text-muted/60">{r.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Toolbar dropdown ─────────────────────────────────────────────────────────

function ToolbarDropdown({ label, active, children, onClear }: {
  label: string;
  active?: boolean;
  children: React.ReactNode;
  onClear?: () => void;
}) {
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
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
          active
            ? "border-accent/50 bg-accent/10 text-accent-light"
            : "border-border bg-card text-foreground hover:border-accent/30"
        }`}
      >
        {label}
        {active && onClear ? (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onClear(); setOpen(false); }}
            className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent/20 text-accent-light hover:bg-accent/40"
          >
            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </span>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-[2000] mt-1.5 min-w-[220px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/50">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Filter slide-in panel ────────────────────────────────────────────────────

function FilterSlidePanel({
  open, onClose, sp, onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  sp: Record<string, string>;
  onUpdate: (updates: Record<string, string>) => void;
}) {
  const [priceMin, setPriceMin] = useState(sp.min_price || "");
  const [priceMax, setPriceMax] = useState(sp.max_price || "");
  const [areaMin, setAreaMin] = useState(sp.min_area || "");
  const [areaMax, setAreaMax] = useState(sp.max_area || "");

  if (!open) return null;

  function apply() {
    onUpdate({ min_price: priceMin, max_price: priceMax, min_area: areaMin, max_area: areaMax });
    onClose();
  }

  function clearAll() {
    setPriceMin(""); setPriceMax(""); setAreaMin(""); setAreaMax("");
    onUpdate({ min_price: "", max_price: "", min_area: "", max_area: "", layout: "", sort: "newest" });
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-14 right-0 bottom-0 z-[70] w-[380px] max-w-[90vw] bg-background border-l border-border/60 shadow-2xl shadow-black/50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 shrink-0">
          <h2 className="text-lg font-bold text-foreground">Filtry</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:text-foreground hover:bg-card-hover transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Kategorie */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Kategorie</h3>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  onClick={() => { onUpdate({ category: c.value }); onClose(); }}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    (sp.category || "") === c.value
                      ? "border-accent/50 bg-accent/15 text-accent-light"
                      : "border-border bg-card text-muted hover:border-accent/30 hover:text-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </section>

          {/* Cena */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Cena</h3>
            <div className="flex gap-2 items-center mb-3">
              <input type="number" placeholder="Min" value={priceMin} onChange={e => setPriceMin(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent/50" />
              <span className="text-muted">–</span>
              <input type="number" placeholder="Max" value={priceMax} onChange={e => setPriceMax(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent/50" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "do 2 M", min: "", max: "2000000" },
                { label: "do 5 M", min: "", max: "5000000" },
                { label: "do 10 M", min: "", max: "10000000" },
                { label: "10 M+", min: "10000000", max: "" },
              ].map(q => (
                <button key={q.label} onClick={() => { setPriceMin(q.min); setPriceMax(q.max); }}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted hover:border-accent/30 hover:text-foreground transition-colors">
                  {q.label}
                </button>
              ))}
            </div>
          </section>

          {/* Plocha */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Plocha (m²)</h3>
            <div className="flex gap-2 items-center mb-3">
              <input type="number" placeholder="Min m²" value={areaMin} onChange={e => setAreaMin(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent/50" />
              <span className="text-muted">–</span>
              <input type="number" placeholder="Max m²" value={areaMax} onChange={e => setAreaMax(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent/50" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "do 40 m²", min: "", max: "40" },
                { label: "40–80", min: "40", max: "80" },
                { label: "80–120", min: "80", max: "120" },
                { label: "120–200", min: "120", max: "200" },
                { label: "200+", min: "200", max: "" },
              ].map(q => (
                <button key={q.label} onClick={() => { setAreaMin(q.min); setAreaMax(q.max); }}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted hover:border-accent/30 hover:text-foreground transition-colors">
                  {q.label}
                </button>
              ))}
            </div>
          </section>

          {/* Dispozice */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Dispozice</h3>
            <div className="grid grid-cols-3 gap-2">
              {COMPACT_LAYOUTS.map(l => (
                <button key={l} onClick={() => { onUpdate({ layout: sp.layout === l ? "" : l }); onClose(); }}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    sp.layout === l
                      ? "border-accent/50 bg-accent/15 text-accent-light"
                      : "border-border bg-card text-muted hover:border-accent/30 hover:text-foreground"
                  }`}>
                  {l}
                </button>
              ))}
            </div>
          </section>

          {/* Řazení */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Řazení</h3>
            <div className="grid grid-cols-2 gap-2">
              {COMPACT_SORTS.map(s => (
                <button key={s.value} onClick={() => { onUpdate({ sort: s.value }); onClose(); }}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    (sp.sort || "newest") === s.value
                      ? "border-accent/50 bg-accent/15 text-accent-light"
                      : "border-border bg-card text-muted hover:border-accent/30 hover:text-foreground"
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/60 px-5 py-4 flex gap-3">
          <button onClick={clearAll}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted hover:text-foreground transition-colors">
            Zrušit vše
          </button>
          <button onClick={apply}
            className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-light transition-colors">
            Použít filtry
          </button>
        </div>
      </div>
    </>
  );
}

// ── Inline expanded card (left panel) ────────────────────────────────────────

function ExpandedCard({
  pin, detail, loading, carouselIdx, setCarouselIdx, onClose,
}: {
  pin: ListingPin;
  detail: SrealityDetail | null;
  loading: boolean;
  carouselIdx: number;
  setCarouselIdx: (i: number) => void;
  onClose: () => void;
}) {
  const images = detail?.images ?? [];
  const img = images[carouselIdx] ?? null;
  const hasPrev = carouselIdx > 0;
  const hasNext = carouselIdx < images.length - 1;

  return (
    <div className="mt-2 rounded-xl border border-accent/40 bg-card overflow-hidden shadow-xl shadow-accent/5">
      <div className="relative aspect-video w-full bg-muted/20">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}
        {img && <img src={img} alt={pin.title} className="w-full h-full object-cover" />}
        {!img && !loading && (
          <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-20">🏠</div>
        )}
        {images.length > 1 && (
          <>
            <button onClick={() => hasPrev && setCarouselIdx(carouselIdx - 1)} disabled={!hasPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full w-7 h-7 flex items-center justify-center text-lg leading-none disabled:opacity-30 transition-colors">‹</button>
            <button onClick={() => hasNext && setCarouselIdx(carouselIdx + 1)} disabled={!hasNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full w-7 h-7 flex items-center justify-center text-lg leading-none disabled:opacity-30 transition-colors">›</button>
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs rounded px-2 py-0.5">
              {carouselIdx + 1}/{images.length}
            </div>
          </>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-bold text-foreground text-base">{formatPrice(pin.price)}</div>
            {pin.price_m2 && <div className="text-xs text-accent-light">{Math.round(pin.price_m2).toLocaleString("cs-CZ")} Kč/m²</div>}
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full w-7 h-7 flex items-center justify-center text-muted hover:text-foreground hover:bg-card-hover transition-colors">✕</button>
        </div>
        <div className="text-sm text-foreground line-clamp-2">{pin.title}</div>
        <div className="text-xs text-muted">{pin.location}</div>
        {detail?.description && <p className="text-xs text-muted/80 line-clamp-3">{detail.description}</p>}
        <div className="flex gap-2 pt-1">
          <a href={`/listing/${pin.id}`} target="_blank" rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-accent text-white text-xs font-semibold text-center py-2 px-3 hover:bg-accent/90 transition-colors">
            Zobrazit detail ↗
          </a>
          <a href={pin.url} target="_blank" rel="noopener noreferrer"
            className="rounded-lg border border-border text-xs text-muted py-2 px-3 hover:bg-card-hover transition-colors">
            Sreality ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Map overlay popup ────────────────────────────────────────────────────────

function MapOverlay({
  pin, detail, loading, carouselIdx, setCarouselIdx, onClose,
}: {
  pin: ListingPin;
  detail: SrealityDetail | null;
  loading: boolean;
  carouselIdx: number;
  setCarouselIdx: (i: number) => void;
  onClose: () => void;
}) {
  const images = detail?.images ?? [];
  const img = images[carouselIdx] ?? null;
  const hasPrev = carouselIdx > 0;
  const hasNext = carouselIdx < images.length - 1;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[500] bg-background/96 backdrop-blur-xl border-t border-border/50 shadow-2xl shadow-black/40">
      <div className="flex gap-3 p-3" style={{ maxHeight: 176 }}>
        <div className="relative w-36 shrink-0 rounded-lg overflow-hidden bg-muted/20 self-stretch">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          )}
          {img && <img src={img} alt={pin.title} className="w-full h-full object-cover" />}
          {!img && !loading && (
            <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-20">🏠</div>
          )}
          {images.length > 1 && (
            <>
              <button onClick={() => hasPrev && setCarouselIdx(carouselIdx - 1)} disabled={!hasPrev}
                className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-base leading-none disabled:opacity-30 transition-colors">‹</button>
              <button onClick={() => hasNext && setCarouselIdx(carouselIdx + 1)} disabled={!hasNext}
                className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-base leading-none disabled:opacity-30 transition-colors">›</button>
              <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] rounded px-1.5 py-0.5">
                {carouselIdx + 1}/{images.length}
              </div>
            </>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-foreground">{formatPrice(pin.price)}</div>
              {pin.price_m2 && <div className="text-xs text-accent-light">{Math.round(pin.price_m2).toLocaleString("cs-CZ")} Kč/m²</div>}
            </div>
            <button onClick={onClose} className="shrink-0 rounded-full w-6 h-6 flex items-center justify-center text-muted hover:text-foreground hover:bg-card-hover transition-colors text-sm">✕</button>
          </div>
          <div className="text-xs text-foreground line-clamp-1">{pin.title}</div>
          <div className="text-xs text-muted line-clamp-1">{pin.location}</div>
          {detail?.description && <p className="text-xs text-muted/70 line-clamp-2 mt-0.5">{detail.description}</p>}
          <div className="flex gap-2 mt-auto">
            <a href={`/listing/${pin.id}`} target="_blank" rel="noopener noreferrer"
              className="rounded-lg bg-accent text-white text-xs font-semibold py-1.5 px-3 hover:bg-accent/90 transition-colors">
              Zobrazit detail ↗
            </a>
            <a href={pin.url} target="_blank" rel="noopener noreferrer"
              className="rounded-lg border border-border text-xs text-muted py-1.5 px-2.5 hover:bg-card-hover transition-colors">
              Sreality ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function InzerceClient({ listings, total, pages, currentPage, sp, promo, defaultSplit, compactMode }: Props) {
  const router = useRouter();
  const [view, setView] = useState<"list" | "map">(compactMode || defaultSplit ? "map" : "list");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [selectedPin, setSelectedPin] = useState<ListingPin | null>(null);
  const [detail, setDetail] = useState<SrealityDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const selectedPinRef = useRef<ListingPin | null>(null);
  selectedPinRef.current = selectedPin;

  const handlePinClick = useCallback((pin: ListingPin) => {
    if (selectedPinRef.current?.id === pin.id) {
      setSelectedPin(null);
      return;
    }
    setSelectedPin(pin);
    setDetail(null);
    setCarouselIdx(0);
    setDetailLoading(true);

    const srId = extractSrealityId(pin.url);
    if (srId) {
      fetch(`/api/sreality-detail?id=${srId}`)
        .then(r => r.json())
        .then(data => setDetail(data))
        .catch(() => {})
        .finally(() => setDetailLoading(false));
    } else {
      setDetailLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedPin) return;
    const el = cardRefs.current[selectedPin.id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedPin]);

  const handleClose = useCallback(() => {
    setSelectedPin(null);
    setDetail(null);
  }, []);

  const updateFilters = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v) params.set(k, v);
    }
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    params.delete("page");
    router.push(`/inzerce?${params.toString()}`);
  }, [router, sp]);

  // ── Compact mode ───────────────────────────────────────────────────────────

  if (compactMode) {
    const priceActive = !!(sp.min_price || sp.max_price);
    const areaActive = !!(sp.min_area || sp.max_area);
    const layoutActive = !!sp.layout;
    const hasActiveFilters = priceActive || areaActive || layoutActive;

    const priceLabel = priceActive
      ? [sp.min_price && formatCompactPrice(sp.min_price), sp.max_price && formatCompactPrice(sp.max_price)].filter(Boolean).join(" – ")
      : "Cena";

    return (
      <div className="fixed top-14 left-0 right-0 bottom-0 z-30 flex flex-col bg-background">
        {/* ── Toolbar ──────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border/60 bg-background/95 backdrop-blur-xl relative z-[1000]">
          <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto">
            {/* Search */}
            <CompactSearch location={sp.location} />

            <div className="h-5 w-px bg-border/60 shrink-0" />

            {/* Category */}
            <ToolbarDropdown
              label={CATEGORIES.find(c => c.value === (sp.category || ""))?.label || "Kategorie"}
              active={!!sp.category}
              onClear={() => updateFilters({ category: "" })}
            >
              <div className="p-2">
                {CATEGORIES.map(c => (
                  <button key={c.value} onClick={() => updateFilters({ category: c.value })}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      (sp.category || "") === c.value ? "bg-accent/10 text-accent-light font-medium" : "text-foreground hover:bg-card-hover"
                    }`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </ToolbarDropdown>

            {/* Price */}
            <ToolbarDropdown label={priceLabel} active={priceActive} onClear={() => updateFilters({ min_price: "", max_price: "" })}>
              <div className="p-3 space-y-2">
                <div className="flex gap-2 items-center">
                  <input type="number" placeholder="Od" defaultValue={sp.min_price}
                    onKeyDown={e => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value; updateFilters({ min_price: v }); } }}
                    className="w-24 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent/50" />
                  <span className="text-muted text-xs">–</span>
                  <input type="number" placeholder="Do" defaultValue={sp.max_price}
                    onKeyDown={e => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value; updateFilters({ max_price: v }); } }}
                    className="w-24 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent/50" />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {((sp.category || "").includes("najem")
                    ? [
                        { label: "do 10 tis.", min: "", max: "10000" },
                        { label: "do 15 tis.", min: "", max: "15000" },
                        { label: "do 20 tis.", min: "", max: "20000" },
                        { label: "do 30 tis.", min: "", max: "30000" },
                        { label: "30–50 tis.", min: "30000", max: "50000" },
                        { label: "50 tis.+", min: "50000", max: "" },
                      ]
                    : [
                        { label: "do 2 M", min: "", max: "2000000" },
                        { label: "do 5 M", min: "", max: "5000000" },
                        { label: "do 10 M", min: "", max: "10000000" },
                        { label: "5–10 M", min: "5000000", max: "10000000" },
                        { label: "10–20 M", min: "10000000", max: "20000000" },
                        { label: "20 M+", min: "20000000", max: "" },
                      ]
                  ).map(q => (
                    <button key={q.label} onClick={() => updateFilters({ min_price: q.min, max_price: q.max })}
                      className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-muted hover:border-accent/30 hover:text-foreground transition-colors">
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            </ToolbarDropdown>

            {/* Layout */}
            <ToolbarDropdown label={sp.layout || "Dispozice"} active={layoutActive} onClear={() => updateFilters({ layout: "" })}>
              <div className="p-2 grid grid-cols-3 gap-1.5">
                {COMPACT_LAYOUTS.map(l => (
                  <button key={l} onClick={() => updateFilters({ layout: sp.layout === l ? "" : l })}
                    className={`rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors ${
                      sp.layout === l
                        ? "border-accent/50 bg-accent/15 text-accent-light"
                        : "border-border bg-background text-muted hover:border-accent/30 hover:text-foreground"
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
            </ToolbarDropdown>

            {/* Sort */}
            <select value={sp.sort || "newest"} onChange={e => updateFilters({ sort: e.target.value })}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground outline-none cursor-pointer shrink-0">
              {COMPACT_SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            {/* All filters */}
            <button
              onClick={() => setFilterPanelOpen(true)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all shrink-0 ${
                hasActiveFilters
                  ? "border-accent/50 bg-accent/10 text-accent-light"
                  : "border-border bg-card text-foreground hover:border-accent/30"
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              Filtry
            </button>

            {hasActiveFilters && (
              <button onClick={() => updateFilters({ min_price: "", max_price: "", min_area: "", max_area: "", layout: "" })}
                className="text-xs text-red/70 hover:text-red transition-colors shrink-0 whitespace-nowrap">
                Zrušit
              </button>
            )}

            <div className="flex-1" />

            {/* Count */}
            <span className="text-xs text-muted tabular-nums shrink-0 whitespace-nowrap">
              {total.toLocaleString("cs-CZ")} inzerátů
            </span>

            {/* View toggle */}
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5 shrink-0">
              <button onClick={() => setView("map")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  view === "map" ? "bg-accent text-white shadow-sm" : "text-muted hover:text-foreground"
                }`}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                </svg>
                Mapa
              </button>
              <button onClick={() => setView("list")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  view === "list" ? "bg-accent text-white shadow-sm" : "text-muted hover:text-foreground"
                }`}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                Seznam
              </button>
            </div>
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────────── */}
        {view === "map" ? (
          <div className="flex flex-1 min-h-0">
            {/* Left: listing cards */}
            <div className="w-[380px] shrink-0 border-r border-border/60 flex flex-col bg-background">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 shrink-0 border-b border-border/40">
                <span className="text-sm font-semibold text-foreground">
                  {sp.location || "Všechny lokality"}
                </span>
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent-light tabular-nums">
                  {total.toLocaleString("cs-CZ")}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
                {selectedPin && !listings.some(l => l.id === selectedPin.id) && (
                  <div data-expanded-card="" className="rounded-xl ring-2 ring-accent shadow-lg shadow-accent/10">
                    <ExpandedCard pin={selectedPin} detail={detail} loading={detailLoading}
                      carouselIdx={carouselIdx} setCarouselIdx={setCarouselIdx} onClose={handleClose} />
                  </div>
                )}
                {listings.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center">
                    <div className="text-center space-y-2">
                      <div className="text-3xl opacity-20">🏠</div>
                      <p className="text-sm text-muted">Žádné inzeráty</p>
                    </div>
                  </div>
                ) : listings.map(l => (
                  <div key={l.id} ref={el => { cardRefs.current[l.id] = el; }}
                    className={`rounded-xl transition-all duration-200 cursor-pointer ${
                      selectedPin?.id === l.id ? "ring-2 ring-accent shadow-lg shadow-accent/10" : ""
                    }`}
                    onClick={e => {
                      const anchor = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
                      if (anchor && anchor.target !== "_blank") e.preventDefault();
                      if ((e.target as HTMLElement).closest("[data-expanded-card]")) return;
                      handlePinClick({ id: l.id, title: l.title, url: l.url, location: l.location, price: l.price, price_m2: l.price_m2, area_m2: l.area_m2, category: l.category, lat: 0, lon: 0 });
                    }}>
                    <ListingCard listing={l} compact />
                    {selectedPin?.id === l.id && (
                      <div data-expanded-card="">
                        <ExpandedCard pin={selectedPin} detail={detail} loading={detailLoading}
                          carouselIdx={carouselIdx} setCarouselIdx={setCarouselIdx} onClose={handleClose} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {pages > 1 && (
                <div className="border-t border-border/60 bg-card/60 px-4 py-2 shrink-0">
                  <div className="flex items-center justify-between gap-2">
                    {currentPage > 1 ? (
                      <a href={`/inzerce?${new URLSearchParams({ ...sp, page: String(currentPage - 1) })}`}
                        className="rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted hover:border-accent/40">← Předchozí</a>
                    ) : <div />}
                    <span className="text-xs text-muted tabular-nums">{currentPage} / {pages}</span>
                    {currentPage < pages ? (
                      <a href={`/inzerce?${new URLSearchParams({ ...sp, page: String(currentPage + 1) })}`}
                        className="rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted hover:border-accent/40">Další →</a>
                    ) : <div />}
                  </div>
                </div>
              )}
            </div>

            {/* Right: map */}
            <div className="flex-1 min-w-0 relative overflow-hidden isolate">
              <ListingsMap
                category={sp.category} location={sp.location}
                minPrice={sp.min_price} maxPrice={sp.max_price}
                minArea={sp.min_area} maxArea={sp.max_area}
                layout={sp.layout} selectedId={selectedPin?.id}
                onPinClick={handlePinClick}
              />
              {selectedPin && (
                <MapOverlay pin={selectedPin} detail={detail} loading={detailLoading}
                  carouselIdx={carouselIdx} setCarouselIdx={setCarouselIdx} onClose={handleClose} />
              )}
            </div>
          </div>
        ) : (
          /* List view in compact mode */
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-6 py-6">
              {listings.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border/60 bg-card py-20 text-center">
                  <div className="text-5xl opacity-15">🏠</div>
                  <p className="text-base font-semibold text-foreground mb-1">Žádné výsledky</p>
                  <p className="text-sm text-muted">Zkuste upravit nebo zrušit filtry</p>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {listings.map(l => <ListingCard key={l.id} listing={l} />)}
                </div>
              )}
              {pages > 1 && (() => {
                const win = 2;
                const start = Math.max(1, currentPage - win);
                const end = Math.min(pages, currentPage + win);
                const nums = Array.from({ length: end - start + 1 }, (_, i) => start + i);
                const makeHref = (p: number) => `/inzerce?${new URLSearchParams({ ...sp, page: String(p) })}`;
                return (
                  <div className="flex items-center justify-center gap-1.5 pt-6">
                    {currentPage > 1 && (
                      <a href={makeHref(currentPage - 1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card text-sm text-muted hover:border-accent/40">←</a>
                    )}
                    {start > 1 && <>
                      <a href={makeHref(1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card text-sm text-muted hover:border-accent/40">1</a>
                      {start > 2 && <span className="px-1 text-muted">…</span>}
                    </>}
                    {nums.map(n => (
                      <a key={n} href={makeHref(n)}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-semibold ${
                          n === currentPage ? "border-accent bg-accent text-white" : "border-border/70 bg-card text-muted hover:border-accent/40"
                        }`}>{n}</a>
                    ))}
                    {end < pages && <>
                      {end < pages - 1 && <span className="px-1 text-muted">…</span>}
                      <a href={makeHref(pages)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card text-sm text-muted hover:border-accent/40">{pages}</a>
                    </>}
                    {currentPage < pages && (
                      <a href={makeHref(currentPage + 1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card text-sm text-muted hover:border-accent/40">→</a>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Filter slide-in panel */}
        <FilterSlidePanel
          open={filterPanelOpen}
          onClose={() => setFilterPanelOpen(false)}
          sp={sp}
          onUpdate={updateFilters}
        />
      </div>
    );
  }

  // ── Normal (landing) mode ──────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-foreground">{total.toLocaleString("cs-CZ")}</span>
          <span className="text-sm text-muted">
            {total === 1 ? "inzerát" : total < 5 ? "inzeráty" : "inzerátů"}
            {sp.location && <> · <span className="font-medium text-foreground/80">{sp.location}</span></>}
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-border bg-background p-1">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              view === "list"
                ? "bg-accent text-white shadow-md shadow-accent/30"
                : "text-muted hover:text-foreground"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
            Seznam
          </button>
          <button
            onClick={() => setView("map")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              view === "map"
                ? "bg-accent text-white shadow-md shadow-accent/30"
                : "text-muted hover:text-foreground"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
            Mapa
          </button>
        </div>
      </div>

      {/* Filters */}
      <ListingsFilters />

      {/* Map split view */}
      {view === "map" ? (
        <div className="flex gap-4" style={{ height: "calc(100vh - 220px)", minHeight: 560 }}>
          {/* Left: listing cards */}
          <div className="w-[42%] shrink-0 flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-background">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 shrink-0 bg-card/60 backdrop-blur-sm">
              <div className="text-sm font-semibold text-foreground">
                {sp.location
                  ? <><span className="text-muted font-normal">Inzeráty · </span>{sp.location}</>
                  : "Inzeráty"}
              </div>
              <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-bold text-accent-light tabular-nums">
                {total.toLocaleString("cs-CZ")}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
              {selectedPin && !listings.some(l => l.id === selectedPin.id) && (
                <div data-expanded-card="" className="rounded-xl ring-2 ring-accent shadow-lg shadow-accent/10">
                  <ExpandedCard pin={selectedPin} detail={detail} loading={detailLoading}
                    carouselIdx={carouselIdx} setCarouselIdx={setCarouselIdx} onClose={handleClose} />
                </div>
              )}
              {listings.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="text-center space-y-2">
                    <div className="text-3xl opacity-20">🏠</div>
                    <p className="text-sm text-muted">Žádné inzeráty</p>
                  </div>
                </div>
              ) : (
                listings.map((l) => (
                  <div
                    key={l.id}
                    ref={el => { cardRefs.current[l.id] = el; }}
                    className={`rounded-xl transition-all duration-200 cursor-pointer ${selectedPin?.id === l.id ? "ring-2 ring-accent shadow-lg shadow-accent/10" : ""}`}
                    onClick={(e) => {
                      const anchor = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
                      if (anchor && anchor.target !== "_blank") e.preventDefault();
                      if ((e.target as HTMLElement).closest("[data-expanded-card]")) return;
                      handlePinClick({ id: l.id, title: l.title, url: l.url, location: l.location, price: l.price, price_m2: l.price_m2, area_m2: l.area_m2, category: l.category, lat: 0, lon: 0 });
                    }}
                  >
                    <ListingCard listing={l} compact />
                    {selectedPin?.id === l.id && (
                      <div data-expanded-card="">
                        <ExpandedCard pin={selectedPin} detail={detail} loading={detailLoading}
                          carouselIdx={carouselIdx} setCarouselIdx={setCarouselIdx} onClose={handleClose} />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            {pages > 1 && (
              <div className="border-t border-border/60 bg-card/60 px-4 py-2.5 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  {currentPage > 1 ? (
                    <a href={`/inzerce?${new URLSearchParams({ ...sp, page: String(currentPage - 1) })}`}
                      className="rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted transition-all hover:border-accent/40 hover:text-foreground">← Předchozí</a>
                  ) : <div />}
                  <span className="text-xs text-muted tabular-nums">{currentPage} / {pages}</span>
                  {currentPage < pages ? (
                    <a href={`/inzerce?${new URLSearchParams({ ...sp, page: String(currentPage + 1) })}`}
                      className="rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted transition-all hover:border-accent/40 hover:text-foreground">Další →</a>
                  ) : <div />}
                </div>
              </div>
            )}
          </div>

          {/* Right: map */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden rounded-2xl border border-border/70">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-card/60 backdrop-blur-sm px-4 py-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                <span className="text-sm font-semibold text-foreground">Mapa inzerátů</span>
              </div>
              <a href="/mapa" className="text-xs text-accent-light/70 hover:text-accent-light transition-colors">
                Cenová mapa ČR →
              </a>
            </div>
            <div className="flex-1 min-h-0 relative">
              <ListingsMap
                category={sp.category} location={sp.location}
                minPrice={sp.min_price} maxPrice={sp.max_price}
                minArea={sp.min_area} maxArea={sp.max_area}
                layout={sp.layout} selectedId={selectedPin?.id}
                onPinClick={handlePinClick}
              />
              {selectedPin && (
                <MapOverlay pin={selectedPin} detail={detail} loading={detailLoading}
                  carouselIdx={carouselIdx} setCarouselIdx={setCarouselIdx} onClose={handleClose} />
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border/60 bg-card py-20 text-center">
              <div className="text-5xl opacity-15">🏠</div>
              <div>
                <p className="text-base font-semibold text-foreground mb-1">Žádné výsledky</p>
                <p className="text-sm text-muted">Zkuste upravit nebo zrušit filtry</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((l, i) => (
                <React.Fragment key={l.id}>
                  <ListingCard listing={l} />
                  {promo && i === 5 && (
                    <div className="sm:col-span-2 lg:col-span-3">{promo}</div>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          {pages > 1 && (() => {
            const win = 2;
            const start = Math.max(1, currentPage - win);
            const end = Math.min(pages, currentPage + win);
            const nums = Array.from({ length: end - start + 1 }, (_, i) => start + i);
            const makeHref = (p: number) => `/inzerce?${new URLSearchParams({ ...sp, page: String(p) })}`;
            return (
              <div className="flex items-center justify-center gap-1.5 pt-2">
                {currentPage > 1 && (
                  <a href={makeHref(currentPage - 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card text-sm text-muted transition-all hover:border-accent/40 hover:text-foreground">←</a>
                )}
                {start > 1 && <>
                  <a href={makeHref(1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card text-sm text-muted transition-all hover:border-accent/40 hover:text-foreground">1</a>
                  {start > 2 && <span className="px-1 text-muted">…</span>}
                </>}
                {nums.map(n => (
                  <a key={n} href={makeHref(n)}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-semibold transition-all ${
                      n === currentPage
                        ? "border-accent bg-accent text-white shadow-lg shadow-accent/25"
                        : "border-border/70 bg-card text-muted hover:border-accent/40 hover:text-foreground"
                    }`}>{n}</a>
                ))}
                {end < pages && <>
                  {end < pages - 1 && <span className="px-1 text-muted">…</span>}
                  <a href={makeHref(pages)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card text-sm text-muted transition-all hover:border-accent/40 hover:text-foreground">{pages}</a>
                </>}
                {currentPage < pages && (
                  <a href={makeHref(currentPage + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card text-sm text-muted transition-all hover:border-accent/40 hover:text-foreground">→</a>
                )}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
