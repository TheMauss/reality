import { Suspense } from "react";
import Link from "next/link";
import StatsCards from "@/components/StatsCards";
import Filters from "@/components/Filters";
import PriceDropCard from "@/components/PriceDropCard";

async function getStats() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/stats`, { cache: "no-store" });
  return res.json();
}

async function getDrops(searchParams: Record<string, string>) {
  const params = new URLSearchParams();
  if (searchParams.category) params.set("category", searchParams.category);
  if (searchParams.min_drop) params.set("min_drop", searchParams.min_drop);
  if (searchParams.location) params.set("location", searchParams.location);
  if (searchParams.page) params.set("page", searchParams.page);

  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/drops?${params}`, { cache: "no-store" });
  return res.json();
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const [stats, dropsData] = await Promise.all([getStats(), getDrops(sp)]);

  const currentPage = parseInt(sp.page || "1", 10);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Cenové propady nemovitostí
        </h1>
        <p className="mt-2 text-muted">
          Sledujeme ceny na Sreality.cz a upozorníme vás na každý pokles.
        </p>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link href="/inzerce" className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent/50">
          <div className="text-lg font-bold text-accent-light">Inzerce</div>
          <div className="text-xs text-muted">Všechny inzeráty ČR</div>
        </Link>
        <Link href="/prodeje" className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent/50">
          <div className="text-lg font-bold text-green">Prodeje</div>
          <div className="text-xs text-muted">Cenová mapa ČR</div>
        </Link>
        <Link href="/data" className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent/50">
          <div className="text-lg font-bold text-amber-400">Data</div>
          <div className="text-xs text-muted">Spread, yield, trendy</div>
        </Link>
        <Link href="/mapa" className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent/50">
          <div className="text-lg font-bold">Mapa</div>
          <div className="text-xs text-muted">Interaktivní mapa</div>
        </Link>
      </div>

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Drops Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Nejnovější propady</h2>
          <span className="text-sm text-muted">
            {dropsData.total} výsledků
          </span>
        </div>

        <Suspense fallback={null}>
          <Filters />
        </Suspense>

        {dropsData.drops.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <div className="mb-3 text-4xl">🔍</div>
            <p className="text-muted">
              Žádné cenové propady pro zadané filtry.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {dropsData.drops.map((drop: any) => (
              <PriceDropCard key={drop.id} drop={drop} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {dropsData.pages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            {currentPage > 1 && (
              <a
                href={`/?${new URLSearchParams({ ...sp, page: String(currentPage - 1) })}`}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-card-hover"
              >
                ← Předchozí
              </a>
            )}
            <span className="px-4 py-2 text-sm text-muted">
              {currentPage} / {dropsData.pages}
            </span>
            {currentPage < dropsData.pages && (
              <a
                href={`/?${new URLSearchParams({ ...sp, page: String(currentPage + 1) })}`}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-card-hover"
              >
                Další →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
