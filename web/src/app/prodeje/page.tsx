import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import SoldPriceChart from "@/components/SoldPriceChart";

interface Region {
  id: number;
  name: string;
  avg_price_m2: number;
  transactions: number;
  price_change: number | null;
  yoy_pct: number | null;
  prev_year_price: number | null;
  district_count: number;
  ward_count: number;
  asking_m2: number | null;
  listing_count: number;
  spread: number | null;
  avg_dom: number | null;
  drop_rate_pct: number | null;
}

// Maps sold_regions.id → region name (same IDs as Sreality locality_region_id)
const SOLD_ID_TO_NAME: Record<number, string> = {
  10: "Praha", 1: "Jihočeský", 2: "Plzeňský", 3: "Karlovarský", 4: "Ústecký",
  5: "Liberecký", 6: "Královéhradecký", 7: "Pardubický", 8: "Olomoucký", 9: "Zlínský",
  11: "Středočeský", 12: "Moravskoslezský", 13: "Vysočina", 14: "Jihomoravský",
};

async function fetchJSON(path: string) {
  const { baseUrl } = await import("@/lib/base-url");
  const base = await baseUrl();
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  return res.json();
}

function fmt(n: number | null | undefined): string {
  if (!n) return "—";
  return Math.round(n).toLocaleString("cs-CZ");
}

function priceBg(p: number): string {
  if (p < 50000) return "bg-emerald-500/10 text-emerald-400";
  if (p < 80000) return "bg-yellow-500/10 text-yellow-400";
  if (p < 110000) return "bg-orange-500/10 text-orange-400";
  return "bg-red-500/10 text-red-400";
}

