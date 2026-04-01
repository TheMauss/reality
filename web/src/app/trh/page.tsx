import SoldPriceChart from "@/components/SoldPriceChart";
import Link from "next/link";

interface SoldArea {
  name: string;
  entityType: string;
  entityId: number;
  seoName: string;
  avgPriceM2: number;
  transactions: number;
  priceChange: number | null;
}

interface MonthlyPrice {
  year: number;
  month: number;
  avgPriceM2: number;
  label: string;
}

interface SoldData {
  overall: {
    avgPriceM2: number;
    transactions: number;
    priceChange: number | null;
  };
  areas: SoldArea[];
  monthlyPrices: MonthlyPrice[];
}

interface AskingRegion {
  region: string;
  avg_price_m2_prodej: number | null;
  total_listings: number;
  byty_prodej: number;
}

async function fetchJSON(path: string) {
  const { baseUrl } = await import("@/lib/base-url");
  const base = await baseUrl();
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  return res.json();
}

function formatNum(n: number | null | undefined): string {
  if (!n) return "—";
  return Math.round(n).toLocaleString("cs-CZ");
}

/** Maps Sreality region names to our DB region names */
const SREALITY_TO_DB_REGION: Record<string, string> = {
  "Hlavni mesto Praha": "Praha",
  "Jihocesky kraj": "Jihočeský",
  "Plzensky kraj": "Plzeňský",
  "Karlovarsky kraj": "Karlovarský",
  "Ustecky kraj": "Ústecký",
  "Liberecky kraj": "Liberecký",
  "Kralovehradecky kraj": "Královéhradecký",
  "Pardubicky kraj": "Pardubický",
  "Olomoucky kraj": "Olomoucký",
  "Zlinsky kraj": "Zlínský",
  "Stredocesky kraj": "Středočeský",
  "Moravskoslezsky kraj": "Moravskoslezský",
  "Kraj Vysocina": "Vysočina",
  "Jihomoravsky kraj": "Jihomoravský",
};

