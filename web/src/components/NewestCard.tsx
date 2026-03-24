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

export default function NewestCard({ listing }: { listing: Listing }) {
  const timeLabel = daysAgo(listing.first_seen_at);
  const { savedIds, toggle: toggleFav, isLoggedIn } = useFavorites();
  const saved = savedIds.has(listing.id);

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface-1 card-lift">
      {/* Image */}
      <div className="relative h-44 shrink-0 overflow-hidden bg-surface-2">
        {listing.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.thumb}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7" className="text-surface-4">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 left-3">
          <span className="rounded-md bg-green px-2 py-0.5 text-[10px] font-semibold text-white">
            Nové
          </span>
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="rounded-md bg-black/50 px-2 py-0.5 text-[10px] text-white/60 backdrop-blur-sm tabular-nums">
            {timeLabel}
          </span>
          {isLoggedIn && (
            <button
              onClick={(e) => toggleFav(listing.id, e)}
              aria-label={saved ? "Odebrat z uložených" : "Uložit"}
              className={`flex h-6 w-6 items-center justify-center rounded-md backdrop-blur-sm transition-all ${
                saved ? "bg-red/80 text-white" : "bg-black/40 text-white/40 hover:text-white"
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
          )}
        </div>

        {/* Price overlay */}
        <div className="absolute bottom-0 inset-x-0 px-4 pb-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-lg font-semibold text-white tracking-tight tabular-nums leading-none">
                {formatPrice(listing.price)}
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
        <a
          href={`/listing/${listing.id}`}
          className="text-[13px] font-medium leading-snug text-foreground/90 hover:text-foreground transition-colors line-clamp-2"
        >
          {listing.title}
        </a>

        {listing.location && (
          <p className="text-[11px] text-text-tertiary truncate">{listing.location}</p>
        )}

        <div className="mt-auto pt-3 border-t border-border flex items-center justify-between">
          <span className="text-[11px] text-text-tertiary">{timeLabel}</span>
          <a
            href={`/listing/${listing.id}`}
            className="rounded-md bg-accent px-3 py-1 text-[11px] font-medium text-white hover:bg-accent-light transition-colors"
          >
            Detail
          </a>
        </div>
      </div>
    </div>
  );
}