export default async function ProdejePage() {
  const [regionsData, historyData, regionsDBData] = await Promise.all([
    fetchJSON("/api/sold/regions"),
    fetchJSON("/api/sold/history?entity_type=country&entity_id=112"),
    fetchJSON("/api/regions"),
  ]);

  const regions: Region[] = regionsData.regions || [];
  const history = historyData.history || [];

  // Build rent map: sold_region_id → {rent_m2, yield_pct}
  const rentMap: Record<number, { rent_m2: number; yield_pct: number }> = {};
  for (const r of (regionsDBData.regions || [])) {
    for (const [id, name] of Object.entries(SOLD_ID_TO_NAME)) {
      if (r.region === name && r.avg_price_m2_najem) {
        const soldRegion = regions.find(sr => sr.id === Number(id));
        const soldPrice = soldRegion?.avg_price_m2;
        rentMap[Number(id)] = {
          rent_m2: r.avg_price_m2_najem,
          yield_pct: soldPrice ? ((r.avg_price_m2_najem * 12) / soldPrice) * 100 : 0,
        };
      }
    }
  }

  const totalTransactions = regions.reduce((s, r) => s + (r.transactions || 0), 0);
  const totalListings = regions.reduce((s, r) => s + (r.listing_count || 0), 0);

  const lastHistoryPrice = history.length > 0
    ? Math.round(history[history.length - 1].avgPriceM2)
    : null;
  const weightedPrice = totalTransactions > 0
    ? Math.round(regions.reduce((s, r) => s + (r.avg_price_m2 || 0) * (r.transactions || 0), 0) / totalTransactions)
    : null;
  const avgPrice = lastHistoryPrice || weightedPrice;

  const nationalAskingM2 = totalListings > 0
    ? Math.round(regions.filter(r => r.asking_m2 && r.listing_count).reduce((s, r) => s + r.asking_m2! * r.listing_count, 0) / totalListings)
    : null;

  const nationalRentM2 = regionsDBData.countryTotal?.avg_rent_m2 ?? null;

  const spread = nationalAskingM2 && avgPrice
    ? (((nationalAskingM2 - avgPrice) / avgPrice) * 100)
    : null;

  const nationalYield = nationalRentM2 && avgPrice
    ? ((nationalRentM2 * 12) / avgPrice) * 100
    : null;

  const nationalAvgDom = regions.filter(r => r.avg_dom && r.listing_count).length > 0
    ? Math.round(regions.reduce((s, r) => s + (r.avg_dom ?? 0) * (r.listing_count ?? 0), 0) /
        regions.filter(r => r.avg_dom && r.listing_count).reduce((s, r) => s + (r.listing_count ?? 0), 0))
    : null;
  const nationalDropRate = regions.filter(r => r.drop_rate_pct != null && r.listing_count).length > 0
    ? +(regions.filter(r => r.drop_rate_pct != null && r.listing_count)
        .reduce((s, r) => s + (r.drop_rate_pct ?? 0), 0) /
        regions.filter(r => r.drop_rate_pct != null).length).toFixed(1)
    : null;

  // True YoY: latest month's same-month-prior-year comparison
  const latestPoint = history.length > 0 ? history[history.length - 1] : null;
  const yoyChange: number | null = latestPoint?.yoyPct ?? null;

  const maxPrice = Math.max(...regions.map(r => r.avg_price_m2 || 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trh s byty · Česká republika</h1>
          <p className="mt-1 text-sm text-muted">
            Realizované prodejní ceny z katastru nemovitostí · {history.length > 0 && `data od ${history[0].label}`}
          </p>
        </div>
        <SearchBar />
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Posl. prodejní</div>
          <div className="text-xl font-bold text-green">{fmt(avgPrice)}</div>
          <div className="text-xs text-muted mt-0.5">Kč/m²</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Nabídková</div>
          <div className="text-xl font-bold text-accent-light">{fmt(nationalAskingM2)}</div>
          <div className="text-xs text-muted mt-0.5">Kč/m²</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Nájem avg.</div>
          <div className="text-xl font-bold text-purple-400">{fmt(nationalRentM2)}</div>
          <div className="text-xs text-muted mt-0.5">Kč/m²</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Spread</div>
          <div className={`text-xl font-bold ${spread && spread > 15 ? "text-red" : "text-amber-400"}`}>
            {spread != null ? `+${spread.toFixed(1)}%` : "—"}
          </div>
          <div className="text-xs text-muted mt-0.5">nabídka vs prodej</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Yield (ČR)</div>
          <div className={`text-xl font-bold ${nationalYield && nationalYield > 5 ? "text-green" : nationalYield && nationalYield > 3 ? "text-amber-400" : "text-red"}`}>
            {nationalYield ? `${nationalYield.toFixed(1)}%` : "—"}
          </div>
          <div className="text-xs text-muted mt-0.5">roční výnosnost</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Aktivní inzeráty</div>
          <div className="text-xl font-bold text-accent-light">{fmt(totalListings)}</div>
          <div className="text-xs text-muted mt-0.5">bytů na prodej</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Avg. DOM</div>
          <div className="text-xl font-bold">{nationalAvgDom != null ? `${nationalAvgDom} dní` : "—"}</div>
          <div className="text-xs text-muted mt-0.5">doba na trhu</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Pokles cen</div>
          <div className={`text-xl font-bold ${nationalDropRate && nationalDropRate > 30 ? "text-green" : nationalDropRate && nationalDropRate > 15 ? "text-amber-400" : "text-muted"}`}>
            {nationalDropRate != null ? `${nationalDropRate}%` : "—"}
          </div>
          <div className="text-xs text-muted mt-0.5">inzerátů snížilo cenu</div>
        </div>
      </div>

      {/* Price chart */}
      {history.length > 2 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Vývoj cen – celá ČR</h2>
              {yoyChange !== null && latestPoint && (
                <p className="text-sm text-muted mt-0.5">
                  YoY ({latestPoint.label}):&nbsp;
                  <span className={yoyChange >= 0 ? "text-green font-semibold" : "text-red font-semibold"}>
                    {yoyChange >= 0 ? "+" : ""}{yoyChange.toFixed(1)}%
                  </span>
                  &nbsp;vs stejný měsíc minulého roku
                </p>
              )}
            </div>
          </div>
          <SoldPriceChart monthlyPrices={history} askingPriceM2={nationalAskingM2} />
        </div>
      )}

      {/* Regions table */}
      {regions.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold">Kraje</h2>
            <p className="text-xs text-muted mt-0.5">Klikněte na kraj pro podrobnosti · seřazeno dle prodejní ceny</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-6 py-3 font-medium text-muted text-xs uppercase tracking-wider">Kraj</th>
                  <th className="px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider text-right">Prodejní Kč/m²</th>
                  <th className="px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider text-right">Nabídková</th>
                  <th className="px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider text-right">Nájem Kč/m²</th>
                  <th className="px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider text-right">Yield</th>
                  <th className="px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider text-right">Spread</th>
                  <th className="px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider">Likvidita</th>
                  <th className="px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider text-right">YoY</th>
                </tr>
              </thead>
              <tbody>
                {regions.map((r) => {
                  const barPct = maxPrice > 0 ? (r.avg_price_m2 / maxPrice) * 100 : 0;
                  const rent = rentMap[r.id];
                  return (
                    <tr key={r.id} className="border-b border-border/40 hover:bg-background/60 transition-colors">
                      <td className="px-6 py-4">
                        <Link href={`/prodeje/kraj/${r.id}`} className="font-semibold text-accent-light hover:underline">
                          {r.name}
                        </Link>
                        <div className="text-xs text-muted mt-0.5">{r.district_count} okresů</div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-bold ${priceBg(r.avg_price_m2)}`}>
                          {fmt(r.avg_price_m2)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-accent-light font-semibold">{fmt(r.asking_m2)}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-purple-400 font-semibold">{rent ? fmt(rent.rent_m2) : "—"}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {rent?.yield_pct ? (
                          <span className={`text-sm font-bold ${rent.yield_pct > 5 ? "text-green" : rent.yield_pct > 3 ? "text-amber-400" : "text-red"}`}>
                            {rent.yield_pct.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {r.spread !== null ? (
                          <span className={`text-sm font-medium ${r.spread > 20 ? "text-red" : r.spread > 10 ? "text-amber-400" : "text-green"}`}>
                            {r.spread > 0 ? "+" : ""}{r.spread.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-xs space-y-0.5">
                          {r.avg_dom != null && (
                            <div className="text-muted">{Math.round(r.avg_dom)} dní</div>
                          )}
                          {r.drop_rate_pct != null && (
                            <div className={r.drop_rate_pct > 25 ? "text-green" : r.drop_rate_pct > 10 ? "text-amber-400" : "text-muted"}>
                              {r.drop_rate_pct}% poklesů
                            </div>
                          )}
                          {r.avg_dom == null && r.drop_rate_pct == null && <span className="text-muted">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {r.yoy_pct !== null ? (
                          <span className={`text-sm font-semibold ${r.yoy_pct >= 0 ? "text-green" : "text-red"}`}>
                            {r.yoy_pct >= 0 ? "+" : ""}{r.yoy_pct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {regions.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-lg text-muted">Žádná data. Spusťte scraper prodejů.</p>
        </div>
      )}
    </div>
  );
}
