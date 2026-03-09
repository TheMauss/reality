import { notFound } from "next/navigation";
import Link from "next/link";
import SoldPriceChart from "@/components/SoldPriceChart";

interface District {
  id: number;
  name: string;
  avg_price_m2: number;
  transactions: number;
  price_change: number | null;
  ward_count: number;
  transaction_count: number;
  asking_m2: number | null;
  listing_count: number;
  spread: number | null;
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

export default async function KrajPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, historyData] = await Promise.all([
    fetchJSON(`/api/sold/districts?region_id=${id}`),
    fetchJSON(`/api/sold/history?entity_type=region&entity_id=${id}`),
  ]);

  if (!data.region) notFound();

  const region = data.region as {
    id: number;
    name: string;
    avg_price_m2: number;
    transactions: number;
    price_change: number | null;
  };
  const districts: District[] = data.districts || [];
  const history = historyData.history || [];

  // Use latest price from history instead of region avg
  const lastHistoryPrice = history.length > 0
    ? Math.round(history[history.length - 1].avgPriceM2)
    : region.avg_price_m2;
  // Compute price change from history if not in DB
  const priceChange = region.price_change ??
    (history.length >= 2
      ? ((history[history.length - 1].avgPriceM2 - history[0].avgPriceM2) / history[0].avgPriceM2 * 100)
      : null);

  const maxPrice = Math.max(...districts.map((d) => d.avg_price_m2 || 0));

  // Compute region-level asking price from districts
  const totalListings = districts.reduce((s, d) => s + (d.listing_count || 0), 0);
  const regionAskingM2 = totalListings > 0
    ? Math.round(
        districts.reduce((s, d) => s + (d.asking_m2 || 0) * (d.listing_count || 0), 0) / totalListings
      )
    : null;

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/prodeje" className="hover:text-foreground">
          Prodeje
        </Link>
        <span>/</span>
        <span className="text-foreground">{region.name}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{region.name}</h1>
        <p className="mt-1 text-muted">
          {districts.length} okresů · {formatNum(region.transactions)} transakcí
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
            {formatNum(regionAskingM2)}
          </div>
          <div className="mt-1 text-sm text-muted">Nabídková Kč/m²</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold">
            {formatNum(region.transactions)}
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
            Vývoj prodejních cen – {region.name}
          </h2>
          <SoldPriceChart monthlyPrices={history} askingPriceM2={null} />
        </div>
      )}

      {/* Districts table */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Okresy</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="pb-2 font-medium">Okres</th>
                <th className="pb-2 text-right font-medium">Prodejní Kč/m²</th>
                <th className="pb-2 text-right font-medium">Nabídková Kč/m²</th>
                <th className="pb-2 text-right font-medium">Spread</th>
                <th className="pb-2 text-right font-medium">Transakcí</th>
                <th className="pb-2 text-right font-medium">Změna</th>
              </tr>
            </thead>
            <tbody>
              {districts.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-border/50 transition-colors hover:bg-background"
                >
                  <td className="py-3">
                    <Link
                      href={`/prodeje/okres/${d.id}`}
                      className="font-medium text-accent-light hover:underline"
                    >
                      {d.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {d.ward_count} obcí
                    </div>
                  </td>
                  <td className="py-3 text-right text-green">
                    {formatNum(d.avg_price_m2)}
                  </td>
                  <td className="py-3 text-right text-accent-light">
                    {formatNum(d.asking_m2)}
                  </td>
                  <td className="py-3 text-right">
                    {d.spread !== null ? (
                      <span
                        className={
                          d.spread > 20
                            ? "text-red"
                            : d.spread > 0
                              ? "text-amber-400"
                              : "text-green"
                        }
                      >
                        {d.spread > 0 ? "+" : ""}
                        {d.spread.toFixed(1)}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 text-right text-muted">
                    {formatNum(d.transactions)}
                  </td>
                  <td className="py-3 text-right">
                    {d.price_change !== null ? (
                      <span
                        className={
                          d.price_change >= 0 ? "text-green" : "text-red"
                        }
                      >
                        {d.price_change >= 0 ? "+" : ""}
                        {d.price_change.toFixed(1)}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
