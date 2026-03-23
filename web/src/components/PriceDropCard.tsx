"use client";

import { useEffect, useRef, useState } from "react";
import { fixSrealityUrl } from "@/lib/sreality-url";

interface PriceDrop {
  id: number;
  listing_id: string;
  old_price: number;
  new_price: number;
  drop_pct: number;
  detected_at: string;
  title: string;
  url: string;
  listing_url: string;
  location: string;
  category: string;
  area_m2: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")} M Kč`;
  return `${Math.round(n).toLocaleString("cs-CZ")} Kč`;
}

function fmtSaved(n: number): string {
  if (n >= 1_000_000) return `−${(n / 1_000_000).toFixed(1)} M Kč`;
  return `−${Math.round(n).toLocaleString("cs-CZ")} Kč`;
}

function timeAgo(d: string): string {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3_600_000);
  if (h < 1) return "Právě teď";
  if (h < 24) return `Před ${h}h`;
  const days = Math.floor(h / 24);
  return `Před ${days}d`;
}

const CAT: Record<string, { label: string; color: string }> = {
  "byty-prodej": { label: "Byt · Prodej",  color: "#818CF8" },
  "byty-najem":  { label: "Byt · Nájem",   color: "#10B981" },
  "domy-prodej": { label: "Dům · Prodej",  color: "#F97316" },
  "domy-najem":  { label: "Dům · Nájem",   color: "#F59E0B" },
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useThumb(id: string) {
  const [url, setUrl] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          obs.disconnect();
          fetch(`/api/sreality-detail?id=${id}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d?.images?.[0]) setUrl(d.images[0]); })
            .catch(() => {});
        }
      },
      { rootMargin: "400px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [id]);
  return { ref, url };
}

function useSaved(id: string) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const arr: string[] = JSON.parse(localStorage.getItem("saved_listings") || "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaved(arr.includes(id));
    } catch { /**/ }
  }, [id]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    try {
      const arr: string[] = JSON.parse(localStorage.getItem("saved_listings") || "[]");
      const next = arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
      localStorage.setItem("saved_listings", JSON.stringify(next));
      setSaved(next.includes(id));
      window.dispatchEvent(new Event("storage"));
    } catch { /**/ }
  }

  return { saved, toggle };
}

// ── Empty photo placeholder ───────────────────────────────────────────────────

function PhotoPlaceholder({ color }: { color: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center"
      style={{ background: `linear-gradient(145deg, #0D0C14 0%, ${color}12 100%)` }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-border/50">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

export default function PriceDropCard({ drop }: { drop: PriceDrop }) {
  const rawUrl = drop.listing_url || drop.url;
  const srealityUrl = fixSrealityUrl(rawUrl, drop.listing_id, drop.title, drop.location, drop.category);
  const cat = CAT[drop.category] ?? { label: drop.category, color: "#71717A" };
  const { ref, url: imgUrl } = useThumb(drop.listing_id);
  const { saved, toggle } = useSaved(drop.listing_id);
  const saved_amount = drop.old_price - drop.new_price;
  const pct = drop.drop_pct;
  const isHot = pct >= 15;

  return (
    <div ref={ref}
      className="group flex flex-col rounded-2xl border border-border bg-card overflow-hidden card-lift hover:border-red/20">

      {/* ── Photo ── */}
      <div className="relative h-48 shrink-0 overflow-hidden bg-card-hover">
        {imgUrl
          ? <img src={imgUrl} alt={drop.title}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
          : <PhotoPlaceholder color={cat.color} />
        }

        {/* Gradient veil */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

        {/* Drop badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className={`drop-badge ${isHot ? "animate-pulse" : ""}`}>
            ↓ {pct.toFixed(1)}%
          </span>
          {isHot && (
            <span className="pill bg-red-dim text-red border border-red/25 text-[10px]">
              HOT
            </span>
          )}
        </div>

        {/* Category + save */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold backdrop-blur-md"
            style={{ color: cat.color, background: `${cat.color}22` }}>
            {cat.label}
          </span>
          <button onClick={toggle} aria-label={saved ? "Odebrat" : "Uložit"}
            className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-sm transition-all ${
              saved ? "bg-red/80 text-white" : "bg-black/40 text-white/50 hover:bg-black/60 hover:text-white"
            }`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>

        {/* Price over image */}
        <div className="absolute bottom-0 inset-x-0 px-4 pb-3 pt-8">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-xl font-extrabold text-white tabular-nums leading-none">
                {fmtPrice(drop.new_price)}
              </div>
              <div className="text-xs text-white/50 line-through mt-0.5 tabular-nums">
                {fmtPrice(drop.old_price)}
              </div>
            </div>
            {drop.area_m2 && (
              <span className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold text-white/80 backdrop-blur-sm">
                {drop.area_m2} m²
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Title */}
        <a href={`/listing/${drop.listing_id}`}
          className="text-[13px] font-semibold leading-snug text-foreground hover:text-accent-light transition-colors line-clamp-2">
          {drop.title || `Nemovitost ${drop.listing_id}`}
        </a>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[11px] text-muted">
          {drop.location && (
            <span className="flex items-center gap-1 truncate min-w-0">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span className="truncate">{drop.location}</span>
            </span>
          )}
          <span className="shrink-0 ml-auto">{timeAgo(drop.detected_at)}</span>
        </div>

        {/* Savings highlight */}
        <div className="rounded-xl border border-green/15 bg-green-dim px-3 py-2 flex items-center justify-between">
          <span className="text-[11px] text-muted">Úspora</span>
          <span className="text-[13px] font-bold text-green tabular-nums">{fmtSaved(saved_amount)}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <a href={`/listing/${drop.listing_id}`}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-accent/12 hover:bg-accent/20 px-3 py-2 text-[12px] font-semibold text-accent-light transition-colors">
            Detail
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </a>
          {srealityUrl && (
            <a href={srealityUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-[11px] font-medium text-muted hover:text-foreground hover:border-border-light transition-colors">
              ↗ Sreality
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
