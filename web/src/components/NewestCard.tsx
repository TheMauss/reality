"use client";

import { useFavorites } from "@/components/FavoritesProvider";

interface Listing {
  id: string;
  title: string;
  location: string;
  area_m2: number | null;
  category: string;
  price: number;
  price_m2: number | null;
  first_seen_at: string;
  thumb?: string | null;
}

function formatPrice(price: number): string {
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(1)} M Kč`;
  return `${Math.round(price).toLocaleString("cs-CZ")} Kč`;
}

function daysAgo(dateStr: string): string {
  const elapsed = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (elapsed < 60) return `Před ${elapsed} min`;
  if (elapsed < 1440) return `Před ${Math.floor(elapsed / 60)}h`;
  const days = Math.floor(elapsed / 1440);
  if (days === 1) return "Včera";
  return `Před ${days} dny`;
}

function useSaved(id: string) {
  const { savedIds, toggle: toggleFav, isLoggedIn } = useFavorites();
  const saved = savedIds.has(id);
  const toggle = (e: React.MouseEvent) => toggleFav(id, e);
  return { saved, toggle, isLoggedIn };
}

export default function NewestCard({ listing }: { listing: Listing }) {
  const timeLabel = daysAgo(listing.first_seen_at);
  const { saved, toggle, isLoggedIn } = useSaved(listing.id);

  return (
    <a
      href={`/listing/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-accent/30 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className="relative h-52 shrink-0 overflow-hidden bg-card-hover">
        {listing.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.thumb}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "linear-gradient(135deg,#13151f,#1a1d2e)" }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-border">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5">
          <span className="rounded-md bg-green/90 px-2 py-0.5 text-[10px] font-bold text-black tracking-wide">
            NOVÉ
          </span>
        </div>
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
          <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur-sm">
            {timeLabel}
          </span>
          {isLoggedIn && <button
            onClick={toggle}
            aria-label={saved ? "Odebrat z uložených" : "Uložit"}
            className={`flex h-6 w-6 items-center justify-center rounded-full backdrop-blur-sm transition-all ${
              saved ? "bg-red/80 text-white" : "bg-black/40 text-white/50 hover:text-white hover:bg-black/60"
            }`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>}
        </div>

        {/* Area badge bottom right */}
        {listing.area_m2 && (
          <div className="absolute bottom-2.5 right-2.5">
            <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white/70 backdrop-blur-sm">
              {listing.area_m2} m²
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-accent-light transition-colors mb-2">
          {listing.title}
        </p>
        {listing.location && (
          <p className="mb-3 flex items-center gap-1.5 truncate text-xs text-muted">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            {listing.location}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2">
          <span className="text-base font-bold">{formatPrice(listing.price)}</span>
          {listing.price_m2 && (
            <span className="text-xs text-muted">{Math.round(listing.price_m2).toLocaleString("cs-CZ")} Kč/m²</span>
          )}
        </div>
      </div>
    </a>
  );
}
