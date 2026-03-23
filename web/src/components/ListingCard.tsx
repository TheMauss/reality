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
    try {
      return JSON.parse(listing.sources_json) as ListingSource[];
    } catch { /* */ }
  }
  // Fallback: derive from listing URL
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
            onClick={e => e.stopPropagation()}
            title={s.source === "sreality" ? "Sreality.cz" : "Bezrealitky.cz"}
            className={className}>
            {SOURCE_LABEL[s.source] ?? "↗"}
          </a>
        );
      })}
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")} M Kč`;
  return `${Math.round(n).toLocaleString("cs-CZ")} Kč`;
}

function fmtPriceM2(v: number): string {
  return `${Math.round(v).toLocaleString("cs-CZ")} Kč/m²`;
}

function daysOn(d: string): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

function parseLayout(title: string): string | null {
  const m = title.match(/\b(\d+\+(?:kk|\d)|[Gg]arsonka|[Pp]okoj)\b/);
  return m ? m[0] : null;
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
  const { savedIds, toggle: toggleFav, isLoggedIn } = useFavorites();
  const saved = savedIds.has(id);
  const toggle = (e: React.MouseEvent) => toggleFav(id, e);
  return { saved, toggle, isLoggedIn };
}

// ── Compact card (map sidebar) ────────────────────────────────────────────────

function CompactCard({ listing }: { listing: Listing }) {
  const cat = CAT[listing.category] ?? { label: listing.category, color: "#71717A" };
  const days = daysOn(listing.first_seen_at);
  const layout = parseLayout(listing.title);
  const { ref, url: imgUrl } = useThumb(listing.id);
  const { saved, toggle, isLoggedIn } = useSaved(listing.id);

  return (
    <div ref={ref}
      className="group flex gap-3 rounded-xl border border-border/70 bg-card transition-all hover:border-border-light hover:bg-card-hover overflow-hidden">
      {/* Thumbnail */}
      <div className="relative h-[86px] w-[110px] shrink-0 overflow-hidden bg-card-hover">
        {imgUrl
          ? <img src={imgUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          : (
            <div className="h-full w-full flex items-center justify-center"
              style={{ background: `linear-gradient(145deg, #0D0C14, ${cat.color}10)` }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-border/50">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
          )}
        <div className="absolute top-1.5 left-1.5 h-2 w-2 rounded-full ring-1 ring-black/30"
          style={{ background: cat.color }} />
      </div>

      {/* Content */}
      <div className="flex flex-1 min-w-0 flex-col justify-between py-2.5 pr-3">
        <div className="flex items-start gap-1">
          <a href={`/listing/${listing.id}`}
            className="text-xs font-semibold leading-tight text-foreground hover:text-accent-light transition-colors line-clamp-2 flex-1">
            {listing.title}
          </a>
          <button onClick={toggle} className="shrink-0 ml-1 mt-0.5">
            <svg width="11" height="11" viewBox="0 0 24 24"
              fill={saved ? "#F43F5E" : "none"} stroke={saved ? "#F43F5E" : "currentColor"}
              strokeWidth="2" className="text-muted transition-colors hover:text-red">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>

        {listing.location && (
          <div className="flex items-center gap-1 text-[10px] text-muted truncate">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span className="truncate">{listing.location}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-bold text-foreground tabular-nums">{fmtPrice(listing.price)}</span>
            {listing.price_m2 && (
              <span className="ml-1.5 text-[10px] text-muted tabular-nums">{Math.round(listing.price_m2 / 1000)}k/m²</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {layout && (
              <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold text-accent-light">{layout}</span>
            )}
            <span className="text-[9px] text-muted/60">{days === 0 ? "dnes" : `${days}d`}</span>
          </div>
        </div>
      </div>

      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <SourceLinks listing={listing} className="flex h-5 min-w-[20px] items-center justify-center rounded bg-black/60 px-1 text-[9px] font-bold text-white/70 hover:text-white" />
      </div>
    </div>
  );
}

// ── Full card ─────────────────────────────────────────────────────────────────

export default function ListingCard({ listing, compact = false }: { listing: Listing; compact?: boolean }) {
  const cat = CAT[listing.category] ?? { label: listing.category, color: "#71717A" };
  const days = daysOn(listing.first_seen_at);
  const layout = parseLayout(listing.title);
  const { ref, url: imgUrl } = useThumb(listing.id);
  const { saved, toggle, isLoggedIn } = useSaved(listing.id);
  const isNew = days <= 2;

  if (compact) return <CompactCard listing={listing} />;

  return (
    <div ref={ref}
      className="group flex flex-col rounded-2xl border border-border bg-card overflow-hidden card-lift hover:border-border-light">

      {/* ── Photo ── */}
      <div className="relative h-52 shrink-0 overflow-hidden">
        {imgUrl
          ? <img src={imgUrl} alt={listing.title}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
          : (
            <div className="h-full w-full flex items-center justify-center"
              style={{ background: `linear-gradient(145deg, #0D0C14 0%, ${cat.color}10 100%)` }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7" className="text-border/40">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
          )}

        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          {isNew && (
            <span className="rounded-full bg-green px-2.5 py-0.5 text-[10px] font-extrabold text-black tracking-widest uppercase">
              Nové
            </span>
          )}
          <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold backdrop-blur-md"
            style={{ color: cat.color, background: `${cat.color}25` }}>
            {cat.label}
          </span>
        </div>

        {/* Save + days */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/60 backdrop-blur-sm tabular-nums">
            {days === 0 ? "Dnes" : days === 1 ? "1 den" : `${days}d`}
          </span>
          {isLoggedIn && (
            <button onClick={toggle} aria-label={saved ? "Odebrat" : "Uložit"}
              className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-sm transition-all ${
                saved ? "bg-red/80 text-white" : "bg-black/40 text-white/50 hover:bg-black/60 hover:text-white"
              }`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
          )}
        </div>

        {/* Price over image */}
        <div className="absolute bottom-0 inset-x-0 px-4 pb-4 pt-10">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-[22px] font-extrabold text-white tracking-tight tabular-nums leading-none">
                {fmtPrice(listing.price)}
              </div>
              {listing.price_m2 && (
                <div className="text-xs text-white/50 mt-1 tabular-nums">{fmtPriceM2(listing.price_m2)}</div>
              )}
            </div>
            {listing.area_m2 && (
              <span className="rounded-xl bg-white/10 px-2.5 py-1 text-sm font-bold text-white/80 backdrop-blur-sm">
                {listing.area_m2} m²
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <a href={`/listing/${listing.id}`}
          className="text-[13px] font-semibold leading-snug text-foreground hover:text-accent-light transition-colors line-clamp-2">
          {listing.title}
        </a>

        {listing.location && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 opacity-60">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span className="truncate">{listing.location}</span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-border/40">
          <div className="flex items-center gap-1.5">
            {layout && (
              <span className="rounded-lg bg-accent/10 px-2 py-1 text-[11px] font-bold text-accent-light">
                {layout}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <SourceLinks listing={listing} className="flex h-7 min-w-[28px] items-center justify-center rounded-lg border border-border/60 px-1.5 text-[10px] font-bold text-muted transition-colors hover:border-border-light hover:text-foreground" />
            <a href={`/listing/${listing.id}`}
              className="rounded-xl bg-accent px-3.5 py-1.5 text-[11px] font-bold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20">
              Detail →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
