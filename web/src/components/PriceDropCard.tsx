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

function formatPrice(price: number): string {
  if (price >= 1_000_000) {
    return `${(price / 1_000_000).toFixed(1)} M Kč`;
  }
  return `${Math.round(price).toLocaleString("cs-CZ")} Kč`;
}

function formatCategory(cat: string): { label: string; color: string; bg: string } {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    "byty-prodej": { label: "Byt · Prodej",  color: "#818cf8", bg: "rgba(129,140,248,0.12)" },
    "byty-najem":  { label: "Byt · Nájem",   color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    "domy-prodej": { label: "Dům · Prodej",  color: "#f97316", bg: "rgba(249,115,22,0.12)" },
    "domy-najem":  { label: "Dům · Nájem",   color: "#eab308", bg: "rgba(234,179,8,0.12)" },
  };
  return map[cat] || { label: cat, color: "#6b7280", bg: "rgba(107,114,128,0.12)" };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "právě teď";
  if (hours < 24) return `před ${hours}h`;
  const days = Math.floor(hours / 24);
  return `před ${days}d`;
}

function useThumb(id: string) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          obs.disconnect();
          fetch(`/api/sreality-detail?id=${id}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d?.images?.[0]) setImgUrl(d.images[0]); })
            .catch(() => {});
        }
      },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [id]);
  return { ref, imgUrl };
}

function useSaved(id: string) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const arr: string[] = JSON.parse(localStorage.getItem("saved_listings") || "[]");
      setSaved(arr.includes(id));
    } catch { /* ignore */ }
  }, [id]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const arr: string[] = JSON.parse(localStorage.getItem("saved_listings") || "[]");
      const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
      localStorage.setItem("saved_listings", JSON.stringify(next));
      setSaved(next.includes(id));
    } catch { /* ignore */ }
  }

  return { saved, toggle };
}

export default function PriceDropCard({ drop }: { drop: PriceDrop }) {
  const rawUrl = drop.listing_url || drop.url;
  const srealityUrl = fixSrealityUrl(rawUrl, drop.listing_id, drop.title, drop.location, drop.category);
  const cat = formatCategory(drop.category);
  const { ref, imgUrl } = useThumb(drop.listing_id);
  const { saved, toggle } = useSaved(drop.listing_id);
  const saved_amount = drop.old_price - drop.new_price;
  const pct = drop.drop_pct;

  return (
    <div
      ref={ref}
      className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-red/30 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5"
    >
      {/* Image area */}
      <div className="relative h-40 shrink-0 overflow-hidden bg-card-hover">
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgUrl}
            alt={drop.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="h-full w-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #1a1d27 0%, #1f1a2e 100%)" }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-border">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
        )}

        {/* Drop badge — animated pulse for big drops */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          <span className={`rounded-lg px-2.5 py-1 text-sm font-bold text-white shadow-lg shadow-red/30 ${pct >= 15 ? "bg-red animate-pulse" : "bg-red"}`}>
            −{pct.toFixed(1)}%
          </span>
          {pct >= 15 && (
            <span className="rounded-md bg-red/20 px-1.5 py-0.5 text-[10px] font-bold text-red border border-red/30">
              HOT
            </span>
          )}
        </div>

        {/* Category + save */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
          <span
            className="rounded-md px-2 py-0.5 text-xs font-semibold backdrop-blur-sm"
            style={{ color: cat.color, background: cat.bg + "cc" }}
          >
            {cat.label}
          </span>
          <button
            onClick={toggle}
            aria-label={saved ? "Odebrat ze sledovaných" : "Sledovat"}
            className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-sm transition-all ${
              saved ? "bg-red/80 text-white hover:bg-red" : "bg-black/50 text-white/60 hover:bg-black/70 hover:text-white"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      <div className="flex flex-col flex-1 p-4">
        {/* Title */}
        <a
          href={`/listing/${drop.listing_id}`}
          className="block text-sm font-semibold leading-snug text-foreground hover:text-accent-light transition-colors line-clamp-2 mb-2"
        >
          {drop.title || `Nemovitost ${drop.listing_id}`}
        </a>

        {/* Location + area */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted mb-3">
          {drop.location && (
            <span className="flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span className="truncate max-w-[140px]">{drop.location}</span>
            </span>
          )}
          {drop.area_m2 && (
            <span className="flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="2" y="2" width="20" height="20" rx="2"/>
              </svg>
              {drop.area_m2} m²
            </span>
          )}
        </div>

        {/* Price change */}
        <div className="mt-auto">
          <div className="flex items-end gap-2 mb-0.5">
            <span className="text-xl font-bold text-green">{formatPrice(drop.new_price)}</span>
            <span className="text-sm text-muted line-through pb-0.5">{formatPrice(drop.old_price)}</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-green/80 font-medium">Ušetříte {formatPrice(saved_amount)}</span>
            <span className="text-xs text-muted">{timeAgo(drop.detected_at)}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <a
              href={`/listing/${drop.listing_id}`}
              className="flex-1 rounded-lg bg-accent/10 px-2.5 py-1.5 text-center text-xs font-semibold text-accent-light transition-colors hover:bg-accent/20"
            >
              Zobrazit detail
            </a>
            {srealityUrl && (
              <a
                href={srealityUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-border/80 hover:text-foreground"
              >
                ↗ Sreality
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
