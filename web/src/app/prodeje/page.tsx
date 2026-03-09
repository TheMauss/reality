import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import SoldPriceChart from "@/components/SoldPriceChart";

interface Region {
  id: number;
  name: string;
  avg_price_m2: number;
  transactions: number;
  price_change: number | null;
  district_count: number;
  ward_count: number;
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

export default async function ProdejePage() {
  const [regionsData, historyData] = await Promise.all([
    fetchJSON("/api/sold/regions"),
    fetchJSON("/api/sold/history?entity_type=country&entity_id=112"),
  ]);

  const regions: Region[] = regionsData.regions || [];
  const history = historyData.history || [];

  const totalTransactions = regions.reduce(
    (s, r) => s + (r.transactions || 0),
    0
  );
  // Use latest price from history (= last sold price for CR), fallback to weighted avg
  const lastHistoryPrice = history.length > 0
    ? Math.round(history[history.length - 1].avgPriceM2)
    : null;
  const weightedPrice = totalTransactions > 0
    ? Math.round(
        regions.reduce((s, r) => s + (r.avg_price_m2 || 0) * (r.transactions || 0), 0) / totalTransactions
      )
    : null;
  const avgPrice = lastHistoryPrice || weightedPrice;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Prodeje – Česká republika
          </h1>
          <p className="mt-1 text-muted">
            Realizované prodejní ceny bytů z cenové mapy Sreality. Klikněte na
            kraj pro detail.
          </p>
        </div>
        <SearchBar />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold">{regions.length}</div>
          <div className="mt-1 text-sm text-muted">Krajů</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold text-green">
            {formatNum(avgPrice)}
          </div>
          <div className="mt-1 text-sm text-muted">Posl. prodejní Kč/m²</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold">
            {formatNum(totalTransactions)}
          </div>
          <div className="mt-1 text-sm text-muted">Transakcí celkem</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold text-accent-light">
            {formatNum(
              regions.reduce((s, r) => s + (r.listing_count || 0), 0)
            )}
          </div>
          <div className="mt-1 text-sm text-muted">Aktivních inzerátů</div>
        </div>
      </div>

      {/* Price history chart */}
      {history.length > 2 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Vývoj prodejních cen – celá ČR (byty)
          </h2>
          <SoldPriceChart monthlyPrices={history} askingPriceM2={null} />
        </div>
      )}

      {/* Regions table */}
      {regions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Kraje</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 font-medium">Kraj</th>
                  <th className="pb-2 text-right font-medium">
                    Prodejní Kč/m²
                  </th>
                  <th className="pb-2 text-right font-medium">
                    Nabídková Kč/m²
                  </th>
                  <th className="pb-2 text-right font-medium">Spread</th>
                  <th className="pb-2 text-right font-medium">Transakcí</th>
                  <th className="pb-2 text-right font-medium">Inzerátů</th>
                  <th className="pb-2 text-right font-medium">Okresů</th>
                  <th className="pb-2 text-right font-medium">Změna</th>
                </tr>
              </thead>
              <tbody>
                {regions.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border/50 transition-colors hover:bg-background"
                  >
                    <td className="py-3">
                      <Link
                        href={`/prodeje/kraj/${r.id}`}
                        className="font-medium text-accent-light hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-3 text-right text-green">
                      {formatNum(r.avg_price_m2)}
                    </td>
                    <td className="py-3 text-right text-accent-light">
                      {formatNum(r.asking_m2)}
                    </td>
                    <td className="py-3 text-right">
                      {r.spread !== null ? (
                        <span
                          className={
                            r.spread > 20
                              ? "text-red"
                              : r.spread > 0
                                ? "text-amber-400"
                                : "text-green"
                          }
                        >
                          {r.spread > 0 ? "+" : ""}
                          {r.spread.toFixed(1)}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 text-right text-muted">
                      {formatNum(r.transactions)}
                    </td>
                    <td className="py-3 text-right text-muted">
                      {formatNum(r.listing_count)}
                    </td>
                    <td className="py-3 text-right text-muted">
                      {r.district_count}
                    </td>
                    <td className="py-3 text-right">
                      {r.price_change !== null ? (
                        <span
                          className={
                            r.price_change >= 0 ? "text-green" : "text-red"
                          }
                        >
                          {r.price_change >= 0 ? "+" : ""}
                          {r.price_change.toFixed(1)}%
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
      )}

      {regions.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-lg text-muted">
            Žádná data o prodejích. Spusťte <code>npm run scrape-sold</code> v
            scraper adresáři.
          </p>
        </div>
      )}
    </div>
  );
}