export default async function TrhPage() {
  // CR-wide: no locality param → returns all regions
  const [soldData, askingData] = await Promise.all([
    fetchJSON("/api/sold-prices") as Promise<SoldData>,
    fetchJSON("/api/regions") as Promise<{
      regions: AskingRegion[];
      countryTotal: {
        total: number;
        avg_price_m2: number;
        avg_price: number;
      };
    }>,
  ]);

  const { overall, areas: soldRegions, monthlyPrices } = soldData;
  const askingPriceM2 = askingData.countryTotal.avg_price_m2;
  const askingRegions = askingData.regions;

  // Match sold regions with asking regions
  const regionComparison = soldRegions
    .map((sold) => {
      const dbName = SREALITY_TO_DB_REGION[sold.name] || sold.name;
      const asking = askingRegions.find((a) => a.region === dbName);
      const askingPrice = asking?.avg_price_m2_prodej ?? null;
      const spread =
        askingPrice && sold.avgPriceM2
          ? ((askingPrice - sold.avgPriceM2) / sold.avgPriceM2) * 100
          : null;
      return {
        name: sold.name,
        dbName,
        entityId: sold.entityId,
        soldPriceM2: sold.avgPriceM2,
        askingPriceM2: askingPrice,
        askingListings: asking?.byty_prodej ?? 0,
        spread,
        transactions: sold.transactions,
        priceChange: sold.priceChange,
        isPrague: sold.entityId === 10,
      };
    })
    .filter((d) => d.soldPriceM2 > 0)
    .sort((a, b) => b.soldPriceM2 - a.soldPriceM2);

  const globalSpread =
    askingPriceM2 && overall.avgPriceM2
      ? ((askingPriceM2 - overall.avgPriceM2) / overall.avgPriceM2) * 100
      : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Analýza trhu – Česká republika
          </h1>
          <p className="mt-2 text-muted">
            Porovnání nabídkových a skutečných prodejních cen bytů podle krajů.
            Data z cenové mapy Sreality.cz.
          </p>
        </div>
        <Link
          href="/trh/praha"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-light"
        >
          Detail Praha →
        </Link>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold text-green">
            {formatNum(overall.avgPriceM2)}
          </div>
          <div className="mt-1 text-sm text-muted">
            Prodejní Kč/m² (ČR)
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold text-accent-light">
            {formatNum(askingPriceM2)}
          </div>
          <div className="mt-1 text-sm text-muted">
            Nabídková Kč/m² (ČR)
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div
            className={`text-2xl font-bold ${globalSpread && globalSpread > 0 ? "text-amber" : "text-green"}`}
          >
            {globalSpread ? `+${globalSpread.toFixed(1)}%` : "—"}
          </div>
          <div className="mt-1 text-sm text-muted">
            Spread (nabídka vs prodej)
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold">
            {formatNum(overall.transactions)}
          </div>
          <div className="mt-1 text-sm text-muted">
            Realizovaných transakcí
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold">
            {formatNum(askingData.countryTotal.total)}
          </div>
          <div className="mt-1 text-sm text-muted">
            Inzerátů v databázi
          </div>
        </div>
      </div>

      {/* Sold price chart – CR wide */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">
          Vývoj prodejních cen – celá ČR (byty)
        </h2>
        <SoldPriceChart
          monthlyPrices={monthlyPrices}
          askingPriceM2={askingPriceM2}
        />
      </div>

      {/* Region comparison table */}
      {regionComparison.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Kraje – nabídka vs prodej
          </h2>
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
                  <th className="pb-2 text-right font-medium">Změna ceny</th>
                </tr>
              </thead>
              <tbody>
                {regionComparison.map((d) => (
                  <tr
                    key={d.name}
                    className={`border-b border-border/50 ${d.isPrague ? "bg-accent/5" : ""}`}
                  >
                    <td className="py-3 font-medium">
                      {d.isPrague ? (
                        <Link
                          href="/trh/praha"
                          className="text-accent-light hover:underline"
                        >
                          {d.dbName}
                        </Link>
                      ) : (
                        d.dbName
                      )}
                    </td>
                    <td className="py-3 text-right text-green">
                      {formatNum(d.soldPriceM2)}
                    </td>
                    <td className="py-3 text-right text-accent-light">
                      {d.askingPriceM2 ? formatNum(d.askingPriceM2) : "—"}
                    </td>
                    <td className="py-3 text-right">
                      {d.spread !== null ? (
                        <span
                          className={
                            d.spread > 20
                              ? "text-red"
                              : d.spread > 0
                                ? "text-amber"
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
                    <td className="py-3 text-right text-muted">
                      {formatNum(d.askingListings)}
                    </td>
                    <td className="py-3 text-right">
                      {d.priceChange !== null ? (
                        <span
                          className={
                            d.priceChange >= 0 ? "text-green" : "text-red"
                          }
                        >
                          {d.priceChange >= 0 ? "+" : ""}
                          {d.priceChange.toFixed(1)}%
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

      {/* Spread visualization */}
      {regionComparison.filter((d) => d.spread !== null).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Spread nabídka vs prodej – vizualizace
          </h2>
          <p className="mb-4 text-sm text-muted">
            Jak moc se liší nabídkové ceny od skutečných prodejních cen.
            Vyšší spread = větší prostor pro vyjednávání.
          </p>
          <div className="space-y-3">
            {regionComparison
              .filter((d) => d.spread !== null)
              .sort((a, b) => (b.spread ?? 0) - (a.spread ?? 0))
              .map((d) => {
                const maxSpread = Math.max(
                  ...regionComparison
                    .filter((x) => x.spread !== null)
                    .map((x) => Math.abs(x.spread!))
                );
                const widthPct =
                  (Math.abs(d.spread!) / (maxSpread || 1)) * 100;
                return (
                  <div key={d.name} className="flex items-center gap-4">
                    <div className="w-40 shrink-0 text-sm font-medium">
                      {d.isPrague ? (
                        <Link
                          href="/trh/praha"
                          className="text-accent-light hover:underline"
                        >
                          {d.dbName}
                        </Link>
                      ) : (
                        d.dbName
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="relative h-6 overflow-hidden rounded bg-background">
                        <div
                          className={`absolute inset-y-0 left-0 rounded ${
                            d.spread! > 20
                              ? "bg-red/60"
                              : d.spread! > 0
                                ? "bg-amber/60"
                                : "bg-green/60"
                          }`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                    <div
                      className={`w-16 shrink-0 text-right text-sm font-bold ${
                        d.spread! > 20
                          ? "text-red"
                          : d.spread! > 0
                            ? "text-amber"
                            : "text-green"
                      }`}
                    >
                      {d.spread! > 0 ? "+" : ""}
                      {d.spread!.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
