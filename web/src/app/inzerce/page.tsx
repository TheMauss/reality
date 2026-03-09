import { Suspense } from "react";
import ListingCard from "@/components/ListingCard";
import ListingsFilters from "@/components/ListingsFilters";
import SearchBar from "@/components/SearchBar";

async function getListings(searchParams: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(searchParams)) {
    if (val) params.set(key, val);
  }
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/listings?${params}`, {
    cache: "no-store",
  });
  return res.json();
}

async function getStats() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/stats`, { cache: "no-store" });
  return res.json();
}

export default async function InzercePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const [data, stats] = await Promise.all([getListings(sp), getStats()]);
  const currentPage = parseInt(sp.page || "1", 10);

  return (
    <div className="space-y-6">
      {/* Header + search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inzerce</h1>
          <p className="mt-1 text-muted">
            {data.total.toLocaleString("cs-CZ")} inzerátů v databázi · celá ČR
          </p>
        </div>
        <Suspense fallback={null}>
          <SearchBar />
        </Suspense>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xl font-bold">
            {stats.totalListings?.toLocaleString("cs-CZ") || "—"}
          </div>
          <div className="text-xs text-muted">Celkem inzerátů</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xl font-bold text-red">
            {stats.totalDrops?.toLocaleString("cs-CZ") || "—"}
          </div>
          <div className="text-xs text-muted">Cenových propadů</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xl font-bold text-amber-400">
            {stats.avgDrop ? `${stats.avgDrop}%` : "—"}
          </div>
          <div className="text-xs text-muted">Prům. propad</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xl font-bold text-accent-light">
            {(stats.categories || []).length}
          </div>
          <div className="text-xs text-muted">Kategorií</div>
        </div>
      </div>

      {/* Filters */}
      <Suspense fallback={null}>
        <ListingsFilters />
      </Suspense>

      {/* Listings grid */}
      {data.listings.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted">Žádné inzeráty pro zadané filtry.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {data.listings.map((listing: any) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {currentPage > 1 && (
            <a
              href={`/inzerce?${new URLSearchParams({ ...sp, page: String(currentPage - 1) })}`}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-card-hover"
            >
              ← Předchozí
            </a>
          )}
          <span className="px-4 py-2 text-sm text-muted">
            {currentPage} / {data.pages}
          </span>
          {currentPage < data.pages && (
            <a
              href={`/inzerce?${new URLSearchParams({ ...sp, page: String(currentPage + 1) })}`}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-card-hover"
            >
              Další →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
