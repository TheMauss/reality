import SoldPriceChart from "@/components/SoldPriceChart";
import Link from "next/link";

interface SoldArea {
  name: string;
  entityType: string;
  entityId: number;
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

interface AskingDistrict {
  district: string;
  avg_price_m2_prodej: number | null;
  avg_price_byt_prodej: number | null;
  total_listings: number;
  byty_prodej: number;
  avg_area: number | null;
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

/**
 * Maps Sreality ward names (from cenová mapa) to our "Praha X" districts.
 * Sreality returns ward-level data (e.g. "Vinohrady", "Smíchov").
 * We try to match them to both Praha X numbered districts (from our DB)
 * and to the Sreality ward-level sold prices.
 */
const WARD_TO_PRAHA: Record<string, string> = {
  // Praha 1
  "Staré Město": "Praha 1",
  "Nové Město": "Praha 1",
  "Malá Strana": "Praha 1",
  Hradčany: "Praha 1",
  Josefov: "Praha 1",
  // Praha 2
  Vinohrady: "Praha 2",
  Vyšehrad: "Praha 2",
  "Nusle (Praha 2)": "Praha 2",
  // Praha 3
  Žižkov: "Praha 3",
  // Praha 4
  Nusle: "Praha 4",
  Podolí: "Praha 4",
  Braník: "Praha 4",
  Krč: "Praha 4",
  Michle: "Praha 4",
  Lhotka: "Praha 4",
  Hodkovičky: "Praha 4",
  Kunratice: "Praha 4",
  // Praha 5
  Smíchov: "Praha 5",
  Košíře: "Praha 5",
  Hlubočepy: "Praha 5",
  Jinonice: "Praha 5",
  Radlice: "Praha 5",
  Stodůlky: "Praha 5",
  // Praha 6
  Dejvice: "Praha 6",
  Bubeneč: "Praha 6",
  Vokovice: "Praha 6",
  Veleslavín: "Praha 6",
  Břevnov: "Praha 6",
  Liboc: "Praha 6",
  Řepy: "Praha 6",
  Suchdol: "Praha 6",
  // Praha 7
  Holešovice: "Praha 7",
  Bubny: "Praha 7",
  Troja: "Praha 7",
  // Praha 8
  Karlín: "Praha 8",
  Libeň: "Praha 8",
  Kobylisy: "Praha 8",
  Bohnice: "Praha 8",
  Čimice: "Praha 8",
  Ďáblice: "Praha 8",
  // Praha 9
  Vysočany: "Praha 9",
  Prosek: "Praha 9",
  Střížkov: "Praha 9",
  Hloubětín: "Praha 9",
  Letňany: "Praha 9",
  Kbely: "Praha 9",
  // Praha 10
  Vršovice: "Praha 10",
  Strašnice: "Praha 10",
  Záběhlice: "Praha 10",
  Hostivař: "Praha 10",
  Malešice: "Praha 10",
};

export default async function TrhPrahaPage() {
  const [soldData, askingData] = await Promise.all([
    fetchJSON(
      "/api/sold-prices?locality=region,10"
    ) as Promise<SoldData>,
    fetchJSON("/api/districts") as Promise<{
      districts: AskingDistrict[];
      pragueTotal: {
        total: number;
        avg_price_m2: number;
        avg_price: number;
        avg_rent_m2: number;
        avg_rent: number;
      };
    }>,
  ]);

  const { overall, areas: soldWards, monthlyPrices } = soldData;
  const askingPriceM2 = askingData.pragueTotal.avg_price_m2;
  const askingDistricts = askingData.districts.filter(
    (d) => d.district !== "Mimo Prahu"
  );

  // Aggregate sold ward-level data into Praha X districts
  const prahaDistrictSold: Record<
    string,
    { totalPrice: number; count: number; transactions: number }
  > = {};

  for (const ward of soldWards) {
    const prahaNum = WARD_TO_PRAHA[ward.name];
    if (!prahaNum) continue;
    if (!prahaDistrictSold[prahaNum]) {
      prahaDistrictSold[prahaNum] = { totalPrice: 0, count: 0, transactions: 0 };
    }
    // Weighted average by transactions
    prahaDistrictSold[prahaNum].totalPrice +=
      ward.avgPriceM2 * ward.transactions;
    prahaDistrictSold[prahaNum].count += ward.transactions;
    prahaDistrictSold[prahaNum].transactions += ward.transactions;
  }

  // Build comparison: Praha X districts
  const districtComparison = askingDistricts
    .map((asking) => {
      const soldAgg = prahaDistrictSold[asking.district];
      const soldPrice = soldAgg
        ? Math.round(soldAgg.totalPrice / soldAgg.count)
        : null;
      const spread =
        asking.avg_price_m2_prodej && soldPrice
          ? ((asking.avg_price_m2_prodej - soldPrice) / soldPrice) * 100
          : null;
      return {
        name: asking.district,
        askingPriceM2: asking.avg_price_m2_prodej,
        askingAvgPrice: asking.avg_price_byt_prodej,
        soldPriceM2: soldPrice,
        spread,
        askingListings: asking.byty_prodej,
        soldTransactions: soldAgg?.transactions ?? 0,
        avgArea: asking.avg_area,
      };
    })
    .sort(
      (a, b) => (b.askingPriceM2 ?? 0) - (a.askingPriceM2 ?? 0)
    );

  // Also show raw ward-level data from Sreality
  const topWards = [...soldWards]
    .sort((a, b) => b.avgPriceM2 - a.avgPriceM2)
    .slice(0, 30);

  const globalSpread =
    askingPriceM2 && overall.avgPriceM2
      ? ((askingPriceM2 - overall.avgPriceM2) / overall.avgPriceM2) * 100
      : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="mb-2">
            <Link
              href="/trh"
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              ← Zpět na ČR
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Analýza trhu – Praha
          </h1>
          <p className="mt-2 text-muted">
            Porovnání nabídkových a prodejních cen podle městských částí Praha
            1–10 a částí obcí.
          </p>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold text-green">
            {formatNum(overall.avgPriceM2)}
          </div>
          <div className="mt-1 text-sm text-muted">
            Prodejní Kč/m²
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold text-accent-light">
            {formatNum(askingPriceM2)}
          </div>
          <div className="mt-1 text-sm text-muted">
            Nabídková Kč/m²
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div
            className={`text-2xl font-bold ${globalSpread && globalSpread > 0 ? "text-amber-400" : "text-green"}`}
          >
            {globalSpread ? `+${globalSpread.toFixed(1)}%` : "—"}
          </div>
          <div className="mt-1 text-sm text-muted">Spread</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold">
            {formatNum(overall.transactions)}
          </div>
          <div className="mt-1 text-sm text-muted">Transakcí</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold">
            {formatNum(askingData.pragueTotal.total)}
          </div>
          <div className="mt-1 text-sm text-muted">Inzerátů</div>
        </div>
      </div>

      {/* Sold price chart */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">
          Vývoj prodejních cen – Praha (byty)
        </h2>
        <SoldPriceChart
          monthlyPrices={monthlyPrices}
          askingPriceM2={askingPriceM2}
        />
      </div>

      {/* Praha 1-10 comparison */}
      {districtComparison.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Praha 1–10 – nabídka vs prodej
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 font-medium">Městská část</th>
                  <th className="pb-2 text-right font-medium">
                    Nabídková Kč/m²
                  </th>
                  <th className="pb-2 text-right font-medium">
                    Prodejní Kč/m²
                  </th>
                  <th className="pb-2 text-right font-medium">Spread</th>
                  <th className="pb-2 text-right font-medium">Prům. cena</th>
                  <th className="pb-2 text-right font-medium">Inzerátů</th>
                  <th className="pb-2 text-right font-medium">Prům. m²</th>
                </tr>
              </thead>
              <tbody>
                {districtComparison.map((d) => (
                  <tr key={d.name} className="border-b border-border/50">
                    <td className="py-3 font-medium">{d.name}</td>
                    <td className="py-3 text-right text-accent-light">
                      {formatNum(d.askingPriceM2)}
                    </td>
                    <td className="py-3 text-right text-green">
                      {d.soldPriceM2 ? formatNum(d.soldPriceM2) : "—"}
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
                    <td className="py-3 text-right">
                      {d.askingAvgPrice
                        ? `${(d.askingAvgPrice / 1_000_000).toFixed(1)} M`
                        : "—"}
                    </td>
                    <td className="py-3 text-right text-muted">
                      {formatNum(d.askingListings)}
                    </td>
                    <td className="py-3 text-right text-muted">
                      {d.avgArea ? `${Math.round(d.avgArea)} m²` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Spread bars for Praha districts */}
      {districtComparison.filter((d) => d.spread !== null).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Spread nabídka vs prodej – Praha
          </h2>
          <div className="space-y-3">
            {districtComparison
              .filter((d) => d.spread !== null)
              .sort((a, b) => (b.spread ?? 0) - (a.spread ?? 0))
              .map((d) => {
                const maxSpread = Math.max(
                  ...districtComparison
                    .filter((x) => x.spread !== null)
                    .map((x) => Math.abs(x.spread!))
                );
                const widthPct =
                  (Math.abs(d.spread!) / (maxSpread || 1)) * 100;
                return (
                  <div key={d.name} className="flex items-center gap-4">
                    <div className="w-32 shrink-0 text-sm font-medium">
                      {d.name}
                    </div>
                    <div className="flex-1">
                      <div className="relative h-6 overflow-hidden rounded bg-background">
                        <div
                          className={`absolute inset-y-0 left-0 rounded ${
                            d.spread! > 20
                              ? "bg-red/60"
                              : d.spread! > 0
                                ? "bg-amber-400/60"
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
                            ? "text-amber-400"
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

      {/* Top wards – raw Sreality data */}
      {topWards.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Části obce – prodejní ceny (cenová mapa)
          </h2>
          <p className="mb-4 text-sm text-muted">
            Detailní data z cenové mapy Sreality – skutečné realizované prodejní
            ceny na úrovni částí obcí.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 font-medium">Část obce</th>
                  <th className="pb-2 text-right font-medium">
                    Prodejní Kč/m²
                  </th>
                  <th className="pb-2 text-right font-medium">Transakcí</th>
                  <th className="pb-2 text-right font-medium">Změna ceny</th>
                </tr>
              </thead>
              <tbody>
                {topWards.map((w) => (
                  <tr key={w.name} className="border-b border-border/50">
                    <td className="py-2 font-medium">
                      {w.name}
                      {WARD_TO_PRAHA[w.name] && (
                        <span className="ml-2 text-xs text-muted">
                          ({WARD_TO_PRAHA[w.name]})
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right text-green">
                      {formatNum(w.avgPriceM2)}
                    </td>
                    <td className="py-2 text-right text-muted">
                      {formatNum(w.transactions)}
                    </td>
                    <td className="py-2 text-right">
                      {w.priceChange !== null ? (
                        <span
                          className={
                            w.priceChange >= 0 ? "text-green" : "text-red"
                          }
                        >
                          {w.priceChange >= 0 ? "+" : ""}
                          {w.priceChange.toFixed(1)}%
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
    </div>
  );
}
