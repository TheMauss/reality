"use client";

interface MonthlyPrice {
  year: number;
  month: number;
  avgPriceM2: number;
  label: string;
}

function formatNum(n: number): string {
  return Math.round(n).toLocaleString("cs-CZ");
}

export default function SoldPriceChart({
  monthlyPrices,
  askingPriceM2,
}: {
  monthlyPrices: MonthlyPrice[];
  askingPriceM2: number | null;
}) {
  if (monthlyPrices.length < 2) return null;

  const values = monthlyPrices.map((p) => p.avgPriceM2);
  const minVal = Math.min(...values) * 0.92;
  const maxValSold = Math.max(...values);
  const maxVal = Math.max(maxValSold, askingPriceM2 || 0) * 1.08;
  const range = maxVal - minVal || 1;

  const width = 900;
  const height = 340;
  const padX = 70;
  const padY = 30;
  const padBottom = 50;
  const chartW = width - padX * 2;
  const chartH = height - padY - padBottom;

  const toX = (i: number) =>
    padX + (i / Math.max(monthlyPrices.length - 1, 1)) * chartW;
  const toY = (v: number) => padY + chartH - ((v - minVal) / range) * chartH;

  // Build SVG path for sold prices
  const soldPath = monthlyPrices
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p.avgPriceM2)}`)
    .join(" ");

  // Gradient area
  const areaPath = `${soldPath} L ${toX(monthlyPrices.length - 1)} ${toY(minVal)} L ${toX(0)} ${toY(minVal)} Z`;

  // Grid lines
  const gridValues = Array.from({ length: 5 }, (_, i) =>
    Math.round(minVal + (range * (i + 1)) / 5)
  );

  // X axis labels (show every 6 months)
  const xLabels = monthlyPrices.filter(
    (_, i) =>
      i === 0 ||
      i === monthlyPrices.length - 1 ||
      (monthlyPrices[i].month === 1)
  );

  // First and last price for trend
  const firstPrice = monthlyPrices[0].avgPriceM2;
  const lastPrice = monthlyPrices[monthlyPrices.length - 1].avgPriceM2;
  const totalChange = ((lastPrice - firstPrice) / firstPrice) * 100;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex flex-wrap gap-6">
        <div>
          <div className="text-sm text-muted">Aktuální prodejní cena</div>
          <div className="text-2xl font-bold">
            {formatNum(lastPrice)} Kč/m²
          </div>
        </div>
        <div>
          <div className="text-sm text-muted">
            Změna od {monthlyPrices[0].label}
          </div>
          <div
            className={`text-2xl font-bold ${totalChange >= 0 ? "text-green" : "text-red"}`}
          >
            {totalChange >= 0 ? "+" : ""}
            {totalChange.toFixed(1)}%
          </div>
        </div>
        {askingPriceM2 && (
          <div>
            <div className="text-sm text-muted">Nabídková cena (prům.)</div>
            <div className="text-2xl font-bold text-accent-light">
              {formatNum(askingPriceM2)} Kč/m²
            </div>
          </div>
        )}
        {askingPriceM2 && (
          <div>
            <div className="text-sm text-muted">Spread (nabídka vs prodej)</div>
            <div className="text-2xl font-bold text-amber-400">
              {askingPriceM2 > lastPrice ? "+" : ""}
              {(((askingPriceM2 - lastPrice) / lastPrice) * 100).toFixed(1)}%
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ minWidth: 600 }}
        >
          <defs>
            <linearGradient id="soldGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid */}
          {gridValues.map((val) => (
            <g key={val}>
              <line
                x1={padX}
                y1={toY(val)}
                x2={width - padX}
                y2={toY(val)}
                stroke="#2a2e3d"
                strokeWidth={1}
              />
              <text
                x={padX - 8}
                y={toY(val) + 4}
                textAnchor="end"
                fill="#6b7280"
                fontSize={10}
              >
                {formatNum(val)}
              </text>
            </g>
          ))}

          {/* Asking price line (if available) */}
          {askingPriceM2 && (
            <>
              <line
                x1={padX}
                y1={toY(askingPriceM2)}
                x2={width - padX}
                y2={toY(askingPriceM2)}
                stroke="#818cf8"
                strokeWidth={2}
                strokeDasharray="8,4"
                opacity={0.7}
              />
              <text
                x={width - padX + 4}
                y={toY(askingPriceM2) + 4}
                fill="#818cf8"
                fontSize={10}
              >
                Nabídka
              </text>
            </>
          )}

          {/* Sold price area fill */}
          <path d={areaPath} fill="url(#soldGradient)" />

          {/* Sold price line */}
          <path
            d={soldPath}
            fill="none"
            stroke="#22c55e"
            strokeWidth={2.5}
          />

          {/* Data points on hover */}
          {monthlyPrices.map((p, i) => (
            <circle
              key={i}
              cx={toX(i)}
              cy={toY(p.avgPriceM2)}
              r={3}
              fill="#22c55e"
              opacity={0}
              className="hover:opacity-100"
            >
              <title>
                {p.label}: {formatNum(p.avgPriceM2)} Kč/m²
              </title>
            </circle>
          ))}

          {/* X labels */}
          {xLabels.map((p) => {
            const idx = monthlyPrices.indexOf(p);
            return (
              <text
                key={p.label}
                x={toX(idx)}
                y={height - 15}
                textAnchor="middle"
                fill="#6b7280"
                fontSize={10}
              >
                {p.label}
              </text>
            );
          })}

          {/* Legend */}
          <circle cx={padX} cy={height - 5} r={4} fill="#22c55e" />
          <text x={padX + 10} y={height - 1} fill="#6b7280" fontSize={10}>
            Prodejní cena (realizovaná)
          </text>
          {askingPriceM2 && (
            <>
              <line
                x1={padX + 180}
                y1={height - 5}
                x2={padX + 200}
                y2={height - 5}
                stroke="#818cf8"
                strokeWidth={2}
                strokeDasharray="4,2"
              />
              <text
                x={padX + 206}
                y={height - 1}
                fill="#6b7280"
                fontSize={10}
              >
                Nabídková cena (aktuální)
              </text>
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
