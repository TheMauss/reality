import DistrictBar from "@/components/DistrictBar";
import PriceChart from "@/components/PriceChart";

interface PragueTotal {
  total: number;
  avg_price_m2: number;
  avg_price: number;
  avg_rent_m2: number;
  avg_rent: number;
}

async function fetchJSON(path: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  return res.json();
}

function formatNum(n: number | null): string {
  if (!n) return "—";
  return Math.round(n).toLocaleString("cs-CZ");
}

export default async function PrahaPage() {
  const [districtsData, indexData] = await Promise.all([
    fetchJSON("/api/districts"),
    fetchJSON("/api/price-index"),
  ]);

  const { districts, pragueTotal } = districtsData as {
    districts: Array<{
      district: string;
      total_listings: number;
      byty_prodej: number;
      byty_najem: number;
      domy_prodej: number;
      domy_najem: number;
      avg_price_m2_prodej: number | null;
      avg_price_m2_najem: number | null;
      avg_price_byt_prodej: number | null;
      avg_price_byt_najem: number | null;
      min_price_m2: number | null;
      max_price_m2: number | null;
      avg_area: number | null;
    }>;
    pragueTotal: PragueTotal;
  };

  const maxPriceM2 = Math.max(
    ...districts.map((d) => d.avg_price_m2_prodej || 0)
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Cenová mapa Prahy
        </h1>
        <p className="mt-2 text-muted">
          Agregace cen nemovitostí podle městských částí. Data ze Sreality.cz.
        </p>
      </div>

      {/* Top-level stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold">
            {formatNum(pragueTotal.total)}
          </div>
          <div className="mt-1 text-sm text-muted">Nemovitostí celkem</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold text-accent-light">
            {formatNum(pragueTotal.avg_price_m2)}
          </div>
          <div className="mt-1 text-sm text-muted">Prům. Kč/m² (prodej)</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold">
            {pragueTotal.avg_price
              ? `${(pragueTotal.avg_price / 1_000_000).toFixed(1)} M`
              : "—"}
          </div>
          <div className="mt-1 text-sm text-muted">Prům. cena bytu</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold text-green">
            {formatNum(pragueTotal.avg_rent_m2)}
          </div>
          <div className="mt-1 text-sm text-muted">Prům. Kč/m² (nájem)</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-2xl font-bold">
            {formatNum(pragueTotal.avg_rent)}
          </div>
          <div className="mt-1 text-sm text-muted">Prům. nájem Kč/měs</div>
        </div>
      </div>

      {/* Price Index Chart */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">
          Cenový index – Praha (byty, prodej)
        </h2>
        <PriceChart
          priceIndex={indexData.priceIndex}
          districtIndex={indexData.districtIndex}
        />
      </div>

      {/* District breakdown */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">
          Městské části – přehled
        </h2>
        <DistrictBar districts={districts} maxPriceM2={maxPriceM2} />
      </div>
    </div>
  );
}
