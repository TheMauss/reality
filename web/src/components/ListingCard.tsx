"use client";

import { useEffect, useRef, useState } from "react";
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
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(2).replace(/\.?0+$/, "")} M Kč`;
  return `${Math.round(price).toLocaleString("cs-CZ")} Kč`;
}

function formatPriceM2(v: number): string {
  return `${Math.round(v).toLocaleString("cs-CZ")} Kč/m²`;
}

function categoryInfo(cat: string): { label: string; color: string; bg: string; dot: string } {
  switch (cat) {
    case "byty-prodej":  return { label: "Byt · Prodej",  color: "#818cf8", bg: "rgba(129,140,248,0.15)", dot: "#818cf8" };
    case "byty-najem":   return { label: "Byt · Nájem",   color: "#34d399", bg: "rgba(52,211,153,0.15)",  dot: "#34d399" };
    case "domy-prodej":  return { label: "Dům · Prodej",  color: "#fb923c", bg: "rgba(251,146,60,0.15)",  dot: "#fb923c" };
    case "domy-najem":   return { label: "Dům · Nájem",   color: "#fbbf24", bg: "rgba(251,191,36,0.15)",  dot: "#fbbf24" };
    default:             return { label: cat,              color: "#6b7280", bg: "rgba(107,114,128,0.15)", dot: "#6b7280" };
  }
}

function daysOnMarket(first_seen_at: string): number {
  return Math.floor((Date.now() - new Date(first_seen_at).getTime()) / 86_400_000);
}

function parseLayout(title: string): string | null {
  const m = title.match(/\b(\d+\+(?:kk|1)|[Gg]arsonka|[Pp]okoj)\b/);
  return m ? m[0] : null;
}

interface Props {
  listing: Listing;
  compact?: boolean;
}

function useListingThumb(id: string) {
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
      { rootMargin: "400px" }
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
    e.preventDefault(); e.stopPropagation();
    try {
      const arr: string[] = JSON.parse(localStorage.getItem("saved_listings") || "[]");
      const next = arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
      localStorage.setItem("saved_listings", JSON.stringify(next));
      setSaved(next.includes(id));
    } catch { /* ignore */ }
  }

  return { saved, toggle };
}

// ── Compact card (used in map split-view sidebar) ───────────────────────────

function CompactCard({ listing }: { listing: Listing }) {
  const srealityUrl = fixSrealityUrl(listing.url, listing.id, listing.title, listing.location, listing.category);
  const cat = categoryInfo(listing.category);
  const days = daysOnMarket(listing.first_seen_at);
  const layout = parseLayout(listing.title);
  const { ref, imgUrl } = useListingThumb(listing.id);
  const { saved, toggle } = useSaved(listing.id);

  return (
    <div
      ref={ref}
      className="group flex gap-3 rounded-xl border border-border/70 bg-card transition-all duration-200 hover:border-accent/40 hover:bg-card-hover overflow-hidden"
    >
      {/* Thumbnail */}
      <div className="relative h-[84px] w-[100px] shrink-0 overflow-hidden bg-card-hover">
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#141626,#1e2135)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-border">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
        )}
        {/* Category dot */}
        <div className="absolute top-2 left-2 h-2 w-2 rounded-full ring-1 ring-black/30" style={{ background: cat.dot }} />
      </div>

      {/* Content */}
      <div className="flex flex-1 min-w-0 flex-col justify-between py-2.5 pr-3">
        <div className="flex items-start justify-between gap-1">
          <a
            href={`/listing/${listing.id}`}
            className="text-xs font-semibold leading-tight text-foreground hover:text-accent-light transition-colors line-clamp-2 flex-1"
          >
            {listing.title}
          </a>
          <button onClick={toggle} className="shrink-0 ml-1 mt-0.5">
            <svg width="12" height="12" viewBox="0 0 24 24"
              fill={saved ? "#ef4444" : "none"}
              stroke={saved ? "#ef4444" : "currentColor"}
              strokeWidth="2" className="text-muted transition-colors hover:text-red">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>

        {listing.location && (
          <div className="flex items-center gap-1 text-[11px] text-muted truncate mt-0.5">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span className="truncate">{listing.location}</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-1">
          <div>
            <span className="text-sm font-bold text-foreground tabular-nums">{formatPrice(listing.price)}</span>
            {listing.price_m2 && (
              <span className="ml-1.5 text-[10px] text-muted tabular-nums">{Math.round(listing.price_m2 / 1000)}k/m²</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {layout && (
              <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent-light">{layout}</span>
            )}
            <span className="text-[10px] text-muted/60">
              {days === 0 ? "dnes" : `${days}d`}
            </span>
          </div>
        </div>
      </div>

      {/* Hover: quick external link */}
      {srealityUrl && (
        <a
          href={srealityUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded bg-black/60 text-[10px] text-white/70 backdrop-blur-sm">↗</span>
        </a>
      )}
    </div>
  );
}

// ── Full card (grid view) ───────────────────────────────────────────────────

export default function ListingCard({ listing, compact = false }: Props) {
  const srealityUrl = fixSrealityUrl(listing.url, listing.id, listing.title, listing.location, listing.category);
  const cat = categoryInfo(listing.category);
  const days = daysOnMarket(listing.first_seen_at);
  const layout = parseLayout(listing.title);
  const { ref, imgUrl } = useListingThumb(listing.id);
  const { saved, toggle } = useSaved(listing.id);
  const isNew = days <= 2;

  if (compact) return <CompactCard listing={listing} />;

  return (
    <div
      ref={ref}
      className="group relative flex flex-col rounded-2xl border border-border/80 bg-card overflow-hidden transition-all duration-200 hover:border-accent/40 hover:shadow-2xl hover:shadow-accent/5 hover:-translate-y-0.5"
    >
      {/* ── Image ── */}
      <div className="relative h-52 shrink-0 overflow-hidden">
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl} alt={listing.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
        ) : (
          <div className="h-full w-full flex items-center justify-center"
            style={{ background: "linear-gradient(145deg,#12152a 0%,#1b1e35 60%,#141726 100%)" }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7" className="text-border/60">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
        )}

        {/* Full-height gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Top-left badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          {isNew && (
            <span className="rounded-full bg-emerald-400 px-2.5 py-0.5 text-[10px] font-extrabold text-black tracking-widest uppercase">
              Nové
            </span>
          )}
          <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold backdrop-blur-md"
            style={{ color: cat.color, background: cat.bg }}>
            {cat.label}
          </span>
        </div>

        {/* Top-right: save + days */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/60 backdrop-blur-sm tabular-nums">
            {days === 0 ? "Dnes" : days === 1 ? "1 den" : `${days}d`}
          </span>
          <button
            onClick={toggle}
            aria-label={saved ? "Odebrat ze sledovaných" : "Sledovat"}
            className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-sm transition-all ${
              saved ? "bg-red/80 text-white" : "bg-black/40 text-white/50 hover:text-white hover:bg-black/60"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>

        {/* Bottom of image: price hero */}
        <div className="absolute bottom-0 inset-x-0 px-4 pb-3.5 pt-6">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-xl font-extrabold text-white tracking-tight tabular-nums leading-tight">
                {formatPrice(listing.price)}
              </div>
              {listing.price_m2 && (
                <div className="text-xs text-white/55 mt-0.5 tabular-nums">
                  {formatPriceM2(listing.price_m2)}
                </div>
              )}
            </div>
            {listing.area_m2 && (
              <span className="rounded-lg bg-white/10 px-2 py-1 text-sm font-bold text-white/80 backdrop-blur-sm">
                {listing.area_m2} m²
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <a
          href={`/listing/${listing.id}`}
          className="text-sm font-semibold leading-snug text-foreground transition-colors hover:text-accent-light line-clamp-2"
        >
          {listing.title}
        </a>

        {listing.location && (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 opacity-60">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span className="truncate">{listing.location}</span>
          </div>
        )}

        {/* Footer row */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5 border-t border-border/40">
          <div className="flex items-center gap-1.5">
            {layout && (
              <span className="rounded-lg bg-accent/10 px-2 py-1 text-xs font-bold text-accent-light">
                {layout}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {srealityUrl && (
              <a href={srealityUrl} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 text-muted transition-colors hover:border-border hover:text-foreground">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            )}
            <a
              href={`/listing/${listing.id}`}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20"
            >
              Detail →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
