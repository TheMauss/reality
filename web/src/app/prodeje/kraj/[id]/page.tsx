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
  asking_m2: number | null;
  listing_count: number;
  spread: number | null;
  rent_m2: number | null;
  yield_pct: number | null;
  avg_dom: number | null;
  drop_rate_pct: number | null;
}

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
  if (p < 50000) return "bg-green-dim text-green";
  if (p < 80000) return "bg-amber/10 text-amber";
  if (p < 110000) return "bg-red-dim text-red";
  return "bg-red/20 text-red";
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
    id: number; name: string; avg_price_m2: number; transactions: number; price_change: number | null;
  };
  const districts: District[] = data.districts || [];
  const history = historyData.history || [];

  const lastHistoryPrice = history.length > 0
    ? Math.round(history[history.length - 1].avgPriceM2)
    : region.avg_price_m2;

  const priceChange = region.price_change ??
    (history.length >= 2
      ? ((history[history.length - 1].avgPriceM2 - history[0].avgPriceM2) / history[0].avgPriceM2 * 100)
      : null);

  const totalListings = districts.reduce((s, d) => s + (d.listing_count || 0), 0);
  const districtWeightedAskingM2 = totalListings > 0
    ? Math.round(
        districts.filter(d => d.asking_m2 && d.listing_count).reduce((s, d) => s + d.asking_m2! * d.listing_count, 0) / totalListings
      )
    : null;
  // Fallback to direct region-level asking price when listings lack district_id
  const regionAskingM2 = districtWeightedAskingM2 ?? (data.region_asking_m2 as number | null ?? null);

  const spread = regionAskingM2 && lastHistoryPrice
    ? (((regionAskingM2 - lastHistoryPrice) / lastHistoryPrice) * 100)
    : null;

  const maxPrice = Math.max(...districts.map((d) => d.avg_price_m2 || 0));

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted">
        <Link href="/prodeje" className="hover:text-foreground transition-colors">Prodeje</Link>
        <span className="text-border">›</span>
        <span className="text-foreground font-medium">{region.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{region.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {districts.length} okresů · {fmt(region.transactions)} transakcí
          </p>
        </div>
        {priceChange !== null && (
          <div className={`text-right ${priceChange >= 0 ? "text-green" : "text-red"}`}>
            <div className="text-2xl font-bold">{priceChange >= 0 ? "↑" : "↓"} {Math.abs(priceChange).toFixed(1)}%</div>
            <div className="text-xs text-muted">celková změna</div>
          </div>
        )}
      </div>

      {/* Key metrics */}
      {(() => {
        const regionRentM2 = districts.find(d => d.rent_m2)?.rent_m2 ?? null;
        const regionYield = regionRentM2 && lastHistoryPrice ? ((regionRentM2 * 12) / lastHistoryPrice) * 100 : null;
        const regionAvgDom = districts.filter(d => d.avg_dom && d.listing_count).length > 0
          ? Math.round(districts.reduce((s, d) => s + (d.avg_dom ?? 0) * (d.listing_count ?? 0), 0) /
              districts.filter(d => d.avg_dom && d.listing_count).reduce((s, d) => s + (d.listing_count ?? 0), 0))
          : null;
        const regionDropRate = districts.filter(d => d.drop_rate_pct != null).length > 0
          ? +(districts.filter(d => d.drop_rate_pct != null)
              .reduce((s, d) => s + (d.drop_rate_pct ?? 0), 0) /
              districts.filter(d => d.drop_rate_pct != null).length).toFixed(1)
          : null;
        return (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
            <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-hover hover:bg-surface-2">
              <div className="text-xs text-muted uppercase tracking-wider mb-1">Posl. prodejní</div>
              <div className="text-xl font-bold text-green">{fmt(lastHistoryPrice)}</div>
              <div className="text-xs text-muted mt-0.5">Kč/m²</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-hover hover:bg-surface-2">
              <div className="text-xs text-muted uppercase tracking-wider mb-1">Nabídková</div>
              <div className="text-xl font-bold text-accent-light">{fmt(regionAskingM2)}</div>
              <div className="text-xs text-muted mt-0.5">Kč/m²</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-hover hover:bg-surface-2">
              <div className="text-xs text-muted uppercase tracking-wider mb-1">Nájem avg.</div>
              <div className="text-xl font-bold text-blue">{fmt(regionRentM2)}</div>
              <div className="text-xs text-muted mt-0.5">Kč/m²</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-hover hover:bg-surface-2">
              <div className="text-xs text-muted uppercase tracking-wider mb-1">Yield</div>
              <div className={`text-xl font-bold ${regionYield && regionYield > 5 ? "text-green" : regionYield && regionYield > 3 ? "text-amber" : "text-red"}`}>
                {regionYield ? `${regionYield.toFixed(1)}%` : "—"}
              </div>
              <div className="text-xs text-muted mt-0.5">roční výnosnost</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-hover hover:bg-surface-2">
              <div className="text-xs text-muted uppercase tracking-wider mb-1">Spread</div>
              <div className={`text-xl font-bold ${spread && spread > 15 ? "text-red" : "text-amber"}`}>
                {spread != null ? `+${spread.toFixed(1)}%` : "—"}
              </div>
              <div className="text-xs text-muted mt-0.5">nabídka vs prodej</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-hover hover:bg-surface-2">
              <div className="text-xs text-muted uppercase tracking-wider mb-1">Avg. DOM</div>
              <div className="text-xl font-bold">{regionAvgDom != null ? `${regionAvgDom} dní` : "—"}</div>
              <div className="text-xs text-muted mt-0.5">doba na trhu</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-hover hover:bg-surface-2">
              <div className="text-xs text-muted uppercase tracking-wider mb-1">Pokles cen</div>
              <div className={`text-xl font-bold ${regionDropRate && regionDropRate > 30 ? "text-green" : regionDropRate && regionDropRate > 15 ? "text-amber" : "text-muted"}`}>
                {regionDropRate != null ? `${regionDropRate}%` : "—"}
              </div>
              <div className="text-xs text-muted mt-0.5">inzerátů snížilo cenu</div>
            </div>
          </div>
        );
      })()}

      {/* Price chart */}
      {history.length > 2 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Vývoj cen – {region.name}</h2>
          <SoldPriceChart monthlyPrices={history} askingPriceM2={regionAskingM2} />
        </div>
      )}

      {/* Districts table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Okresy</h2>
          <p className="text-xs text-muted mt-0.5">Klikněte na okres pro detail obcí</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-6 py-3 font-medium text-muted text-xs uppercase tracking-wider">Okres</th>
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
              {districts.map((d) => {
                const barPct = maxPrice > 0 ? (d.avg_price_m2 / maxPrice) * 100 : 0;
                return (
                  <tr key={d.id} className="border-b border-border/40 hover:bg-background/60 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/prodeje/okres/${d.id}`} className="font-semibold text-accent-light hover:underline">
                        {d.name}
                      </Link>
                      <div className="text-xs text-muted mt-0.5">{d.ward_count} obcí</div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-bold ${priceBg(d.avg_price_m2)}`}>
                        {fmt(d.avg_price_m2)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-accent-light font-semibold">{fmt(d.asking_m2)}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-blue font-semibold">{fmt(d.rent_m2)}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {d.yield_pct != null ? (
                        <span className={`text-sm font-bold ${d.yield_pct > 5 ? "text-green" : d.yield_pct > 3 ? "text-amber" : "text-red"}`}>
                          {d.yield_pct.toFixed(1)}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {d.spread !== null ? (
                        <span className={`text-sm font-medium ${d.spread > 20 ? "text-red" : d.spread > 10 ? "text-amber" : "text-green"}`}>
                          {d.spread > 0 ? "+" : ""}{d.spread.toFixed(1)}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs space-y-0.5">
                        {d.avg_dom != null && <div className="text-muted">{Math.round(d.avg_dom)} dní</div>}
                        {d.drop_rate_pct != null && (
                          <div className={d.drop_rate_pct > 25 ? "text-green" : d.drop_rate_pct > 10 ? "text-amber" : "text-muted"}>
                            {d.drop_rate_pct}% poklesů
                          </div>
                        )}
                        {d.avg_dom == null && d.drop_rate_pct == null && <span className="text-muted">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {d.price_change !== null ? (
                        <span className={`text-sm font-semibold ${d.price_change >= 0 ? "text-green" : "text-red"}`}>
                          {d.price_change >= 0 ? "↑" : "↓"} {Math.abs(d.price_change).toFixed(1)}%
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
    </div>
  );
}
