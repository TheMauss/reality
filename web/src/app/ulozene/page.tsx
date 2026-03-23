"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import ListingCard from "@/components/ListingCard";
import { useFavorites } from "@/components/FavoritesProvider";

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

export default function UlozenePage() {
  const { data: session, status } = useSession();
  const { savedIds, toggle } = useFavorites();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const ids = Array.from(savedIds);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) { setLoading(false); return; }
    if (ids.length === 0) { setListings([]); setLoading(false); return; }

    setLoading(true);
    Promise.all(
      ids.map(id =>
        fetch(`/api/listing?id=${id}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => d?.listing ?? null)
          .catch(() => null)
      )
    ).then(results => {
      setListings(results.filter(Boolean) as Listing[]);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session, savedIds.size]);

  // Not logged in
  if (status !== "loading" && !session) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
        <div className="text-4xl">❤️</div>
        <h2 className="text-xl font-bold">Přihlaste se pro uložené nemovitosti</h2>
        <p className="text-sm text-muted max-w-sm">
          Uložené nemovitosti jsou dostupné pouze po přihlášení.
        </p>
        <button
          onClick={() => signIn("google")}
          className="mt-2 flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 shadow hover:shadow-md transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Přihlásit přes Google
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-red/80">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            Uložené nemovitosti
          </h1>
          {!loading && listings.length > 0 && (
            <p className="mt-1 text-sm text-muted">{listings.length} {listings.length === 1 ? "nemovitost" : listings.length < 5 ? "nemovitosti" : "nemovitostí"} uloženo</p>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm text-muted">Načítání…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && listings.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-card">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-muted">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Žádné uložené nemovitosti</h2>
            <p className="mt-2 text-sm text-muted max-w-sm">
              Klikni na srdíčko u libovolné nemovitosti a uložíš si ji sem pro pozdější srovnání.
            </p>
          </div>
          <div className="flex gap-3">
            <a href="/inzerce" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20">
              Procházet inzeráty
            </a>
            <a href="/" className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-all hover:border-accent/30 hover:bg-card-hover">
              Cenové propady
            </a>
          </div>
        </div>
      )}

      {/* Listings grid */}
      {!loading && listings.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map(listing => (
            <div key={listing.id} className="relative group/wrap">
              <ListingCard listing={listing} />
              <button
                onClick={(e) => toggle(listing.id, e)}
                aria-label="Odebrat z uložených"
                className="absolute top-3 left-3 z-10 opacity-0 group-hover/wrap:opacity-100 transition-opacity flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/70 hover:text-red backdrop-blur-sm"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
