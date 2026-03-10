"use client";

import { useEffect, useState } from "react";
import ListingCard from "@/components/ListingCard";

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
  const [ids, setIds] = useState<string[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  // Read from localStorage
  useEffect(() => {
    try {
      const arr: string[] = JSON.parse(localStorage.getItem("saved_listings") || "[]");
      setIds(arr);
    } catch {
      setIds([]);
    }
  }, []);

  // Fetch listings
  useEffect(() => {
    if (ids.length === 0) {
      setListings([]);
      setLoading(false);
      return;
    }

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
  }, [ids]);

  // Listen to storage changes (heart button elsewhere)
  useEffect(() => {
    function onStorage() {
      try {
        const arr: string[] = JSON.parse(localStorage.getItem("saved_listings") || "[]");
        setIds(arr);
      } catch { /* ignore */ }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function removeAll() {
    localStorage.setItem("saved_listings", "[]");
    window.dispatchEvent(new Event("storage"));
    setIds([]);
    setListings([]);
  }

  function remove(id: string) {
    setRemoving(id);
    try {
      const arr: string[] = JSON.parse(localStorage.getItem("saved_listings") || "[]");
      const next = arr.filter(x => x !== id);
      localStorage.setItem("saved_listings", JSON.stringify(next));
      window.dispatchEvent(new Event("storage"));
      setIds(next);
      setListings(prev => prev.filter(l => l.id !== id));
    } catch { /* ignore */ }
    setRemoving(null);
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
        {listings.length > 0 && (
          <button
            onClick={removeAll}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-all hover:border-red/30 hover:text-red"
          >
            Vymazat vše
          </button>
        )}
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
            <a
              href="/inzerce"
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20"
            >
              Procházet inzeráty
            </a>
            <a
              href="/"
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-all hover:border-accent/30 hover:bg-card-hover"
            >
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
              {/* Remove button overlay */}
              <button
                onClick={() => remove(listing.id)}
                disabled={removing === listing.id}
                aria-label="Odebrat z uložených"
                className="absolute top-3 left-3 z-10 opacity-0 group-hover/wrap:opacity-100 transition-opacity flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/70 hover:text-red backdrop-blur-sm"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
