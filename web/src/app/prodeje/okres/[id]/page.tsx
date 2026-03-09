import { notFound } from "next/navigation";
import Link from "next/link";
import SoldPriceChart from "@/components/SoldPriceChart";

interface Ward {
  id: number;
  name: string;
  avg_price_m2: number;
  transactions: number;
  price_change: number | null;
  transaction_count: number;
}

async function fetchJSON(path: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  return res.json();
}

function formatNum(n: number | null | undefined): string {
  if (!n) return "—";
  return Math.round(n).toLocaleString("cs-CZ");
}

export default async function OkresPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, historyData] = await Promise.all([
    fetchJSON(`/api/sold/wards?district_id=${id}`),
    fetchJSON(`/api/sold/history?entity_type=district&entity_id=${id}`),
  ]);

  if (!data.district) notFound();

  const district = data.district as {
    id: number;
    name: string;
    avg_price_m2: number;
    transactions: number;
    price_change: number | null;
    region_name: string;
    region_id: number;
  };
  const wards: Ward[] = data.wards || [];
  const history = historyData.history || [];
  const districtAskingM2: number | null = data.district_asking_m2 ?? null;
  const districtListingCount: number = data.district_listing_count ?? 0;

  // Use latest price from history
  const lastHistoryPrice = history.length > 0
    ? Math.round(history[history.length - 1].avgPriceM2)
    : district.avg_price_m2;
  const priceChange = district.price_change ??
    (history.length >= 2
      ? ((history[history.length - 1].avgPriceM2 - history[0].avgPriceM2) / history[0].avgPriceM2 * 100)
      : null);

  const maxPrice = Math.max(...wards.map((w) => w.avg_price_m2 || 0));

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/prodeje" className="hover:text-foreground">
          Prodeje
        </Link>
        <span>/</span>
        <Link
          href={`/prodeje/kraj/${district.region_id}`}
          className="hover:text-foreground"
        >
          {district.region_name}
        </Link>
        <span>/</span>
        <span className="text-foreground">{district.name}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{district.name}</h1>
        <p className="mt-1 text-muted">
          {wards.length} obcí/částí · {formatNum(district.transactions)}{" "}
          transakcí
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold text-green">
            {formatNum(lastHistoryPrice)}
          </div>
          <div className="mt-1 text-sm text-muted">Posl. prodejní Kč/m²</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold text-accent-light">
            {formatNum(districtAskingM2)}
          </div>
          <div className="mt-1 text-sm text-muted">Nabídková Kč/m²</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold">
            {formatNum(district.transactions)}
          </div>
          <div className="mt-1 text-sm text-muted">Transakcí</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          {priceChange !== null ? (
            <div
              className={`text-2xl font-bold ${priceChange >= 0 ? "text-green" : "text-red"}`}
            >
              {priceChange >= 0 ? "+" : ""}
              {priceChange.toFixed(1)}%
            </div>
          ) : (
            <div className="text-2xl font-bold text-muted">—</div>
          )}
          <div className="mt-1 text-sm text-muted">Změna ceny</div>
        </div>
      </div>

      {/* Price chart */}
      {history.length > 2 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Vývoj prodejních cen – {district.name}
          </h2>
          <SoldPriceChart monthlyPrices={history} askingPriceM2={null} />
        </div>
      )}

      {/* Wards list */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Obce / části</h2>
        <div className="space-y-2">
          {wards.map((w) => {
            const widthPct =
              maxPrice > 0 ? (w.avg_price_m2 / maxPrice) * 100 : 0;
            return (
              <Link
                key={w.id}
                href={`/prodeje/obec/${w.id}`}
                className="flex items-center gap-4 rounded-lg bg-background p-4 transition-colors hover:bg-background/80"
              >
                <div className="w-48 shrink-0">
                  <div className="font-medium">{w.name}</div>
                  <div className="text-xs text-muted">
                    {formatNum(w.transaction_count || w.transactions)} transakcí
                  </div>
                </div>
                <div className="flex-1">
                  <div className="relative h-5 overflow-hidden rounded bg-card">
                    <div
                      className="absolute inset-y-0 left-0 rounded bg-green/40"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
                <div className="w-32 shrink-0 text-right">
                  <div className="font-bold text-green">
                    {formatNum(w.avg_price_m2)}
                  </div>
                  <div className="text-xs text-muted">Kč/m²</div>
                </div>
                {w.price_change !== null && (
                  <div
                    className={`w-16 shrink-0 text-right text-sm font-bold ${w.price_change >= 0 ? "text-green" : "text-red"}`}
                  >
                    {w.price_change >= 0 ? "+" : ""}
                    {w.price_change.toFixed(1)}%
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
