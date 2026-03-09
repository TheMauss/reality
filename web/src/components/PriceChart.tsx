"use client";

interface DataPoint {
  day: string;
  avg_price_m2: number;
  sample_size: number;
}

interface DistrictDataPoint {
  day: string;
  district: string;
  avg_price_m2: number;
  sample_size: number;
}

const DISTRICT_COLORS: Record<string, string> = {
  "Praha 1": "#f59e0b",
  "Praha 2": "#f43f5e",
  "Praha 3": "#8b5cf6",
  "Praha 4": "#3b82f6",
  "Praha 5": "#06b6d4",
  "Praha 6": "#10b981",
  "Praha 7": "#14b8a6",
  "Praha 8": "#0ea5e9",
  "Praha 9": "#84cc16",
  "Praha 10": "#eab308",
};

function formatNum(n: number): string {
  return Math.round(n).toLocaleString("cs-CZ");
}

export default function PriceChart({
  priceIndex,
  districtIndex,
}: {
  priceIndex: DataPoint[];
  districtIndex: DistrictDataPoint[];
}) {
  // If we only have one day, show a comparison bar chart instead
  if (priceIndex.length <= 1) {
    // Group district data by district name for the latest day
    const latestDay = districtIndex.length > 0 ? districtIndex[0].day : "";
    const districtData = districtIndex
      .filter((d) => d.day === latestDay && d.district !== "Praha (ostatní)")
      .sort((a, b) => b.avg_price_m2 - a.avg_price_m2);

    const maxVal = districtData.length
      ? Math.max(...districtData.map((d) => d.avg_price_m2))
      : 1;

    return (
      <div className="space-y-6">
        {/* Prague average headline */}
        {priceIndex.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold">
              {formatNum(priceIndex[0].avg_price_m2)}
              <span className="ml-1 text-lg font-normal text-muted">
                Kč/m²
              </span>
            </div>
            <div className="text-sm text-muted">
              Průměrná cena bytů k prodeji v Praze
              <br />
              Vzorek: {priceIndex[0].sample_size} nemovitostí
            </div>
          </div>
        )}

        {/* District comparison bars */}
        <div>
          <h3 className="mb-4 text-sm font-medium text-muted">
            Porovnání městských částí – cena za m² (byty, prodej)
          </h3>
          <div className="space-y-2">
            {districtData.map((d) => {
              const pct = (d.avg_price_m2 / maxVal) * 100;
              const color = DISTRICT_COLORS[d.district] || "#6b7280";
              return (
                <div key={d.district} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-right text-sm font-medium">
                    {d.district}
                  </span>
                  <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-border/20">
                    <div
                      className="flex h-full items-center rounded-lg px-3 text-xs font-bold text-white transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: color,
                        minWidth: "60px",
                      }}
                    >
                      {formatNum(d.avg_price_m2)} Kč/m²
                    </div>
                  </div>
                  <span className="w-14 shrink-0 text-right text-xs text-muted">
                    ({d.sample_size})
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info about future chart */}
        <div className="rounded-lg border border-border/50 bg-card p-4 text-center text-sm text-muted">
          📈 Časový graf vývoje cen se zobrazí po nasbírání dat z více dnů.
          Scraper běží každé 2 hodiny.
        </div>
      </div>
    );
  }

  // Multi-day: render SVG line chart
  const days = priceIndex.map((p) => p.day);
  const allValues = priceIndex.map((p) => p.avg_price_m2);
  const minVal = Math.min(...allValues) * 0.95;
  const maxVal = Math.max(...allValues) * 1.05;
  const range = maxVal - minVal || 1;

  const width = 800;
  const height = 300;
  const padX = 60;
  const padY = 30;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const toX = (i: number) => padX + (i / Math.max(days.length - 1, 1)) * chartW;
  const toY = (v: number) => padY + chartH - ((v - minVal) / range) * chartH;

  const mainLine = priceIndex
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p.avg_price_m2)}`)
    .join(" ");

  // District lines
  const districtsByName = new Map<string, DistrictDataPoint[]>();
  for (const d of districtIndex) {
    if (d.district === "Praha (ostatní)") continue;
    const arr = districtsByName.get(d.district) || [];
    arr.push(d);
    districtsByName.set(d.district, arr);
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ minWidth: 600 }}
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = padY + chartH * (1 - pct);
            const val = minVal + range * pct;
            return (
              <g key={pct}>
                <line
                  x1={padX}
                  y1={y}
                  x2={width - padX}
                  y2={y}
                  stroke="#2a2e3d"
                  strokeWidth={1}
                />
                <text
                  x={padX - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#6b7280"
                  fontSize={11}
                >
                  {formatNum(val)}
                </text>
              </g>
            );
          })}

          {/* District lines */}
          {Array.from(districtsByName.entries()).map(([name, points]) => {
            const color = DISTRICT_COLORS[name] || "#6b7280";
            const line = points
              .map((p, i) => {
                const dayIdx = days.indexOf(p.day);
                return `${i === 0 ? "M" : "L"} ${toX(dayIdx)} ${toY(p.avg_price_m2)}`;
              })
              .join(" ");
            return (
              <path
                key={name}
                d={line}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                opacity={0.4}
              />
            );
          })}

          {/* Main Prague line */}
          <path
            d={mainLine}
            fill="none"
            stroke="#6366f1"
            strokeWidth={3}
          />
          {priceIndex.map((p, i) => (
            <circle
              key={i}
              cx={toX(i)}
              cy={toY(p.avg_price_m2)}
              r={4}
              fill="#6366f1"
            >
              <title>
                {p.day}: {formatNum(p.avg_price_m2)} Kč/m²
              </title>
            </circle>
          ))}

          {/* X axis labels */}
          {days.map((day, i) => (
            <text
              key={i}
              x={toX(i)}
              y={height - 5}
              textAnchor="middle"
              fill="#6b7280"
              fontSize={10}
            >
              {day.slice(5)}
            </text>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: "#6366f1" }}
          />
          Praha celkem
        </span>
        {Array.from(districtsByName.keys()).map((name) => (
          <span key={name} className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full opacity-60"
              style={{
                backgroundColor: DISTRICT_COLORS[name] || "#6b7280",
              }}
            />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
