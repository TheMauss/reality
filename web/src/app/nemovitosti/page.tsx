import { Suspense } from "react";
import ListingCard from "@/components/ListingCard";
import ListingsFilters from "@/components/ListingsFilters";

async function getListings(searchParams: Record<string, string>) {
  const { baseUrl } = await import("@/lib/base-url");
  const base = await baseUrl();
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(searchParams)) {
    if (val) params.set(key, val);
  }
  const res = await fetch(`${base}/api/listings?${params}`, {
    cache: "no-store",
  });
  return res.json();
}

export default async function NemovitostiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const data = await getListings(sp);
  const currentPage = parseInt(sp.page || "1", 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Všechny nemovitosti
        </h1>
        <p className="mt-2 text-muted">
          {data.total.toLocaleString("cs-CZ")} nemovitostí v databázi
        </p>
      </div>

      <Suspense fallback={null}>
        <ListingsFilters />
      </Suspense>

      {data.listings.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <div className="mb-3 text-4xl">🏠</div>
          <p className="text-muted">Žádné nemovitosti pro zadané filtry.</p>
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
              href={`/nemovitosti?${new URLSearchParams({ ...sp, page: String(currentPage - 1) })}`}
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
              href={`/nemovitosti?${new URLSearchParams({ ...sp, page: String(currentPage + 1) })}`}
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
