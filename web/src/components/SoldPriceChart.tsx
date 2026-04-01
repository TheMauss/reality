"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { ChartCandle } from "./CandlestickChart";

const CandlestickChart = dynamic(() => import("./CandlestickChart"), { ssr: false });

interface MonthlyPrice {
  year: number;
  month: number;
  avgPriceM2: number;
  label: string;
  txCount?: number;
  volMilCzk?: number;
}

function formatNum(n: number): string {
  return Math.round(n).toLocaleString("cs-CZ");
}

function monthToDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function filterMonthlyByMonths(prices: MonthlyPrice[], months: number): MonthlyPrice[] {
  if (months === 0) return prices;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return prices.filter(p => new Date(p.year, p.month - 1, 1) >= cutoff);
}

export default function SoldPriceChart({
  monthlyPrices,
  askingPriceM2,
}: {
  monthlyPrices: MonthlyPrice[];
  askingPriceM2: number | null;
}) {
  const [tfMonths, setTfMonths] = useState(0); // 0 = Vše
  const [tfLabel, setTfLabel] = useState("Vše");

  if (monthlyPrices.length < 2) return null;

  const filtered = filterMonthlyByMonths(monthlyPrices, tfMonths);
  const visiblePrices = filtered.length >= 2 ? filtered : monthlyPrices;

  const hasVolume = monthlyPrices.some(p => (p.volMilCzk ?? 0) > 0);

  const candles: ChartCandle[] = monthlyPrices.map(p => {
    const volMilCzk = hasVolume ? (p.volMilCzk ?? 0) : undefined;
    return {
      time: monthToDate(p.year, p.month),
      open: p.avgPriceM2,
      high: p.avgPriceM2,
      low: p.avgPriceM2,
      close: p.avgPriceM2,
      volume: volMilCzk,
    };
  });

  const firstPrice = visiblePrices[0].avgPriceM2;
  const lastPrice = visiblePrices[visiblePrices.length - 1].avgPriceM2;
  const totalChange = ((lastPrice - firstPrice) / firstPrice) * 100;
  const changeFromLabel = visiblePrices[0].label;

  const lastTx = visiblePrices[visiblePrices.length - 1].txCount;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-6">
        <div>
          <div className="text-sm text-muted">Aktuální prodejní cena</div>
          <div className="text-2xl font-bold">{formatNum(lastPrice)} Kč/m²</div>
        </div>
        <div>
          <div className="text-sm text-muted">
            Změna {tfMonths === 0 ? `od ${changeFromLabel}` : `za ${tfLabel}`}
          </div>
          <div className={`text-2xl font-bold ${totalChange >= 0 ? "text-green" : "text-red"}`}>
            {totalChange >= 0 ? "+" : ""}{totalChange.toFixed(1)}%
          </div>
        </div>
        {askingPriceM2 && (
          <div>
            <div className="text-sm text-muted">Nabídková cena (prům.)</div>
            <div className="text-2xl font-bold text-accent-light">{formatNum(askingPriceM2)} Kč/m²</div>
          </div>
        )}
        {askingPriceM2 && (
          <div>
            <div className="text-sm text-muted">Spread (nabídka vs prodej)</div>
            <div className="text-2xl font-bold text-amber">
              {askingPriceM2 > lastPrice ? "+" : ""}
              {(((askingPriceM2 - lastPrice) / lastPrice) * 100).toFixed(1)}%
            </div>
          </div>
        )}
        {lastTx != null && lastTx > 0 && (
          <div>
            <div className="text-sm text-muted">Transakcí (poslední měsíc)</div>
            <div className="text-2xl font-bold">{formatNum(lastTx)}</div>
          </div>
        )}
      </div>

      <CandlestickChart
        candles={candles}
        height={360}
        defaultTimeframe="Vše"
        askingPrice={askingPriceM2}
        volumeLabel={hasVolume ? "Objem (odhad, mil. Kč)" : ""}
        onTfChange={(label, months) => {
          setTfMonths(months);
          setTfLabel(label);
        }}
      />
    </div>
  );
}
