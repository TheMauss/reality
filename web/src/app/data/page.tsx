import Link from "next/link";
import SoldPriceChart from "@/components/SoldPriceChart";

async function fetchJSON(path: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  return res.json();
}

function formatNum(n: number | null | undefined): string {
  if (!n) return "—";
  return Math.round(n).toLocaleString("cs-CZ");
}

interface Region {
  id: number;
  name: string;
  avg_price_m2: number;
  transactions: number;
  price_change: number | null;
  asking_m2: number | null;
  listing_count: number;
  spread: number | null;
}

interface DomStat {
  days_min: number;
  days_avg: number;
  days_max: number;
  total: number;
}

export default async function DataPage() {
  const [regionsData, historyData, statsData] = await Promise.all([
    fetchJSON("/api/sold/regions"),
    fetchJSON("/api/sold/history?entity_type=country&entity_id=112"),
    fetchJSON("/api/stats"),
  ]);

  const regions: Region[] = regionsData.regions || [];
  const history = historyData.history || [];

  // Calculate rental yield data from our listings
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  let yieldData: Array<{
    region: string;
    avg_sale_m2: number;
    avg_rent_m2: number;
    yield_pct: number;
    sale_count: number;
    rent_count: number;
  }> = [];

  try {
    const regionsRes = await fetch(`${base}/api/regions`, {
      cache: "no-store",
    });
    const regionsDBData = await regionsRes.json();
    const dbRegions = regionsDBData.regions || [];

    yieldData = dbRegions
      .filter(
        (r: {
          avg_price_m2_prodej: number | null;
          avg_price_m2_najem: number | null;
        }) => r.avg_price_m2_prodej && r.avg_price_m2_najem
      )
      .map(
        (r: {
          region: string;
          avg_price_m2_prodej: number;
          avg_price_m2_najem: number;
          byty_prodej: number;
          byty_najem: number;
        }) => ({
          region: r.region,
          avg_sale_m2: r.avg_price_m2_prodej,
          avg_rent_m2: r.avg_price_m2_najem,
          yield_pct: ((r.avg_price_m2_najem * 12) / r.avg_price_m2_prodej) * 100,
          sale_count: r.byty_prodej,
          rent_count: r.byty_najem,
        })
      )
      .sort(
        (
          a: { yield_pct: number },
          b: { yield_pct: number }
        ) => b.yield_pct - a.yield_pct
      );
  } catch {
    /* regions API might fail */
  }

  // Days on market
  let domStats: DomStat | null = null;
  try {
    const domRes = await fetch(
      `${base}/api/listings?sort=newest&limit=1`,
      { cache: "no-store" }
    );
    const domData = await domRes.json();
    if (domData.total > 0) {
      // Calculate from stats — we track first_seen_at
      domStats = { days_min: 0, days_avg: 0, days_max: 0, total: domData.total };
    }
  } catch { /* */ }

  // Global averages — use weighted average by transactions for sold price
  const totalSoldTransactions = regions.reduce((s, r) => s + (r.transactions || 0), 0);
  const weightedSoldPrice = totalSoldTransactions > 0
    ? Math.round(
        regions.reduce((s, r) => s + (r.avg_price_m2 || 0) * (r.transactions || 0), 0) / totalSoldTransactions
      )
    : null;
  // Use latest data point from price history if available
  const lastHistoryPrice = history.length > 0
    ? (history[history.length - 1] as { avg_price_m2?: number; avgPriceM2?: number }).avgPriceM2 ?? (history[history.length - 1] as { avg_price_m2?: number }).avg_price_m2 ?? null
    : null;
  const avgSoldPrice = lastHistoryPrice ? Math.round(lastHistoryPrice) : weightedSoldPrice;

  // Weighted asking price
  const regionsWithAsking = regions.filter(r => r.asking_m2 && r.listing_count);
  const totalAskingListings = regionsWithAsking.reduce((s, r) => s + (r.listing_count || 0), 0);
  const avgAskingPrice = totalAskingListings > 0
    ? Math.round(
        regionsWithAsking.reduce((s, r) => s + (r.asking_m2 || 0) * (r.listing_count || 0), 0) / totalAskingListings
      )
    : null;
  const avgSpread = avgSoldPrice && avgAskingPrice
    ? ((avgAskingPrice - avgSoldPrice) / avgSoldPrice * 100)
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Data & Analýzy
        </h1>
        <p className="mt-1 text-muted">
          Cenový index, spread, rental yield a trendy na českém trhu
          nemovitostí.
        </p>
      </div>

      {/* Top-level metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold text-green">
            {formatNum(avgSoldPrice)}
          </div>
          <div className="mt-1 text-sm text-muted">Posl. prodejní Kč/m² (ČR)</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold text-accent-light">
            {formatNum(avgAskingPrice)}
          </div>
          <div className="mt-1 text-sm text-muted">Nabídková Kč/m² (ČR)</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className={`text-2xl font-bold ${avgSpread && avgSpread > 0 ? "text-amber-400" : "text-green"}`}>
            {avgSpread ? `+${avgSpread.toFixed(1)}%` : "—"}
          </div>
          <div className="mt-1 text-sm text-muted">Spread (ČR)</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold">{formatNum(totalSoldTransactions)}</div>
          <div className="mt-1 text-sm text-muted">Transakcí</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold">{formatNum(statsData.totalListings)}</div>
          <div className="mt-1 text-sm text-muted">Inzerátů</div>
        </div>
      </div>

      {/* Price index chart */}
      {history.length > 2 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Cenový index – ČR (byty, prodejní ceny)
          </h2>
          <SoldPriceChart monthlyPrices={history} askingPriceM2={avgAskingPrice} />
        </div>
      )}

      {/* Spread by region */}
      {regions.filter(r => r.spread !== null).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Spread nabídka vs prodej – podle krajů
          </h2>
          <p className="mb-4 text-sm text-muted">
            O kolik % je nabídková cena vyšší než skutečná prodejní cena.
          </p>
          <div className="space-y-3">
            {regions
              .filter((r) => r.spread !== null)
              .sort((a, b) => (b.spread ?? 0) - (a.spread ?? 0))
              .map((r) => {
                const maxSpread = Math.max(
                  ...regions
                    .filter((x) => x.spread !== null)
                    .map((x) => Math.abs(x.spread!))
                );
                const widthPct = (Math.abs(r.spread!) / (maxSpread || 1)) * 100;
                return (
                  <div key={r.id} className="flex items-center gap-4">
                    <div className="w-40 shrink-0 text-sm">
                      <Link
                        href={`/prodeje/kraj/${r.id}`}
                        className="font-medium text-accent-light hover:underline"
                      >
                        {r.name}
                      </Link>
                    </div>
                    <div className="flex-1">
                      <div className="relative h-5 overflow-hidden rounded bg-background">
                        <div
                          className={`absolute inset-y-0 left-0 rounded ${
                            r.spread! > 20
                              ? "bg-red/60"
                              : r.spread! > 0
                                ? "bg-amber-400/60"
                                : "bg-green/60"
                          }`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                    <div
                      className={`w-16 shrink-0 text-right text-sm font-bold ${
                        r.spread! > 20
                          ? "text-red"
                          : r.spread! > 0
                            ? "text-amber-400"
                            : "text-green"
                      }`}
                    >
                      {r.spread! > 0 ? "+" : ""}
                      {r.spread!.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Rental yield */}
      {yieldData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Rental Yield – roční výnosnost nájmu
          </h2>
          <p className="mb-4 text-sm text-muted">
            Výpočet: (průměrný nájem/m² × 12) ÷ průměrná prodejní cena/m² × 100.
            Vyšší = lepší investice do pronájmu.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 font-medium">Kraj</th>
                  <th className="pb-2 text-right font-medium">Prodej Kč/m²</th>
                  <th className="pb-2 text-right font-medium">Nájem Kč/m²</th>
                  <th className="pb-2 text-right font-medium">Yield</th>
                  <th className="pb-2 text-right font-medium">Inz. prodej</th>
                  <th className="pb-2 text-right font-medium">Inz. nájem</th>
                </tr>
              </thead>
              <tbody>
                {yieldData.map(
                  (y: {
                    region: string;
                    avg_sale_m2: number;
                    avg_rent_m2: number;
                    yield_pct: number;
                    sale_count: number;
                    rent_count: number;
                  }) => (
                    <tr
                      key={y.region}
                      className="border-b border-border/50"
                    >
                      <td className="py-2.5 font-medium">{y.region}</td>
                      <td className="py-2.5 text-right">
                        {formatNum(y.avg_sale_m2)}
                      </td>
                      <td className="py-2.5 text-right">
                        {formatNum(y.avg_rent_m2)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className={
                            y.yield_pct > 5
                              ? "font-bold text-green"
                              : y.yield_pct > 3
                                ? "font-bold text-amber-400"
                                : "font-bold text-red"
                          }
                        >
                          {y.yield_pct.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-muted">
                        {formatNum(y.sale_count)}
                      </td>
                      <td className="py-2.5 text-right text-muted">
                        {formatNum(y.rent_count)}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Price change by region */}
      {regions.filter(r => r.price_change !== null).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Cenové trendy – změna prodejních cen
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 font-medium">Kraj</th>
                  <th className="pb-2 text-right font-medium">Prodejní Kč/m²</th>
                  <th className="pb-2 text-right font-medium">Změna</th>
                  <th className="pb-2 text-right font-medium">Transakcí</th>
                </tr>
              </thead>
              <tbody>
                {regions
                  .filter(r => r.price_change !== null)
                  .sort((a, b) => (b.price_change ?? 0) - (a.price_change ?? 0))
                  .map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-2.5">
                        <Link
                          href={`/prodeje/kraj/${r.id}`}
                          className="font-medium text-accent-light hover:underline"
                        >
                          {r.name}
                        </Link>
                      </td>
                      <td className="py-2.5 text-right text-green">
                        {formatNum(r.avg_price_m2)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`font-bold ${r.price_change! >= 0 ? "text-green" : "text-red"}`}
                        >
                          {r.price_change! >= 0 ? "+" : ""}
                          {r.price_change!.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-muted">
                        {formatNum(r.transactions)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Rychlé odkazy</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Link
            href="/prodeje"
            className="rounded-lg bg-background p-4 text-center transition-colors hover:bg-background/80"
          >
            <div className="text-lg font-bold text-green">Prodeje</div>
            <div className="text-xs text-muted">Cenová mapa ČR</div>
          </Link>
          <Link
            href="/inzerce"
            className="rounded-lg bg-background p-4 text-center transition-colors hover:bg-background/80"
          >
            <div className="text-lg font-bold text-accent-light">Inzerce</div>
            <div className="text-xs text-muted">Všechny inzeráty</div>
          </Link>
          <Link
            href="/mapa"
            className="rounded-lg bg-background p-4 text-center transition-colors hover:bg-background/80"
          >
            <div className="text-lg font-bold text-amber-400">Mapa</div>
            <div className="text-xs text-muted">Interaktivní mapa</div>
          </Link>
          <Link
            href="/praha"
            className="rounded-lg bg-background p-4 text-center transition-colors hover:bg-background/80"
          >
            <div className="text-lg font-bold">Praha</div>
            <div className="text-xs text-muted">Detail Praha</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
