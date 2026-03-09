"use client";

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

function formatCategory(cat: string): string {
  const map: Record<string, string> = {
    "byty-prodej": "Byt · Prodej",
    "byty-najem": "Byt · Nájem",
    "domy-prodej": "Dům · Prodej",
    "domy-najem": "Dům · Nájem",
  };
  return map[cat] || cat;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "právě teď";
  if (hours < 24) return `před ${hours}h`;
  const days = Math.floor(hours / 24);
  return `před ${days}d`;
}

export default function PriceDropCard({ drop }: { drop: PriceDrop }) {
  const rawUrl = drop.listing_url || drop.url;
  const srealityUrl = fixSrealityUrl(rawUrl, drop.listing_id, drop.title, drop.location, drop.category);

  return (
    <div className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-accent/30 hover:bg-card-hover">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <a
            href={`/listing/${drop.listing_id}`}
            className="block truncate text-base font-semibold text-foreground transition-colors hover:text-accent-light"
          >
            {drop.title || `Nemovitost ${drop.listing_id}`}
          </a>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            {drop.location && <span>{drop.location}</span>}
            {drop.location && drop.category && (
              <span className="text-border">·</span>
            )}
            {drop.category && <span>{formatCategory(drop.category)}</span>}
            {drop.area_m2 && (
              <>
                <span className="text-border">·</span>
                <span>{drop.area_m2} m²</span>
              </>
            )}
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-red/10 px-3 py-1.5 text-sm font-bold text-red">
          −{drop.drop_pct.toFixed(1)}%
        </span>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-muted line-through">
          {formatPrice(drop.old_price)}
        </span>
        <span className="text-lg font-bold text-green">
          {formatPrice(drop.new_price)}
        </span>
        <span className="text-xs text-muted">
          (−{formatPrice(drop.old_price - drop.new_price)})
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{timeAgo(drop.detected_at)}</span>
        <div className="flex gap-2">
          <a
            href={`/listing/${drop.listing_id}`}
            className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent-light transition-colors hover:bg-accent/20"
          >
            Detail
          </a>
          {srealityUrl && (
            <a
              href={srealityUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-border/50 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-border"
            >
              Sreality ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
