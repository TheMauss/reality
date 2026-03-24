"use client";

import { useEffect, useRef, useState } from "react";
import { fixSrealityUrl } from "@/lib/sreality-url";
import { useFavorites } from "@/components/FavoritesProvider";

interface ListingSource {
  source: string;
  url: string;
}

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
  sources_json?: string;
}

const SOURCE_LABEL: Record<string, string> = {
  sreality: "SR",
  bezrealitky: "BZ",
};

function parseSources(listing: Listing): ListingSource[] {
  if (listing.sources_json) {
    try { return JSON.parse(listing.sources_json) as ListingSource[]; } catch { /* */ }
  }
  const isBR = listing.id.startsWith("bz_");
  return [{ source: isBR ? "bezrealitky" : "sreality", url: listing.url }];
}

function SourceLinks({ listing, className }: { listing: Listing; className?: string }) {
  const sources = parseSources(listing);
  return (
    <>
      {sources.map((s) => {
        const href = s.source === "sreality"
          ? fixSrealityUrl(s.url, listing.id, listing.title, listing.location, listing.category)
          : s.url;
        if (!href) return null;
        return (
          <a key={s.source} href={href} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()} className={className}>
            {SOURCE_LABEL[s.source] ?? "↗"}
          </a>
        );
      })}
    </>
  );
}

function fmtPrice(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")} M Kč`;
  return `${Math.round(n).toLocaleString("cs-CZ")} Kč`;
}

function daysOn(d: string): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

function parseLayout(title: string): string | null {
  const m = title.match(/\b(\d+\+(?:kk|\d)|[Gg]arsonka|[Pp]okoj)\b/);
  return m ? m[0] : null;
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
  const { savedIds, toggle: toggleFav, isLoggedIn } = useFavorites();
  const saved = savedIds.has(id);
  const toggle = (e: React.MouseEvent) => toggleFav(id, e);
  return { saved, toggle, isLoggedIn };
}

/* ── Compact card (map sidebar) ── */

function CompactCard({ listing }: { listing: Listing }) {
  const days = daysOn(listing.first_seen_at);
  const layout = parseLayout(listing.title);
  const { ref, url: imgUrl } = useThumb(listing.id);
  const { saved, toggle } = useSaved(listing.id);

  return (
    <div ref={ref}
      className="group flex gap-3 rounded-lg border border-border bg-surface-1 transition-all hover:border-border-hover overflow-hidden">
      {/* Thumbnail */}
      <div className="relative h-20 w-24 shrink-0 overflow-hidden bg-surface-2">
        {imgUrl
          ? <img src={imgUrl} alt="" className="h-full w-full object-cover" />
          : (
            <div className="h-full w-full flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-surface-4">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
          )}
      </div>

      {/* Content */}
      <div className="flex flex-1 min-w-0 flex-col justify-between py-2 pr-3">
        <div className="flex items-start gap-1">
          <a href={`/listing/${listing.id}`}
            className="text-[12px] font-medium leading-tight text-foreground/90 hover:text-foreground transition-colors line-clamp-2 flex-1">
            {listing.title}
          </a>
          <button onClick={toggle} className="shrink-0 ml-1 mt-0.5">
            <svg width="10" height="10" viewBox="0 0 24 24"
              fill={saved ? "#EF4444" : "none"} stroke={saved ? "#EF4444" : "currentColor"}
              strokeWidth="2" className="text-text-tertiary">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="text-[13px] font-semibold text-foreground tabular-nums">{fmtPrice(listing.price)}</span>
          <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
            {layout && <span className="font-medium">{layout}</span>}
            <span>{days === 0 ? "dnes" : `${days}d`}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Full card ── */

export default function ListingCard({ listing, compact = false }: { listing: Listing; compact?: boolean }) {
  const days = daysOn(listing.first_seen_at);
  const layout = parseLayout(listing.title);
  const { ref, url: imgUrl } = useThumb(listing.id);
  const { saved, toggle, isLoggedIn } = useSaved(listing.id);
  const isNew = days <= 2;

  if (compact) return <CompactCard listing={listing} />;

  return (
    <div ref={ref}
      className="group flex flex-col rounded-lg border border-border bg-surface-1 overflow-hidden card-lift">

      {/* Photo */}
      <div className="relative h-44 shrink-0 overflow-hidden bg-surface-2">
        {imgUrl
          ? <img src={imgUrl} alt={listing.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          : (
            <div className="h-full w-full flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7" className="text-surface-4">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
          )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          {isNew && (
            <span className="rounded-md bg-green px-2 py-0.5 text-[10px] font-semibold text-white">
              Nové
            </span>
          )}
          <span className="rounded-md bg-black/50 px-2 py-0.5 text-[10px] text-white/60 backdrop-blur-sm">
            {CAT_LABEL[listing.category] ?? listing.category}
          </span>
        </div>

        {/* Save + days */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="text-[10px] text-white/50 tabular-nums">
            {days === 0 ? "Dnes" : `${days}d`}
          </span>
          {isLoggedIn && (
            <button onClick={toggle}
              className={`flex h-6 w-6 items-center justify-center rounded-md backdrop-blur-sm transition-all ${
                saved ? "bg-red/80 text-white" : "bg-black/40 text-white/40 hover:text-white"
              }`}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
          )}
        </div>

        {/* Price */}
        <div className="absolute bottom-0 inset-x-0 px-4 pb-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-lg font-semibold text-white tracking-tight tabular-nums leading-none">
                {fmtPrice(listing.price)}
              </div>
              {listing.price_m2 && (
                <div className="text-[11px] text-white/40 mt-0.5 tabular-nums">
                  {Math.round(listing.price_m2).toLocaleString("cs-CZ")} Kč/m²
                </div>
              )}
            </div>
            {listing.area_m2 && (
              <span className="text-[11px] text-white/60 tabular-nums">{listing.area_m2} m²</span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <a href={`/listing/${listing.id}`}
          className="text-[13px] font-medium leading-snug text-foreground/90 hover:text-foreground transition-colors line-clamp-2">
          {listing.title}
        </a>

        {listing.location && (
          <p className="text-[11px] text-text-tertiary truncate">{listing.location}</p>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-3 border-t border-border">
          <div className="flex items-center gap-1.5">
            {layout && (
              <span className="rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                {layout}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <SourceLinks listing={listing}
              className="text-[10px] text-text-tertiary hover:text-text-secondary transition-colors" />
            <a href={`/listing/${listing.id}`}
              className="rounded-md bg-accent px-3 py-1 text-[11px] font-medium text-white hover:bg-accent-light transition-colors">
              Detail
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
