"use client";

import { useEffect, useRef, useState } from "react";
import { fixSrealityUrl } from "@/lib/sreality-url";
import { useFavorites } from "@/components/FavoritesProvider";

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
  sources_json?: string;
}

const SOURCE_NAME: Record<string, string> = {
  sreality: "Sreality",
  bezrealitky: "Bezrealitky",
};

function fmtPrice(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")} M Kč`;
  return `${Math.round(n).toLocaleString("cs-CZ")} Kč`;
}

function fmtSaved(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return Math.round(n).toLocaleString("cs-CZ");
}

function timeAgo(d: string): string {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3_600_000);
  if (h < 1) return "Teď";
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  return `${days}d`;
}

const CAT_LABEL: Record<string, string> = {
  "byty-prodej": "Byt · Prodej",
  "byty-najem": "Byt · Nájem",
  "domy-prodej": "Dům · Prodej",
  "domy-najem": "Dům · Nájem",
};

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
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d?.images?.[0]) setUrl(d.images[0]); })
            .catch(() => {});
        }
      },
      { rootMargin: "400px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [id]);
  return { ref, url };
}

function getDropSources(drop: PriceDrop): Array<{ source: string; url: string }> {
  if (drop.sources_json) {
    try { return JSON.parse(drop.sources_json); } catch { /* */ }
  }
  const rawUrl = drop.listing_url || drop.url;
  const isBR = drop.listing_id.startsWith("bz_");
  const url = isBR
    ? rawUrl
    : fixSrealityUrl(rawUrl, drop.listing_id, drop.title, drop.location, drop.category);
  if (!url) return [];
  return [{ source: isBR ? "bezrealitky" : "sreality", url }];
}

export default function PriceDropCard({ drop }: { drop: PriceDrop }) {
  const sources = getDropSources(drop);
  const { ref, url: imgUrl } = useThumb(drop.listing_id);
  const { savedIds, toggle: toggleFav, isLoggedIn } = useFavorites();
  const saved = savedIds.has(drop.listing_id);
  const savedAmount = drop.old_price - drop.new_price;

  return (
    <div ref={ref} className="group relative rounded-lg border border-border bg-surface-1 overflow-hidden card-lift">
      {/* Image */}
      <div className="relative h-40 overflow-hidden bg-surface-2">
        {imgUrl ? (
          <img src={imgUrl} alt={drop.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-surface-4">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
        )}

        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Drop badge */}
        <div className="absolute top-3 left-3">
          <span className="drop-badge">-{drop.drop_pct.toFixed(1)}%</span>
        </div>

        {/* Time + save */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="rounded-md bg-black/50 px-2 py-0.5 text-[10px] text-white/60 backdrop-blur-sm tabular-nums">
            {timeAgo(drop.detected_at)}
          </span>
          {isLoggedIn && (
            <button
              onClick={(e) => toggleFav(drop.listing_id, e)}
              className={`flex h-6 w-6 items-center justify-center rounded-md backdrop-blur-sm transition-all ${
                saved ? "bg-red/80 text-white" : "bg-black/40 text-white/40 hover:text-white"
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          )}
        </div>

        {/* Price overlay */}
        <div className="absolute bottom-0 inset-x-0 px-4 pb-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-lg font-semibold text-white tabular-nums leading-none">
                {fmtPrice(drop.new_price)}
              </div>
              <div className="text-[11px] text-white/40 line-through mt-0.5 tabular-nums">
                {fmtPrice(drop.old_price)}
              </div>
            </div>
            {drop.area_m2 && (
              <span className="text-[11px] text-white/60 tabular-nums">
                {drop.area_m2} m²
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <a
          href={`/listing/${drop.listing_id}`}
          className="text-[13px] font-medium leading-snug text-foreground/90 hover:text-foreground transition-colors line-clamp-2 block"
        >
          {drop.title || `Nemovitost ${drop.listing_id}`}
        </a>

        {/* Meta row */}
        <div className="flex items-center justify-between text-[11px] text-text-tertiary">
          <div className="flex items-center gap-3 min-w-0">
            {drop.location && (
              <span className="truncate">{drop.location}</span>
            )}
          </div>
          <span className="shrink-0">{CAT_LABEL[drop.category] ?? drop.category}</span>
        </div>

        {/* Savings + Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="text-[12px]">
            <span className="text-text-tertiary">Úspora </span>
            <span className="font-semibold text-green tabular-nums">-{fmtSaved(savedAmount)} Kč</span>
          </div>
          <div className="flex items-center gap-1.5">
            {sources.map((s) => (
              <a
                key={s.source}
                href={
                  s.source === "sreality"
                    ? fixSrealityUrl(s.url, drop.listing_id, drop.title, drop.location, drop.category) ?? s.url
                    : s.url
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
              >
                {SOURCE_NAME[s.source] ?? s.source} ↗
              </a>
            ))}
            <a
              href={`/listing/${drop.listing_id}`}
              className="rounded-md bg-accent px-3 py-1 text-[11px] font-medium text-white hover:bg-accent-light transition-colors"
            >
              Detail
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
