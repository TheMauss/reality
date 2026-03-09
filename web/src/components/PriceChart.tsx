"use client";

import dynamic from "next/dynamic";
import type { ChartCandle } from "./CandlestickChart";

const CandlestickChart = dynamic(() => import("./CandlestickChart"), { ssr: false });

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

function getMondayKey(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const dow = d.getUTCDay() || 7; // 1=Mon ... 7=Sun
  d.setUTCDate(d.getUTCDate() - dow + 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function toWeeklyCandles(points: DataPoint[]): ChartCandle[] {
  const map = new Map<string, DataPoint[]>();
  for (const p of points) {
    const key = getMondayKey(p.day);
    const arr = map.get(key) ?? [];
    arr.push(p);
    map.set(key, arr);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, pts]) => {
      const prices = pts.map(p => p.avg_price_m2);
      return {
        time: weekStart,
        open: pts[0].avg_price_m2,
        high: Math.max(...prices),
        low: Math.min(...prices),
        close: pts[pts.length - 1].avg_price_m2,
        volume: pts[pts.length - 1].sample_size,
      };
    });
}

export default function PriceChart({
  priceIndex,
  districtIndex,
}: {
  priceIndex: DataPoint[];
  districtIndex: DistrictDataPoint[];
}) {
  // Single-day fallback: district comparison bars
  if (priceIndex.length <= 1) {
    const latestDay = districtIndex.length > 0 ? districtIndex[0].day : "";
    const districtData = districtIndex
      .filter(d => d.day === latestDay && d.district !== "Praha (ostatní)")
      .sort((a, b) => b.avg_price_m2 - a.avg_price_m2);
    const maxVal = districtData.length ? Math.max(...districtData.map(d => d.avg_price_m2)) : 1;

    return (
      <div className="space-y-6">
        {priceIndex.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold">
              {formatNum(priceIndex[0].avg_price_m2)}
              <span className="ml-1 text-lg font-normal text-muted">Kč/m²</span>
            </div>
            <div className="text-sm text-muted">
              Průměrná cena bytů k prodeji v Praze<br />
              Vzorek: {priceIndex[0].sample_size} nemovitostí
            </div>
          </div>
        )}
        <div>
          <h3 className="mb-4 text-sm font-medium text-muted">
            Porovnání městských částí – cena za m² (byty, prodej)
          </h3>
          <div className="space-y-2">
            {districtData.map(d => {
              const pct = (d.avg_price_m2 / maxVal) * 100;
              const color = DISTRICT_COLORS[d.district] || "#6b7280";
              return (
                <div key={d.district} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-right text-sm font-medium">{d.district}</span>
                  <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-border/20">
                    <div
                      className="flex h-full items-center rounded-lg px-3 text-xs font-bold text-white transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color, minWidth: "60px" }}
                    >
                      {formatNum(d.avg_price_m2)} Kč/m²
                    </div>
                  </div>
                  <span className="w-14 shrink-0 text-right text-xs text-muted">({d.sample_size})</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-card p-4 text-center text-sm text-muted">
          📈 Časový graf vývoje cen se zobrazí po nasbírání dat z více dnů. Scraper běží každé 2 hodiny.
        </div>
      </div>
    );
  }

  const candles = toWeeklyCandles(priceIndex);
  if (candles.length === 0) return null;

  const lastCandle = candles[candles.length - 1];
  const firstCandle = candles[0];
  const totalChange = ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <div className="text-sm text-muted">Aktuální nabídková cena</div>
          <div className="text-3xl font-bold">{formatNum(lastCandle.close)} Kč/m²</div>
        </div>
        <div>
          <div className="text-sm text-muted">Změna za období</div>
          <div className={`text-xl font-bold ${totalChange >= 0 ? "text-green-400" : "text-red-400"}`}>
            {totalChange >= 0 ? "+" : ""}{totalChange.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-sm text-muted">Aktivních inzerátů</div>
          <div className="text-xl font-bold">{formatNum(lastCandle.volume ?? 0)}</div>
        </div>
        <div className="ml-auto text-xs text-muted">Weekly • nabídkové ceny</div>
      </div>

      <CandlestickChart candles={candles} height={400} defaultTimeframe="Vše" />
    </div>
  );
}
