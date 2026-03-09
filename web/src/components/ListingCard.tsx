"use client";

import { fixSrealityUrl } from "@/lib/sreality-url";

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

function formatPrice(price: number): string {
  if (price >= 1_000_000) {
    return `${(price / 1_000_000).toFixed(2)} M Kč`;
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

function categoryTag(cat: string): string {
  if (cat.includes("prodej")) return "bg-accent/10 text-accent-light";
  return "bg-green/10 text-green";
}

export default function ListingCard({ listing }: { listing: Listing }) {
  return (
    <div className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-all hover:border-accent/30 hover:bg-card-hover">
      <div className="mb-3 flex items-start justify-between gap-3">
        <a
          href={`/listing/${listing.id}`}
          className="min-w-0 flex-1 text-base font-semibold leading-tight text-foreground transition-colors hover:text-accent-light"
        >
          {listing.title}
        </a>
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${categoryTag(listing.category)}`}
        >
          {formatCategory(listing.category)}
        </span>
      </div>

      <div className="mb-3 text-sm text-muted">
        {listing.location && <span>📍 {listing.location}</span>}
        {listing.area_m2 && (
          <span className="ml-2">· {listing.area_m2} m²</span>
        )}
      </div>

      <div className="mb-3 text-xs text-muted">
        Inzerováno od{" "}
        {new Date(listing.first_seen_at).toLocaleDateString("cs-CZ", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </div>

      <div className="mt-auto flex items-end justify-between">
        <div>
          <div className="text-xl font-bold">{formatPrice(listing.price)}</div>
          {listing.price_m2 && (
            <div className="text-xs text-muted">
              {Math.round(listing.price_m2).toLocaleString("cs-CZ")} Kč/m²
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <a
            href={`/listing/${listing.id}`}
            className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent-light transition-colors hover:bg-accent/20"
          >
            Detail
          </a>
          <a
            href={fixSrealityUrl(listing.url, listing.id, listing.title, listing.location, listing.category)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-border/50 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-border"
          >
            Sreality ↗
          </a>
        </div>
      </div>
    </div>
  );
}
