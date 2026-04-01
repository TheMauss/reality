import Link from "next/link";
import SoldPriceChart from "@/components/SoldPriceChart";
import { baseUrl } from "@/lib/base-url";

async function fetchJSON(path: string) {
  const base = await baseUrl();
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
  yoy_pct: number | null;
  prev_year_price: number | null;
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
  const base = await baseUrl();
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

  // Country-level YOY from history array
  interface HistPoint { year: number; month: number; avgPriceM2: number; yoyPct: number | null }
  const sortedHistory = [...history].sort((a: HistPoint, b: HistPoint) =>
    (b.year * 100 + b.month) - (a.year * 100 + a.month)
  );
  const latestPoint: HistPoint | null = sortedHistory[0] ?? null;
  const countryYoy = latestPoint?.yoyPct ?? null;

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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-border-hover hover:bg-surface-2">
          <div className="text-2xl font-bold text-green">
            {formatNum(avgSoldPrice)}
          </div>
          <div className="mt-1 text-sm text-muted">Posl. prodejní Kč/m² (ČR)</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-border-hover hover:bg-surface-2">
          <div className="text-2xl font-bold text-accent-light">
            {formatNum(avgAskingPrice)}
          </div>
          <div className="mt-1 text-sm text-muted">Nabídková Kč/m² (ČR)</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-border-hover hover:bg-surface-2">
          <div className={`text-2xl font-bold ${avgSpread && avgSpread > 0 ? "text-amber" : "text-green"}`}>
            {avgSpread ? `+${avgSpread.toFixed(1)}%` : "—"}
          </div>
          <div className="mt-1 text-sm text-muted">Spread (ČR)</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-border-hover hover:bg-surface-2">
          {countryYoy !== null ? (
            <div className={`text-2xl font-bold ${countryYoy >= 0 ? "text-green" : "text-red"}`}>
              {countryYoy >= 0 ? "+" : ""}{countryYoy.toFixed(1)}%
            </div>
          ) : (
            <div className="text-2xl font-bold text-muted">—</div>
          )}
          <div className="mt-1 text-sm text-muted">
            YoY změna cen (ČR)
            {latestPoint && <span className="block text-xs opacity-60">{String(latestPoint.month).padStart(2,"0")}/{latestPoint.year} vs –1 rok</span>}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-border-hover hover:bg-surface-2">
          <div className="text-2xl font-bold">{formatNum(totalSoldTransactions)}</div>
          <div className="mt-1 text-sm text-muted">Transakcí (celkem)</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-border-hover hover:bg-surface-2">
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

      {/* YOY by region */}
      {regions.filter(r => r.yoy_pct !== null).length > 0 && (() => {
        const yoyRegions = regions
          .filter(r => r.yoy_pct !== null)
          .sort((a, b) => (b.yoy_pct ?? 0) - (a.yoy_pct ?? 0));
        const maxAbs = Math.max(...yoyRegions.map(r => Math.abs(r.yoy_pct ?? 0)));
        return (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4 mb-1">
              <h2 className="text-lg font-semibold">Meziroční změna cen (YoY) – podle krajů</h2>
              {latestPoint && (
                <span className="shrink-0 text-xs text-muted bg-background rounded-full px-3 py-1 border border-border">
                  {String(latestPoint.month).padStart(2,"0")}/{latestPoint.year} vs {String(latestPoint.month).padStart(2,"0")}/{latestPoint.year - 1}
                </span>
              )}
            </div>
            <p className="mb-5 text-sm text-muted">
              Porovnání průměrné prodejní ceny/m² byty ve stejném měsíci loňského a letošního roku.
            </p>
            <div className="space-y-2.5">
              {yoyRegions.map(r => {
                const pct = r.yoy_pct!;
                const barWidth = (Math.abs(pct) / (maxAbs || 1)) * 100;
                const positive = pct >= 0;
                return (
                  <div key={r.id} className="flex items-center gap-3">
                    <div className="w-44 shrink-0 text-sm">
                      <Link href={`/prodeje/kraj/${r.id}`} className="font-medium text-accent-light hover:underline">
                        {r.name}
                      </Link>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="relative h-5 flex-1 overflow-hidden rounded bg-background">
                        <div
                          className={`absolute inset-y-0 left-0 rounded transition-all ${positive ? "bg-green/50" : "bg-red/50"}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <div className={`w-16 shrink-0 text-right text-sm font-bold ${positive ? "text-green" : "text-red"}`}>
                        {positive ? "+" : ""}{pct.toFixed(1)}%
                      </div>
                      {r.prev_year_price && (
                        <div className="w-28 shrink-0 text-right text-xs text-muted hidden lg:block">
                          {formatNum(r.prev_year_price)} → {formatNum(r.avg_price_m2)} Kč/m²
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

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
                                ? "bg-amber/60"
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
                            ? "text-amber"
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
                                ? "font-bold text-amber"
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

      {/* Price table by region — sold price + YOY + spread + transactions */}
      {regions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-1 text-lg font-semibold">Přehled prodejních cen – kraje</h2>
          <p className="mb-4 text-sm text-muted">Seřazeno dle YoY změny. Kliknutím na kraj zobrazíte detail.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 font-medium">Kraj</th>
                  <th className="pb-2 text-right font-medium">Prodejní Kč/m²</th>
                  <th className="pb-2 text-right font-medium">YoY</th>
                  <th className="pb-2 text-right font-medium">Nabídka Kč/m²</th>
                  <th className="pb-2 text-right font-medium">Spread</th>
                  <th className="pb-2 text-right font-medium">Transakcí</th>
                </tr>
              </thead>
              <tbody>
                {regions
                  .slice()
                  .sort((a, b) => (b.yoy_pct ?? -999) - (a.yoy_pct ?? -999))
                  .map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-background/40 transition-colors">
                      <td className="py-2.5">
                        <Link href={`/prodeje/kraj/${r.id}`} className="font-medium text-accent-light hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td className="py-2.5 text-right font-medium text-foreground">
                        {formatNum(r.avg_price_m2)}
                      </td>
                      <td className="py-2.5 text-right">
                        {r.yoy_pct !== null ? (
                          <span className={`font-bold ${r.yoy_pct >= 0 ? "text-green" : "text-red"}`}>
                            {r.yoy_pct >= 0 ? "+" : ""}{r.yoy_pct.toFixed(1)}%
                          </span>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="py-2.5 text-right text-muted">{formatNum(r.asking_m2)}</td>
                      <td className="py-2.5 text-right">
                        {r.spread !== null ? (
                          <span className={`font-medium ${r.spread > 20 ? "text-red" : r.spread > 0 ? "text-amber" : "text-green"}`}>
                            {r.spread > 0 ? "+" : ""}{r.spread.toFixed(1)}%
                          </span>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="py-2.5 text-right text-muted">{formatNum(r.transactions)}</td>
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
            <div className="text-lg font-bold text-amber">Mapa</div>
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
