"use client";

interface District {
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
}

function formatNum(n: number | null): string {
  if (n === null) return "—";
  return Math.round(n).toLocaleString("cs-CZ");
}

const DISTRICT_COLORS: Record<string, string> = {
  "Praha 1": "from-amber-500 to-orange-600",
  "Praha 2": "from-rose-500 to-pink-600",
  "Praha 3": "from-violet-500 to-purple-600",
  "Praha 4": "from-blue-500 to-indigo-600",
  "Praha 5": "from-cyan-500 to-blue-600",
  "Praha 6": "from-emerald-500 to-green-600",
  "Praha 7": "from-teal-500 to-cyan-600",
  "Praha 8": "from-sky-500 to-blue-600",
  "Praha 9": "from-lime-500 to-green-600",
  "Praha 10": "from-yellow-500 to-amber-600",
  "Praha (ostatní)": "from-gray-500 to-gray-600",
};

export default function DistrictBar({
  districts,
  maxPriceM2,
}: {
  districts: District[];
  maxPriceM2: number;
}) {
  return (
    <div className="space-y-3">
      {districts.map((d) => {
        const barWidth = d.avg_price_m2_prodej
          ? (d.avg_price_m2_prodej / maxPriceM2) * 100
          : 0;
        const gradient =
          DISTRICT_COLORS[d.district] || "from-gray-500 to-gray-600";

        return (
          <div
            key={d.district}
            className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-card-hover"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <span className="text-base font-semibold">{d.district}</span>
                <span className="ml-2 text-xs text-muted">
                  {d.total_listings} nemovitostí
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold">
                  {formatNum(d.avg_price_m2_prodej)} Kč/m²
                </span>
                <span className="ml-2 text-xs text-muted">prodej</span>
              </div>
            </div>

            {/* Bar */}
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-border/30">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all`}
                style={{ width: `${barWidth}%` }}
              />
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
              <div>
                <span className="text-muted">Prům. cena bytu</span>
                <div className="font-medium">
                  {d.avg_price_byt_prodej
                    ? `${(d.avg_price_byt_prodej / 1_000_000).toFixed(1)} M Kč`
                    : "—"}
                </div>
              </div>
              <div>
                <span className="text-muted">Prům. nájem</span>
                <div className="font-medium">
                  {d.avg_price_byt_najem
                    ? `${formatNum(d.avg_price_byt_najem)} Kč/měs`
                    : "—"}
                </div>
              </div>
              <div>
                <span className="text-muted">Rozsah Kč/m²</span>
                <div className="font-medium">
                  {formatNum(d.min_price_m2)} – {formatNum(d.max_price_m2)}
                </div>
              </div>
              <div>
                <span className="text-muted">Prům. výměra</span>
                <div className="font-medium">
                  {d.avg_area ? `${Math.round(d.avg_area)} m²` : "—"}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
