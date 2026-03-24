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
  const { baseUrl } = await import("@/lib/base-url");
  const base = await baseUrl();
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  return res.json();
}

function fmt(n: number | null | undefined): string {
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
    id: number; name: string; avg_price_m2: number; transactions: number;
    price_change: number | null; region_name: string; region_id: number;
  };
  const wards: Ward[] = data.wards || [];
  const history = historyData.history || [];
  const districtAskingM2: number | null = data.district_asking_m2 ?? null;
  const districtListingCount: number = data.district_listing_count ?? 0;
  const districtRentM2: number | null = data.district_rent_m2 ?? null;
  const districtAvgDom: number | null = data.district_avg_dom != null ? Math.round(data.district_avg_dom) : null;
  const districtDropRate: number | null = data.district_drop_rate_pct ?? null;

  const lastHistoryPrice = history.length > 0
    ? Math.round(history[history.length - 1].avgPriceM2)
    : district.avg_price_m2;

  const districtYield = districtRentM2 && lastHistoryPrice
    ? ((districtRentM2 * 12) / lastHistoryPrice) * 100
    : null;

  const priceChange = district.price_change ??
    (history.length >= 2
      ? ((history[history.length - 1].avgPriceM2 - history[0].avgPriceM2) / history[0].avgPriceM2 * 100)
      : null);

  const spread = districtAskingM2 && lastHistoryPrice
    ? (((districtAskingM2 - lastHistoryPrice) / lastHistoryPrice) * 100)
    : null;

  const maxPrice = Math.max(...wards.map((w) => w.avg_price_m2 || 0));
  const sortedWards = [...wards].sort((a, b) => (b.avg_price_m2 || 0) - (a.avg_price_m2 || 0));

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted flex-wrap">
        <Link href="/prodeje" className="hover:text-foreground transition-colors">Prodeje</Link>
        <span className="text-border">›</span>
        <Link href={`/prodeje/kraj/${district.region_id}`} className="hover:text-foreground transition-colors">
          {district.region_name}
        </Link>
        <span className="text-border">›</span>
        <span className="text-foreground font-medium">{district.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{district.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {district.region_name} · {wards.length} obcí · {fmt(district.transactions)} transakcí
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Posl. prodejní</div>
          <div className="text-xl font-bold text-green">{fmt(lastHistoryPrice)}</div>
          <div className="text-xs text-muted mt-0.5">Kč/m²</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Nabídková</div>
          <div className="text-xl font-bold text-accent-light">{fmt(districtAskingM2)}</div>
          <div className="text-xs text-muted mt-0.5">Kč/m²</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Nájem avg.</div>
          <div className="text-xl font-bold text-purple-400">{fmt(districtRentM2)}</div>
          <div className="text-xs text-muted mt-0.5">Kč/m²</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Yield</div>
          <div className={`text-xl font-bold ${districtYield && districtYield > 5 ? "text-green" : districtYield && districtYield > 3 ? "text-amber-400" : "text-red"}`}>
            {districtYield ? `${districtYield.toFixed(1)}%` : "—"}
          </div>
          <div className="text-xs text-muted mt-0.5">roční výnosnost</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Spread</div>
          <div className={`text-xl font-bold ${spread && spread > 15 ? "text-red" : "text-amber-400"}`}>
            {spread != null ? `+${spread.toFixed(1)}%` : "—"}
          </div>
          <div className="text-xs text-muted mt-0.5">nabídka vs prodej</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Avg. DOM</div>
          <div className="text-xl font-bold">{districtAvgDom != null ? `${districtAvgDom} dní` : "—"}</div>
          <div className="text-xs text-muted mt-0.5">doba na trhu</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Pokles cen</div>
          <div className={`text-xl font-bold ${districtDropRate && districtDropRate > 30 ? "text-green" : districtDropRate && districtDropRate > 15 ? "text-amber-400" : "text-muted"}`}>
            {districtDropRate != null ? `${districtDropRate}%` : "—"}
          </div>
          <div className="text-xs text-muted mt-0.5">inzerátů snížilo cenu</div>
        </div>
      </div>

      {/* Price chart */}
      {history.length > 2 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Vývoj cen – {district.name}</h2>
          <SoldPriceChart monthlyPrices={history} askingPriceM2={districtAskingM2} />
        </div>
      )}

      {/* Wards */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Obce a části</h2>
          <p className="text-xs text-muted mt-0.5">Seřazeno dle průměrné prodejní ceny</p>
        </div>
        <div className="divide-y divide-border/50">
          {sortedWards.map((w, idx) => {
            const barPct = maxPrice > 0 ? (w.avg_price_m2 / maxPrice) * 100 : 0;
            return (
              <Link
                key={w.id}
                href={`/prodeje/obec/${w.id}`}
                className="flex items-center gap-4 px-6 py-3.5 hover:bg-background/60 transition-colors"
              >
                <div className="w-6 shrink-0 text-xs text-muted text-right">{idx + 1}</div>
                <div className="w-44 shrink-0">
                  <div className="font-medium text-sm truncate">{w.name}</div>
                  <div className="text-xs text-muted">{fmt(w.transaction_count || w.transactions)} transakcí</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="relative h-2 overflow-hidden rounded-full bg-border">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-green/60"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
                <div className="w-28 shrink-0 text-right">
                  <div className="font-bold text-green text-sm">{fmt(w.avg_price_m2)}</div>
                  <div className="text-xs text-muted">Kč/m²</div>
                </div>
                {w.price_change !== null && (
                  <div className={`w-14 shrink-0 text-right text-sm font-semibold ${w.price_change >= 0 ? "text-green" : "text-red"}`}>
                    {w.price_change >= 0 ? "+" : ""}{w.price_change.toFixed(1)}%
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
